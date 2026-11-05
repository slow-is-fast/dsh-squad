/**
 * Goal-to-task suggestion: template matching and dependency wiring.
 *
 * Extracted from bin/dsh-squad.mjs so the behaviour can be tested directly
 * instead of through a reimplementation.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ValidationError } from './errors.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_TEMPLATES_PATH = join(__dirname, '..', 'config', 'squad-templates.json');

const DEFAULT_TEMPLATE_SETTINGS = {
  maxSuggestions: 5,
  minMatchScore: 1,
  keywordWeight: 1.0,
  priorityWeight: 0.01
};

const FALLBACK_DEFAULT_TEMPLATE = {
  id: 'implement',
  title: 'Implement feature',
  agent: 'fullstack',
  depends: []
};

/**
 * Get default templates when config file is not available
 * @returns {Array} Default task templates
 */
export function getDefaultTemplates() {
  return [
    {
      id: 'planning',
      keywords: ['plan', 'planning', 'roadmap', 'milestone', 'breakdown', 'coordinate', 'schedule'],
      task: {
        id: 'plan',
        title: 'Plan task breakdown and sequencing',
        description: 'Break the work into ordered milestones, identify dependencies and parallelizable parts',
        agent: 'planner',
        depends: []
      },
      priority: 95
    },
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
 * Load task templates from configuration file
 * @param {string|null} [configPath] - Optional custom config path
 * @param {Function} [debug] - Optional verbose logger
 * @returns {Object} Configuration object with templates and settings
 */
export function loadTaskTemplates(configPath = null, debug = () => {}) {
  const configFile = configPath || DEFAULT_TEMPLATES_PATH;

  try {
    if (existsSync(configFile)) {
      const config = JSON.parse(readFileSync(configFile, 'utf-8'));
      debug('Loaded task templates from config:', configFile);
      return {
        templates: config.taskTemplates || [],
        defaultTemplate: config.defaultTemplate || { ...FALLBACK_DEFAULT_TEMPLATE },
        settings: { ...DEFAULT_TEMPLATE_SETTINGS, ...(config.settings || {}) }
      };
    }
  } catch (error) {
    console.error(`Warning: Failed to load config from ${configFile}: ${error.message}`);
  }

  // Fallback to default templates if config not found or invalid
  debug('Using default templates (config not found or invalid)');
  return {
    templates: getDefaultTemplates(),
    defaultTemplate: { ...FALLBACK_DEFAULT_TEMPLATE },
    settings: { ...DEFAULT_TEMPLATE_SETTINGS }
  };
}

/**
 * Calculate match score for a template against a goal
 * @param {Object} template - Task template
 * @param {string} lowerGoal - Lowercase goal string
 * @returns {Object} Match result with score and matched keywords
 */
export function calculateTemplateScore(template, lowerGoal) {
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
 * @param {Object} [options]
 * @param {string|null} [options.configPath] - Optional custom templates path
 * @param {Function} [options.debug] - Optional verbose logger
 * @returns {Array} Suggested tasks, ordered by match score
 */
export function suggestTasks(goal, options = {}) {
  if (typeof goal !== 'string') {
    throw new ValidationError(`suggestTasks expects a goal string, got ${typeof goal}`);
  }

  const { configPath = null, debug = () => {} } = options;
  const lower = goal.toLowerCase();
  const { templates, defaultTemplate, settings } = loadTaskTemplates(configPath, debug);

  debug('Suggesting tasks for goal:', goal);
  debug('Available templates:', templates.length);

  // Match templates against goal
  const matchedResults = templates
    .map(template => calculateTemplateScore(template, lower))
    .filter(result => result.matched && result.score >= (settings.minMatchScore || 1));

  debug('Matched templates:', matchedResults.length);

  // Highest score first; ties keep config file order (Array.prototype.sort is stable)
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
  for (const task of tasks) {
    if (!task._autoDepends) continue;

    const implTasks = tasks.filter(t =>
      t.id !== task.id &&
      t.agent !== 'architect' &&
      !t._autoDepends
    );

    if (implTasks.length > 0) {
      task.depends = implTasks.map(t => t.id);
    }
  }

  // Drop dependencies on tasks that were not suggested
  const taskIds = new Set(tasks.map(t => t.id));
  for (const task of tasks) {
    if (task.depends && task.depends.length > 0) {
      task.depends = task.depends.filter(depId => taskIds.has(depId));
    }
    if (task.depends && task.depends.length === 0) {
      delete task.depends;
    }
  }

  // Clean up internal metadata
  for (const task of tasks) {
    delete task._matchedKeywords;
    delete task._matchScore;
    delete task._autoDepends;
  }

  // Default if no matches
  if (tasks.length === 0 && defaultTemplate) {
    tasks.push({ ...defaultTemplate });
    debug('No matches, using default template');
  }

  debug('Generated', tasks.length, 'tasks');

  return tasks;
}