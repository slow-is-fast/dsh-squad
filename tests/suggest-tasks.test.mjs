/**
 * Task suggestion tests.
 *
 * These call the real suggestTasks() from lib/templates.mjs. The previous
 * version re-implemented keyword matching inside the test file, so it tested
 * a copy of the logic rather than the logic itself.
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  suggestTasks,
  calculateTemplateScore,
  loadTaskTemplates
} from '../lib/templates.mjs';
import { loadAgents } from '../lib/core.mjs';
import { ValidationError } from '../lib/errors.mjs';

describe('calculateTemplateScore', () => {
  test('scores priority times matched keyword count', () => {
    const template = {
      id: 'api',
      keywords: ['api', 'backend', 'rest'],
      priority: 90
    };
    const result = calculateTemplateScore(template, 'build a backend api');

    assert.strictEqual(result.matched, true);
    assert.deepStrictEqual(result.matchedKeywords, ['api', 'backend']);
    assert.strictEqual(result.score, 180);
  });

  test('reports no match when no keyword is present', () => {
    const template = { id: 'ui', keywords: ['react'], priority: 90 };

    assert.deepStrictEqual(calculateTemplateScore(template, 'build an api'), {
      matched: false,
      score: 0,
      matchedKeywords: []
    });
  });

  test('defaults priority to 50', () => {
    const template = { id: 'x', keywords: ['api'] };

    assert.strictEqual(calculateTemplateScore(template, 'api').score, 50);
  });

  test('matching is case-insensitive', () => {
    const template = { id: 'x', keywords: ['API'], priority: 10 };

    assert.strictEqual(calculateTemplateScore(template, 'build an api').score, 10);
  });
});

describe('suggestTasks', () => {
  test('builds an ordered breakdown for a backend goal', () => {
    const tasks = suggestTasks('Build REST API with auth and tests');

    assert.deepStrictEqual(
      tasks.map(t => ({ id: t.id, agent: t.agent, depends: t.depends || [] })),
      [
        { id: 'design', agent: 'architect', depends: [] },
        { id: 'backend', agent: 'backend', depends: ['design'] },
        { id: 'frontend', agent: 'frontend', depends: ['design'] },
        { id: 'security', agent: 'security', depends: ['design'] },
        { id: 'tests', agent: 'qa', depends: ['backend', 'frontend', 'security'] }
      ]
    );
  });

  test('wires test and doc tasks to the implementation tasks', () => {
    const tasks = suggestTasks('design a react frontend with tests and docs');

    assert.deepStrictEqual(
      tasks.map(t => ({ id: t.id, depends: t.depends || [] })),
      [
        { id: 'frontend', depends: [] },
        { id: 'docs', depends: ['frontend'] },
        { id: 'tests', depends: ['frontend'] }
      ]
    );
  });

  test('falls back to the default template when nothing matches', () => {
    const tasks = suggestTasks('zzz nothing here');

    assert.deepStrictEqual(tasks, [
      {
        id: 'implement',
        title: 'Implement feature',
        description: 'Implement the requested feature with best practices',
        agent: 'fullstack',
        depends: []
      }
    ]);
  });

  test('never emits internal scoring metadata', () => {
    const tasks = suggestTasks('Build REST API with auth and tests');

    for (const task of tasks) {
      assert.deepStrictEqual(
        Object.keys(task).filter(key => key.startsWith('_')),
        []
      );
    }
  });

  test('rejects a non-string goal', () => {
    assert.throws(() => suggestTasks(null), ValidationError);
  });

  test('honours maxSuggestions from a custom template config', () => {
    const dir = mkdtempSync(join(tmpdir(), 'squad-templates-'));
    try {
      const configPath = join(dir, 'templates.json');
      writeFileSync(configPath, JSON.stringify({
        taskTemplates: [
          {
            id: 'low',
            keywords: ['widget'],
            priority: 10,
            task: { id: 'low-task', title: 'Low', agent: 'backend', depends: [] }
          },
          {
            id: 'high',
            keywords: ['widget'],
            priority: 90,
            task: { id: 'high-task', title: 'High', agent: 'qa', depends: [] }
          }
        ],
        defaultTemplate: { id: 'fallback', title: 'Fallback', agent: 'fullstack', depends: [] },
        settings: { maxSuggestions: 1, minMatchScore: 1 }
      }), 'utf-8');

      const tasks = suggestTasks('build a widget', { configPath });

      assert.deepStrictEqual(tasks.map(t => t.id), ['high-task']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('loadTaskTemplates', () => {
  let repoConfig;

  before(() => {
    repoConfig = loadTaskTemplates();
  });

  test('loads templates from the skill config file', () => {
    assert.ok(repoConfig.templates.length >= 5);
    assert.ok(repoConfig.templates.every(t => Array.isArray(t.keywords)));
    assert.strictEqual(repoConfig.settings.maxSuggestions, 5);
  });

  test('falls back to built-in templates when the file is missing', () => {
    const fallback = loadTaskTemplates(join(tmpdir(), 'definitely-missing-templates.json'));

    assert.strictEqual(fallback.templates.length, 6);
    assert.strictEqual(fallback.defaultTemplate.id, 'implement');
    assert.deepStrictEqual(fallback.settings, {
      maxSuggestions: 5,
      minMatchScore: 1,
      keywordWeight: 1.0,
      priorityWeight: 0.01
    });
  });

  test('falls back when the config file is invalid JSON', () => {
    const dir = mkdtempSync(join(tmpdir(), 'squad-bad-templates-'));
    try {
      const configPath = join(dir, 'bad.json');
      writeFileSync(configPath, '{ nope', 'utf-8');

      const fallback = loadTaskTemplates(configPath);

      assert.strictEqual(fallback.templates.length, 6);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('template integrity', () => {
  test('every template targets an agent that exists', () => {
    const agentNames = new Set(loadAgents().map(agent => agent.name));
    const { templates } = loadTaskTemplates();

    const dangling = templates
      .filter(template => !agentNames.has(template.task.agent))
      .map(template => `${template.id} -> ${template.task.agent}`);

    assert.deepStrictEqual(dangling, []);
  });

  test('suggests a planning task for a planning goal', () => {
    assert.deepStrictEqual(
      suggestTasks('plan the migration roadmap').map(t => ({ id: t.id, agent: t.agent })),
      [
        { id: 'plan', agent: 'planner' },
        { id: 'database', agent: 'backend' }
      ]
    );
  });

  test('planning suggestions carry no dependencies', () => {
    const [plan] = suggestTasks('coordinate the release schedule');

    assert.deepStrictEqual(plan, {
      id: 'plan',
      title: 'Plan task breakdown and sequencing',
      description: 'Break the work into ordered milestones, identify dependencies and parallelizable parts',
      agent: 'planner'
    });
  });
});