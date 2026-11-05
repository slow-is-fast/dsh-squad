/**
 * Core functions for dsh-squad CLI
 * Exported for testing purposes
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Cache for loaded agents to avoid repeated file reads
let cachedAgents = null;

/**
 * Load tasks from JSON file
 */
export function loadTasks(filepath) {
  // Input validation
  if (!filepath || typeof filepath !== 'string') {
    throw new Error('Invalid file path: path must be a non-empty string');
  }
  
  // Normalize and resolve the path
  const normalizedPath = normalize(filepath);
  const resolvedPath = resolve(normalizedPath);
  
  // Check if file exists
  if (!existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }
  
  const content = readFileSync(resolvedPath, 'utf-8');
  const data = JSON.parse(content);
  return data.tasks || data;
}

/**
 * Load agent definitions
 * @returns {AgentDef[]} Array of agent definitions (cached after first load)
 */
export function loadAgents() {
  // Return cached result if available
  if (cachedAgents !== null) {
    return cachedAgents;
  }
  
  const agentsDir = join(__dirname, '..', 'agents');
  const agents = [];
  
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
 * Validate tasks
 */
export function validateTasks(tasks) {
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