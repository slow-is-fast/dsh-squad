#!/usr/bin/env node

/**
 * DSH Squad CLI - Multi-agent task orchestration helper
 * 
 * Commands:
 * - plan: Analyze tasks and show execution plan
 * - agents: List available agents
 * - validate: Validate task breakdown
 * - deps: Show dependency graph
 * 
 * Error Codes:
 * - VALIDATION_ERROR: Input validation failed
 * - FILE_ERROR: File operation failed
 * - PARSE_ERROR: JSON parsing failed
 * - COMMAND_ERROR: Invalid command or arguments
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import { 
  loadTasks, 
  loadAgents, 
  loadConfig,
  clearAgentsCache,
  validateTasks, 
  buildDependencyGraph, 
  detectCycles, 
  calculateDepths, 
  countParallelTasks 
} from '../lib/core.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================================
// Global Flags
// ============================================================================

let verbose = false;
let quiet = false;
let jsonOutput = false;

/**
 * Set verbose mode
 * @param {boolean} value - Verbose mode state
 */
function setVerbose(value) {
  verbose = value;
}

/**
 * Set quiet mode
 * @param {boolean} value - Quiet mode state
 */
function setQuiet(value) {
  quiet = value;
}

/**
 * Set JSON output mode
 * @param {boolean} value - JSON output mode state
 */
function setJsonOutput(value) {
  jsonOutput = value;
}

/**
 * Verbose logging - only outputs when verbose mode is enabled
 * @param {...any} args - Arguments to log
 */
function log(...args) {
  if (verbose && !quiet) {
    console.log('[verbose]', ...args);
  }
}

/**
 * Normal output - suppressed in quiet mode
 * @param {...any} args - Arguments to log
 */
function output(...args) {
  if (!quiet && !jsonOutput) {
    console.log(...args);
  }
}

/**
 * JSON output - outputs data in JSON format when enabled
 * @param {any} data - Data to output
 */
function outputJson(data) {
  if (jsonOutput) {
    console.log(JSON.stringify(data, null, 2));
  }
}

// ============================================================================
// Custom Error Classes
// ============================================================================

class SquadError extends Error {
  constructor(message, code, details = null) {
    super(message);
    this.name = 'SquadError';
    this.code = code;
    this.details = details;
  }
}

class ValidationError extends SquadError {
  constructor(message, details = null) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

class FileError extends SquadError {
  constructor(message, details = null) {
    super(message, 'FILE_ERROR', details);
    this.name = 'FileError';
  }
}

class ParseError extends SquadError {
  constructor(message, details = null) {
    super(message, 'PARSE_ERROR', details);
    this.name = 'ParseError';
  }
}

class CommandError extends SquadError {
  constructor(message, details = null) {
    super(message, 'COMMAND_ERROR', details);
    this.name = 'CommandError';
  }
}

// ============================================================================
// Error Formatting
// ============================================================================

/**
 * Format and display error messages
 * @param {Error} error - The error to format
 */
function formatError(error) {
  if (error instanceof SquadError) {
    console.error(`\n❌ Error [${error.code}]: ${error.message}`);
    if (error.details) {
      console.error(`   Details: ${error.details}`);
    }
    console.error('');
  } else {
    console.error(`\n❌ Unexpected error: ${error.message}\n`);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
  }
}

// ============================================================================
// Types
// ============================================================================

/**
 * @typedef {Object} Task
 * @property {string} id
 * @property {string} title
 * @property {string} [description]
 * @property {string} agent
 * @property {string[]} [depends]
 */

/**
 * @typedef {Object} SquadConfig
 * @property {string} goal
 * @property {Task[]} [tasks]
 * @property {Object} [config]
 */

/**
 * @typedef {Object} AgentDef
 * @property {string} name
 * @property {string} role
 * @property {string[]} tags
 * @property {string} description
 */

// ============================================================================
// Commands
// ============================================================================

/**
 * Plan command - analyze tasks and show execution plan
 */
function planCommand(goal, tasks) {
  if (!tasks && !goal) {
    throw new CommandError('Provide --goal or --tasks file');
  }

  log('planCommand called with goal:', goal || '(none)', 'tasks:', tasks || '(none)');

  output('\n📋 Squad Plan\n');
  
  if (goal) {
    output(`Goal: ${goal}\n`);
    
    // Generate task breakdown suggestion
    log('Generating task suggestions from goal');
    const suggestedTasks = suggestTasks(goal);
    output('Suggested task breakdown:\n');
    printTasks(suggestedTasks);
    
    output('\nExecution order:\n');
    printExecutionOrder(suggestedTasks);
  } else if (tasks) {
    const taskList = loadTasks(tasks);
    output(`Loaded ${taskList.length} tasks\n`);
    printTasks(taskList);
    
    output('\nExecution order:\n');
    printExecutionOrder(taskList);
  }
}

/**
 * Agents command - list available agents
 */
function agentsCommand() {
  log('Loading agents');
  const agents = loadAgents();
  log('Found', agents.length, 'agents');
  
  if (jsonOutput) {
    outputJson({ agents, total: agents.length });
    return;
  }
  
  output('\n🤖 Available Agents\n');
  
  for (const agent of agents) {
    output(`${agent.name.padEnd(12)} - ${agent.role}`);
    output(`             Tags: ${agent.tags.join(', ')}`);
    output(`             ${agent.description}`);
    output();
  }
  
  output(`Total: ${agents.length} agents\n`);
}

/**
 * Validate command - validate task breakdown
 */
function validateCommand(tasksFile) {
  log('validateCommand called with file:', tasksFile);
  const tasks = loadTasks(tasksFile);
  
  const errors = validateTasks(tasks);
  
  if (jsonOutput) {
    outputJson({
      success: errors.length === 0,
      tasksCount: tasks.length,
      uniqueAgents: new Set(tasks.map(t => t.agent)).size,
      errors: errors.length > 0 ? errors : undefined
    });
    if (errors.length > 0) {
      process.exit(1);
    }
    return;
  }
  
  output('\n✅ Task Validation\n');
  
  if (errors.length === 0) {
    output('✓ All validations passed\n');
    output(`Tasks: ${tasks.length}`);
    output(`Agents: ${new Set(tasks.map(t => t.agent)).size} unique`);
    
    const graph = buildDependencyGraph(tasks);
    const cycles = detectCycles(graph);
    output(`Cycles: ${cycles.length === 0 ? 'None' : cycles.join(', ')}`);
    
    const depths = calculateDepths(graph);
    const maxDepth = Math.max(...Object.values(depths));
    output(`Max depth: ${maxDepth}`);
    output(`Parallel tasks: ${countParallelTasks(graph, depths)}`);
  } else {
    throw new ValidationError('Task validation failed', errors.join('\n   '));
  }
}

/**
 * Config command - manage squad configuration
 */
function configCommand(action, ...args) {
  const config = loadConfig();
  
  switch(action) {
    case 'show':
    case undefined:
      if (jsonOutput) {
        outputJson(config);
      } else {
        output('\n⚙️  DSH Squad Configuration\n');
        output('Default Model:', config.defaultModel);
        output('\nAgents:\n');
        
        const agents = Object.entries(config.agents);
        if (agents.length === 0) {
          output('  (using default model for all agents)\n');
        } else {
          for (const [name, cfg] of agents) {
            output(`  ${name}:`);
            output(`    model: ${cfg.model || '(default)'}`);
            if (cfg.thinking) {
              output(`    thinking: ${cfg.thinking}`);
            }
          }
        }
        
        output('\nSettings:\n');
        const settings = config.settings;
        output(`  Max parallel tasks: ${settings.maxParallelTasks}`);
        output(`  Task timeout: ${settings.taskTimeout}ms`);
        output(`  Retry attempts: ${settings.retryAttempts}`);
        output(`  QA enabled: ${settings.enableQA}`);
        output(`  Health check: ${settings.enableHealthCheck}\n`);
      }
      break;
      
    case 'get': {
      const agentName = args[0];
      if (!agentName) {
        throw new CommandError('Agent name required');
      }
      
      const agentConfig = config.agents[agentName];
      if (!agentConfig) {
        output(`${agentName}: using default model (${config.defaultModel})`);
        return;
      }
      
      output(`\n${agentName} Configuration:\n`);
      output(`  model: ${agentConfig.model || config.defaultModel}`);
      if (agentConfig.thinking) {
        output(`  thinking: ${agentConfig.thinking}`);
      }
      break;
    }
      
    case 'set': {
      const [agentName, property, value] = args;
      if (!agentName || !property || !value) {
        throw new CommandError('Usage: config set <agent> <property> <value>');
      }
      
      const configPath = join(__dirname, '..', 'config', 'squad.config.json');
      
      if (!config.agents[agentName]) {
        config.agents[agentName] = {};
      }
      
      config.agents[agentName][property] = property === 'thinking' && value === 'enabled' ? 'enabled' : value;
      
      writeFileSync(configPath, JSON.stringify(config, null, 2));
      output(`✓ Set ${agentName}.${property} = ${value}`);
      clearAgentsCache();
      break;
    }
      
    case 'validate': {
      const errors = [];
      const agents = loadAgents();
      const agentNames = new Set(agents.map(a => a.name));
      
      for (const name of Object.keys(config.agents)) {
        if (!agentNames.has(name)) {
          errors.push(`Unknown agent: ${name}`);
        }
      }
      
      if (errors.length === 0) {
        output('✓ Configuration is valid');
      } else {
        output(`✗ Found ${errors.length} error(s):`);
        errors.forEach(err => output(`  - ${err}`));
      }
      break;
    }
      
    default:
      throw new CommandError(`Unknown config action: ${action}`);
  }
}

/**
 * Deps command - show dependency graph
 */
function depsCommand(tasksFile) {
  log('depsCommand called with file:', tasksFile);
  const tasks = loadTasks(tasksFile);
  const graph = buildDependencyGraph(tasks);
  const depths = calculateDepths(graph);
  
  if (jsonOutput) {
    outputJson({
      graph,
      depths,
      tasks: tasks.map(t => ({ id: t.id, agent: t.agent }))
    });
    return;
  }
  
  output('\n📊 Dependency Graph\n');
  
  for (const [taskId, deps] of Object.entries(graph)) {
    const prefix = deps.length === 0 ? '●' : '▼';
    output(`${prefix} ${taskId}`);
    
    if (deps.length > 0) {
      output(`  └─ requires: ${deps.join(', ')}`);
    }
  }
  
  output('\nExecution levels:\n');
  const byDepth = {};
  
  for (const [taskId, depth] of Object.entries(depths)) {
    if (!byDepth[depth]) byDepth[depth] = [];
    byDepth[depth].push(taskId);
  }
  
  for (let depth = 0; depth <= Math.max(...Object.values(depths)); depth++) {
    const tasks = byDepth[depth] || [];
    output(`Level ${depth}: ${tasks.join(', ')}`);
  }
  output();
}

// ============================================================================
// Core Logic
// ============================================================================

/**
 * Load task templates from configuration file
 * @param {string} [configPath] - Optional custom config path
 * @returns {Object} Configuration object with templates and settings
 */
function loadTaskTemplates(configPath = null) {
  const defaultConfigPath = join(__dirname, '..', 'config', 'squad-templates.json');
  const configFile = configPath || defaultConfigPath;
  
  try {
    if (existsSync(configFile)) {
      const content = readFileSync(configFile, 'utf-8');
      const config = JSON.parse(content);
      log('Loaded task templates from config:', configFile);
      return {
        templates: config.taskTemplates || [],
        defaultTemplate: config.defaultTemplate || {
          id: 'implement',
          title: 'Implement feature',
          agent: 'fullstack',
          depends: []
        },
        settings: config.settings || {
          maxSuggestions: 5,
          minMatchScore: 1,
          keywordWeight: 1.0,
          priorityWeight: 0.01
        }
      };
    }
  } catch (error) {
    console.error(`Warning: Failed to load config from ${configFile}: ${error.message}`);
  }
  
  // Fallback to default templates if config not found or invalid
  log('Using default templates (config not found or invalid)');
  return {
    templates: getDefaultTemplates(),
    defaultTemplate: {
      id: 'implement',
      title: 'Implement feature',
      agent: 'fullstack',
      depends: []
    },
    settings: {
      maxSuggestions: 5,
      minMatchScore: 1,
      keywordWeight: 1.0,
      priorityWeight: 0.01
    }
  };
}

/**
 * Get default templates when config file is not available
 * @returns {Array} Default task templates
 */
function getDefaultTemplates() {
  return [
    {
      id: 'api-design',
      keywords: ['api', 'backend', 'rest', 'graphql'],
      task: {
        id: 'design',
        title: 'Design API contract and architecture',
        agent: 'architect',
        depends: []
      },
      priority: 100
    },
    {
      id: 'backend-impl',
      keywords: ['api', 'backend', 'server', 'database'],
      task: {
        id: 'backend',
        title: 'Implement backend API',
        agent: 'backend',
        depends: ['design']
      },
      priority: 90
    },
    {
      id: 'frontend-impl',
      keywords: ['frontend', 'ui', 'react', 'vue', 'css'],
      task: {
        id: 'frontend',
        title: 'Implement frontend UI',
        agent: 'frontend',
        depends: ['design']
      },
      priority: 90
    },
    {
      id: 'qa-tests',
      keywords: ['test', 'qa', 'testing', 'unit-test', 'e2e'],
      task: {
        id: 'tests',
        title: 'Write tests',
        agent: 'qa',
        depends: []
      },
      priority: 50,
      autoDepends: true
    },
    {
      id: 'documentation',
      keywords: ['doc', 'readme', 'documentation'],
      task: {
        id: 'docs',
        title: 'Write documentation',
        agent: 'docs',
        depends: []
      },
      priority: 40,
      autoDepends: true
    }
  ];
}

/**
 * Calculate match score for a template against a goal
 * @param {Object} template - Task template
 * @param {string} lowerGoal - Lowercase goal string
 * @returns {Object} Match result with score and matched keywords
 */
function calculateTemplateScore(template, lowerGoal) {
  const matchedKeywords = template.keywords.filter(kw => lowerGoal.includes(kw.toLowerCase()));
  
  if (matchedKeywords.length === 0) {
    return { matched: false, score: 0, matchedKeywords: [] };
  }
  
  // Score = priority * matched keyword count
  const score = (template.priority || 50) * matchedKeywords.length;
  
  return {
    matched: true,
    score,
    matchedKeywords,
    template
  };
}

/**
 * Suggest tasks based on goal
 * @param {string} goal - The goal description
 * @param {string} [configPath] - Optional custom config path
 * @returns {Task[]} Suggested tasks
 */
function suggestTasks(goal, configPath = null) {
  const lower = goal.toLowerCase();
  const agents = loadAgents();
  const { templates, defaultTemplate, settings } = loadTaskTemplates(configPath);
  
  log('Suggesting tasks for goal:', goal);
  log('Available templates:', templates.length);
  
  // Match templates against goal
  const matchedResults = templates
    .map(template => calculateTemplateScore(template, lower))
    .filter(result => result.matched && result.score >= (settings.minMatchScore || 1));
  
  log('Matched templates:', matchedResults.length);
  
  // Sort by score descending
  matchedResults.sort((a, b) => b.score - a.score);
  
  // Take top N suggestions
  const topMatches = matchedResults.slice(0, settings.maxSuggestions || 5);
  
  // Extract tasks from matched templates
  const tasks = topMatches.map(match => {
    const task = { ...match.template.task };
    
    // Deep copy arrays
    if (task.depends) {
      task.depends = [...task.depends];
    }
    
    // Add temporary metadata for dependency resolution
    task._matchedKeywords = match.matchedKeywords;
    task._matchScore = match.score;
    task._autoDepends = match.template.autoDepends;
    
    return task;
  });
  
  // Process auto-dependencies for templates like tests/docs
  tasks.forEach(task => {
    // If template has autoDepends, link to implementation tasks
    if (task._autoDepends) {
      const implTasks = tasks.filter(t => 
        t.id !== task.id && 
        t.agent !== 'architect' && 
        !t._autoDepends
      );
      
      if (implTasks.length > 0) {
        task.depends = implTasks.map(t => t.id);
      }
    }
  });
  
  // Validate dependencies exist in task list
  const taskIds = new Set(tasks.map(t => t.id));
  tasks.forEach(task => {
    if (task.depends && task.depends.length > 0) {
      task.depends = task.depends.filter(depId => taskIds.has(depId));
    }
    // Remove empty depends array
    if (task.depends && task.depends.length === 0) {
      delete task.depends;
    }
  });
  
  // Clean up internal metadata
  tasks.forEach(task => {
    delete task._matchedKeywords;
    delete task._matchScore;
    delete task._autoDepends;
  });
  
  // Default if no matches
  if (tasks.length === 0 && defaultTemplate) {
    tasks.push({ ...defaultTemplate });
    log('No matches, using default template');
  }
  
  log('Generated', tasks.length, 'tasks');
  
  return tasks;
}

/**
 * Print tasks in formatted way
 */
function printTasks(tasks) {
  for (const task of tasks) {
    const deps = (task.depends || []).join(', ');
    output(`● ${task.id} (${task.agent})`);
    output(`  ${task.title}`);
    if (deps) {
      output(`  Depends: ${deps}`);
    }
    output();
  }
}

/**
 * Print execution order by levels
 */
function printExecutionOrder(tasks) {
  const graph = buildDependencyGraph(tasks);
  const depths = calculateDepths(graph);
  const byDepth = {};
  
  for (const [taskId, depth] of Object.entries(depths)) {
    if (!byDepth[depth]) byDepth[depth] = [];
    byDepth[depth].push(taskId);
  }
  
  const maxDepth = Math.max(...Object.values(depths));
  
  for (let depth = 0; depth <= maxDepth; depth++) {
    const levelTasks = byDepth[depth] || [];
    if (levelTasks.length === 1) {
      output(`Level ${depth}: ${levelTasks[0]}`);
    } else {
      output(`Level ${depth}: ${levelTasks.join(', ')} (parallel)`);
    }
  }
  
  const parallel = countParallelTasks(graph, depths);
  output(`\nMax parallelism: ${parallel} tasks`);
  output(`Total levels: ${maxDepth + 1}\n`);
}

// ============================================================================
// CLI Entry Point
// ============================================================================

function main() {
  try {
    let args = process.argv.slice(2);
    
    // Process global options first
    if (args.includes('--verbose')) {
      setVerbose(true);
      args = args.filter(arg => arg !== '--verbose');
    }
    
    if (args.includes('--quiet') || args.includes('-q')) {
      setQuiet(true);
      args = args.filter(arg => arg !== '--quiet' && arg !== '-q');
    }
    
    if (args.includes('--json')) {
      setJsonOutput(true);
      args = args.filter(arg => arg !== '--json');
    }
    
    // Handle --version
    if (args.includes('--version') || args.includes('-v')) {
      const packagePath = join(__dirname, '..', 'package.json');
      try {
        const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
        console.log(`dsh-squad v${pkg.version}`);
      } catch {
        console.log('dsh-squad v1.0.0');
      }
      process.exit(0);
    }
    
    // Handle --help
    if (args.includes('--help') || args.includes('-h')) {
      console.log(`
DSH Squad CLI - Multi-agent task orchestration helper

USAGE:
  dsh-squad <command> [options]

COMMANDS:
  plan        Generate task breakdown from a goal or file
  agents      List available specialist agents
  validate    Validate a task breakdown JSON file
  deps        Show task dependency graph
  config      Manage squad configuration

OPTIONS:
  --help, -h     Show this help message
  --version, -v  Show version information
  --verbose      Show detailed output
  --quiet, -q    Show only errors
  --json         Output in JSON format

PLAN OPTIONS:
  --goal <text>       Generate tasks from a goal description
  --tasks <file>      Analyze tasks from a JSON file

EXAMPLES:
  # Plan from goal
  dsh-squad plan --goal "Build REST API with auth and tests"
  
  # Plan from file
  dsh-squad plan --tasks my-tasks.json
  
  # List agents
  dsh-squad agents
  
  # Validate tasks
  dsh-squad validate tasks.json
  
  # Show dependencies
  dsh-squad deps tasks.json
  
  # With verbose output
  dsh-squad plan --goal "test" --verbose
  
  # Manage configuration
  dsh-squad config show
  dsh-squad config set architect model deepseek-v4.1-flash
  dsh-squad config validate

DOCUMENTATION:
  For more information, see SKILL.md or visit:
  https://github.com/picassio/pi-squad

LICENSE:
  MIT
`);
      process.exit(0);
    }
    
    if (args.length === 0) {
      console.log(`
DSH Squad CLI - Multi-agent task orchestration helper

Usage:
  dsh-squad plan --goal "..."        Generate task breakdown
  dsh-squad plan --tasks file.json   Analyze tasks
  dsh-squad agents                   List available agents
  dsh-squad validate file.json       Validate task breakdown
  dsh-squad deps file.json           Show dependency graph

Options:
  --help, -h     Show detailed help
  --version, -v  Show version
  --verbose      Show detailed output
  --quiet, -q    Show only errors
  --json         Output in JSON format

Examples:
  dsh-squad plan --goal "Build REST API with auth and tests"
  dsh-squad agents
  dsh-squad validate tasks.json
`);
      process.exit(0);
    }
    
    const command = args[0];
    
    log('Command:', command);
    log('Arguments:', args);
    
    switch (command) {
      case 'plan': {
        const goalIdx = args.indexOf('--goal');
        const tasksIdx = args.indexOf('--tasks');
        
        // Validate --goal parameter
        const goal = goalIdx !== -1 ? args[goalIdx + 1] : null;
        if (goalIdx !== -1 && !goal) {
          throw new CommandError('--goal requires a value');
        }
        
        // Validate --tasks parameter
        const tasks = tasksIdx !== -1 ? args[tasksIdx + 1] : null;
        if (tasksIdx !== -1 && !tasks) {
          throw new CommandError('--tasks requires a value');
        }
        
        planCommand(goal, tasks);
        break;
      }
      
      case 'agents':
        agentsCommand();
        break;
      
      case 'validate': {
        const file = args[1];
        if (!file) {
          throw new CommandError('Provide tasks file');
        }
        if (typeof file !== 'string') {
          throw new ValidationError('Invalid file path', `Received type: ${typeof file}`);
        }
        validateCommand(file);
        break;
      }
      
      case 'deps': {
        const file = args[1];
        if (!file) {
          throw new CommandError('Provide tasks file');
        }
        if (typeof file !== 'string') {
          throw new ValidationError('Invalid file path', `Received type: ${typeof file}`);
        }
        depsCommand(file);
        break;
      }
      
      case 'config':
        configCommand(...args.slice(1));
        break;
      
      default:
        throw new CommandError(`Unknown command: ${command}`, `Available commands: plan, agents, validate, deps, config`);
    }
  } catch (error) {
    formatError(error);
    process.exit(1);
  }
}

main();