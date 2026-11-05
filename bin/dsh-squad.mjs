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

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { 
  loadTasks, 
  loadAgents, 
  loadConfig,
  saveAgentConfig,
  configSource,
  validateTasks, 
  buildDependencyGraph, 
  detectCycles, 
  calculateDepths, 
  countParallelTasks 
} from '../lib/core.mjs';
import { suggestTasks } from '../lib/templates.mjs';
import { SquadError, ValidationError, CommandError } from '../lib/errors.mjs';

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
    const thinking = agent.thinking ? ` (thinking: ${agent.thinking})` : '';
    output(`${agent.name.padEnd(12)} - ${agent.role}`);
    output(`             Model: ${agent.model}${thinking}`);
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
    const depthValues = Object.values(depths);
    const maxDepth = depthValues.length === 0 ? 0 : Math.max(...depthValues);
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
        const source = configSource();
        output('\n⚙️  DSH Squad Configuration\n');
        output(`Config file: ${source.path}`);
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

      const { path } = saveAgentConfig(agentName, property, value);
      output(`✓ Set ${agentName}.${property} = ${value}`);
      output(`  Written to: ${path}`);
      break;
    }
      
    case 'validate': {
      const errors = [];
      const agentNames = new Set(loadAgents().map(a => a.name));

      for (const name of Object.keys(config.agents)) {
        if (!agentNames.has(name)) {
          errors.push(`Unknown agent: ${name}`);
        }
      }

      for (const [name, cfg] of Object.entries(config.agents)) {
        if (cfg.model !== undefined && (typeof cfg.model !== 'string' || cfg.model.trim() === '')) {
          errors.push(`Agent ${name} has an invalid model value`);
        }
        if (cfg.thinking != null && cfg.thinking !== 'enabled' && cfg.thinking !== 'disabled') {
          errors.push(`Agent ${name} has invalid thinking value: ${cfg.thinking}`);
        }
      }

      const source = configSource();
      output(`Config file: ${source.path}`);

      if (errors.length === 0) {
        output('✓ Configuration is valid');
      } else {
        output(`✗ Found ${errors.length} error(s):`);
        errors.forEach(err => output(`  - ${err}`));
        process.exit(1);
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
  
  const depthValues = Object.values(depths);
  const maxDepth = depthValues.length === 0 ? -1 : Math.max(...depthValues);

  for (let depth = 0; depth <= maxDepth; depth++) {
    const levelTasks = byDepth[depth] || [];
    output(`Level ${depth}: ${levelTasks.join(', ')}`);
  }
  output();
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
  
  const depthValues = Object.values(depths);
  const maxDepth = depthValues.length === 0 ? -1 : Math.max(...depthValues);
  
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
        console.log('dsh-squad v0.0.0');
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
  https://github.com/slow-is-fast/dsh-squad

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
