/**
 * Core functions for dsh-squad CLI
 * Exported for testing purposes
 */

import { readFileSync, readdirSync, existsSync, writeFileSync, renameSync } from 'node:fs';
import { join, dirname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ValidationError, FileError, ParseError } from './errors.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Cache for loaded agents to avoid repeated file reads
let cachedAgents = null;

const DEFAULT_MODEL = 'glm-5.3';

const DEFAULT_SETTINGS = Object.freeze({
  maxParallelTasks: 5,
  taskTimeout: 600000,
  retryAttempts: 2,
  enableQA: true,
  enableHealthCheck: true
});

const AGENT_PROPERTIES = ['model', 'thinking'];

// ============================================================================
// Configuration
// ============================================================================

function defaultConfig() {
  return {
    agents: {},
    defaultModel: DEFAULT_MODEL,
    settings: { ...DEFAULT_SETTINGS }
  };
}

/**
 * DSH state directory (~/.dsh). DSH_HOME overrides it and is the state
 * directory itself, not the user's home.
 */
function dshHomeDir() {
  if (process.env.DSH_HOME) return process.env.DSH_HOME;
  const home = process.env.USERPROFILE || process.env.HOME;
  if (!home) {
    throw new ValidationError('Cannot locate home directory: set DSH_HOME or HOME');
  }
  return join(home, '.dsh');
}

function globalConfigPath() {
  try {
    return join(dshHomeDir(), 'dsh-squad.json');
  } catch {
    return null;
  }
}

function projectConfigPath() {
  return process.env.SQUAD_CONFIG_PATH || join(__dirname, '..', 'config', 'squad.config.json');
}

/**
 * The file loadConfig() reads right now, plus its on-disk format.
 * `dsh` is the ~/.dsh/dsh-squad.json overlay shape (roles/routes);
 * `project` is the squad.config.json shape (agents/settings).
 * @returns {{path: string, format: 'dsh'|'project'}}
 */
export function configSource() {
  const globalPath = globalConfigPath();
  if (globalPath && existsSync(globalPath)) {
    return { path: globalPath, format: 'dsh' };
  }
  return { path: projectConfigPath(), format: 'project' };
}

function readJsonOr(filePath, fallback) {
  if (!existsSync(filePath)) {
    return structuredClone(fallback);
  }
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (error) {
    throw new ParseError(`Invalid JSON in ${filePath}`, error.message);
  }
}

function writeJsonAtomic(filePath, data) {
  const tmp = `${filePath}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
  renameSync(tmp, filePath);
}

/**
 * Convert the ~/.dsh/dsh-squad.json overlay shape into the internal config.
 */
function fromDshFormat(raw) {
  const config = defaultConfig();
  if (!raw || typeof raw.roles !== 'object' || raw.roles === null) {
    throw new ValidationError('DSH config has no "roles" object');
  }

  for (const [roleName, roleConfig] of Object.entries(raw.roles)) {
    const route = Array.isArray(roleConfig?.routes) ? roleConfig.routes[0] : undefined;
    if (!route || typeof route.model !== 'string' || route.model === '') continue;

    config.agents[roleName] = {
      model: route.model,
      ...(route.provider ? { provider: route.provider } : {}),
      thinking: roleConfig.thinking || null
    };
  }

  return config;
}

/**
 * Load squad configuration.
 *
 * Priority:
 *   1. $DSH_HOME/dsh-squad.json (or ~/.dsh/dsh-squad.json)
 *   2. $SQUAD_CONFIG_PATH or <skill>/config/squad.config.json
 *   3. Built-in defaults
 *
 * A present-but-broken file is reported and skipped, never silently used.
 * @returns {Object} Configuration object
 */
export function loadConfig() {
  const homeConfigPath = globalConfigPath();

  if (homeConfigPath && existsSync(homeConfigPath)) {
    try {
      const raw = JSON.parse(readFileSync(homeConfigPath, 'utf-8'));
      return fromDshFormat(raw);
    } catch (error) {
      console.error(`Warning: Failed to load DSH config from ${homeConfigPath}: ${error.message}`);
    }
  }

  const configPath = projectConfigPath();

  try {
    if (existsSync(configPath)) {
      const parsed = JSON.parse(readFileSync(configPath, 'utf-8'));
      return {
        ...defaultConfig(),
        ...parsed,
        agents: parsed.agents || {},
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) }
      };
    }
  } catch (error) {
    console.error(`Warning: Failed to load config from ${configPath}: ${error.message}`);
  }

  return defaultConfig();
}

/**
 * Persist one agent setting into whichever file loadConfig() reads.
 *
 * Writing to the shadowed file would report success while changing nothing,
 * so the target is resolved first and the on-disk format is preserved.
 * @param {string} agentName
 * @param {'model'|'thinking'} property
 * @param {string} value - model name, or "enabled"/"disabled" for thinking
 * @returns {{path: string, format: 'dsh'|'project'}} where it was written
 */
export function saveAgentConfig(agentName, property, value) {
  const knownAgents = loadAgents().map(agent => agent.name);
  if (!knownAgents.includes(agentName)) {
    throw new ValidationError(
      `Unknown agent: ${agentName}`,
      `Known agents: ${[...knownAgents].sort().join(', ')}`
    );
  }

  if (!AGENT_PROPERTIES.includes(property)) {
    throw new ValidationError(
      `Unknown property: ${property}`,
      `Supported properties: ${AGENT_PROPERTIES.join(', ')}`
    );
  }

  if (property === 'model') {
    if (typeof value !== 'string' || value.trim() === '' || /\s/.test(value)) {
      throw new ValidationError(`Invalid model name: ${JSON.stringify(value)}`);
    }
  } else if (value !== 'enabled' && value !== 'disabled') {
    throw new ValidationError(
      `Invalid thinking value: ${JSON.stringify(value)}`,
      'Supported values: enabled, disabled'
    );
  }

  const { path, format } = configSource();

  if (format === 'dsh') {
    const raw = readJsonOr(path, { version: 1, roles: {} });
    if (typeof raw.roles !== 'object' || raw.roles === null) raw.roles = {};

    const role = raw.roles[agentName] || (raw.roles[agentName] = { inherit: true, routes: [] });
    if (!Array.isArray(role.routes)) role.routes = [];

    if (property === 'model') {
      if (role.routes.length === 0) {
        role.routes.push({ model: value });
      } else {
        role.routes[0] = { ...role.routes[0], model: value };
      }
    } else if (value === 'disabled') {
      delete role.thinking;
    } else {
      role.thinking = 'enabled';
    }

    writeJsonAtomic(path, raw);
  } else {
    const raw = readJsonOr(path, defaultConfig());
    if (typeof raw.agents !== 'object' || raw.agents === null) raw.agents = {};

    const current = raw.agents[agentName] || {};

    if (property === 'model') {
      raw.agents[agentName] = { ...current, model: value };
    } else if (value === 'disabled') {
      const { thinking: _ignored, ...rest } = current;
      raw.agents[agentName] = rest;
    } else {
      raw.agents[agentName] = { ...current, thinking: 'enabled' };
    }

    writeJsonAtomic(path, raw);
  }

  clearAgentsCache();
  return { path, format };
}

// ============================================================================
// Tasks
// ============================================================================

/**
 * Load tasks from a JSON file.
 * Accepts a top-level array or an object with a `tasks` array.
 * @param {string} filepath
 * @returns {Array} Task list
 */
export function loadTasks(filepath) {
  if (!filepath || typeof filepath !== 'string') {
    throw new ValidationError('Invalid file path: path must be a non-empty string');
  }

  const resolvedPath = resolve(normalize(filepath));

  if (!existsSync(resolvedPath)) {
    throw new FileError(`File not found: ${resolvedPath}`, resolvedPath);
  }

  let content;
  try {
    content = readFileSync(resolvedPath, 'utf-8');
  } catch (error) {
    throw new FileError(`Cannot read file: ${resolvedPath}`, error.message);
  }

  let data;
  try {
    data = JSON.parse(content);
  } catch (error) {
    throw new ParseError(`Invalid JSON in ${resolvedPath}`, error.message);
  }

  const tasks = Array.isArray(data) ? data : data?.tasks;
  if (!Array.isArray(tasks)) {
    throw new ValidationError(
      'Task file must be a JSON array or an object with a "tasks" array',
      resolvedPath
    );
  }

  return tasks;
}

// ============================================================================
// Agents
// ============================================================================

/**
 * Load agent definitions with model configuration
 * @returns {Array} Array of agent definitions (cached after first load)
 */
export function loadAgents() {
  // Return cached result if available
  if (cachedAgents !== null) {
    return cachedAgents;
  }

  const agentsDir = join(__dirname, '..', 'agents');
  const agents = [];
  const config = loadConfig();

  if (!existsSync(agentsDir)) {
    cachedAgents = agents;
    return agents;
  }

  const files = readdirSync(agentsDir).filter(f => f.endsWith('.json'));

  for (const file of files) {
    try {
      const content = readFileSync(join(agentsDir, file), 'utf-8');
      const agent = JSON.parse(content);
      if (!agent.disabled) {
        // Apply model configuration from config file
        const agentConfig = config.agents[agent.name];
        if (agentConfig) {
          agent.model = agentConfig.model || config.defaultModel;
          agent.thinking = agentConfig.thinking || null;
          if (agentConfig.tools) {
            agent.tools = agentConfig.tools;
          }
        } else if (!agent.model) {
          // Use default model if not specified
          agent.model = config.defaultModel;
        }

        agents.push(agent);
      }
    } catch (error) {
      console.error(`Warning: Failed to load agent ${file}: ${error.message}`);
    }
  }

  // Cache the result
  cachedAgents = agents;
  return agents;
}

/**
 * Clear the agents cache (useful for testing or hot-reload)
 */
export function clearAgentsCache() {
  cachedAgents = null;
}

/**
 * Get squad settings
 * @returns {Object} Settings object
 */
export function getSettings() {
  const config = loadConfig();
  return config.settings;
}

// ============================================================================
// Validation and graph analysis
// ============================================================================

/**
 * Validate tasks
 * @param {Array} tasks
 * @returns {string[]} Error messages (empty when valid)
 */
export function validateTasks(tasks) {
  if (!Array.isArray(tasks)) {
    throw new ValidationError(`validateTasks expects an array of tasks, got ${typeof tasks}`);
  }

  const errors = [];
  const taskIds = new Set(tasks.map(t => t.id));
  const agents = new Set(loadAgents().map(a => a.name));

  // Check for duplicate IDs
  const seen = new Set();
  for (const task of tasks) {
    if (seen.has(task.id)) {
      errors.push(`Duplicate task ID: ${task.id}`);
    }
    seen.add(task.id);
  }

  // Check dependencies exist
  for (const task of tasks) {
    for (const dep of (task.depends || [])) {
      if (!taskIds.has(dep)) {
        errors.push(`Task '${task.id}' depends on non-existent task '${dep}'`);
      }
    }
  }

  // Check agents exist
  for (const task of tasks) {
    if (!agents.has(task.agent)) {
      errors.push(`Task '${task.id}' uses unknown agent '${task.agent}'`);
    }
  }

  // Check for cycles
  const graph = buildDependencyGraph(tasks);
  const cycles = detectCycles(graph);
  if (cycles.length > 0) {
    errors.push(`Dependency cycles detected: ${cycles.join(', ')}`);
  }

  return errors;
}

/**
 * Build dependency graph
 */
export function buildDependencyGraph(tasks) {
  const graph = {};
  for (const task of tasks) {
    graph[task.id] = task.depends || [];
  }
  return graph;
}

/**
 * Detect cycles in dependency graph
 */
export function detectCycles(graph) {
  const cycles = [];
  const visited = new Set();
  const recursionStack = new Set();

  function dfs(node, path) {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    for (const dep of (graph[node] || [])) {
      if (!visited.has(dep)) {
        dfs(dep, [...path]);
      } else if (recursionStack.has(dep)) {
        const cycleStart = path.indexOf(dep);
        const cycle = path.slice(cycleStart).join(' → ') + ` → ${dep}`;
        cycles.push(cycle);
      }
    }

    recursionStack.delete(node);
  }

  for (const node of Object.keys(graph)) {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  }

  return cycles;
}

/**
 * Calculate task depths (distance from roots)
 */
export function calculateDepths(graph) {
  const depths = {};

  function getDepth(node) {
    if (depths[node] !== undefined) return depths[node];

    const deps = graph[node] || [];
    if (deps.length === 0) {
      depths[node] = 0;
    } else {
      depths[node] = 1 + Math.max(...deps.map(d => getDepth(d)));
    }

    return depths[node];
  }

  for (const node of Object.keys(graph)) {
    getDepth(node);
  }

  return depths;
}

/**
 * Count tasks that can run in parallel
 */
export function countParallelTasks(graph, depths) {
  const byDepth = {};
  for (const [taskId, depth] of Object.entries(depths)) {
    if (!byDepth[depth]) byDepth[depth] = [];
    byDepth[depth].push(taskId);
  }

  const depthArrays = Object.values(byDepth);
  if (depthArrays.length === 0) {
    return 0; // Empty graph has 0 parallelism
  }

  return Math.max(...depthArrays.map(arr => arr.length));
}