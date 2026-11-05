/**
 * Configuration resolution tests.
 *
 * Covers the precedence rule (DSH overlay first, skill config second) and the
 * write path: `config set` must land in the file that loadConfig() actually
 * reads, otherwise it reports success and changes nothing.
 *
 * DSH_HOME and SQUAD_CONFIG_PATH point at a temp dir so nothing here touches
 * the real ~/.dsh or the checked-in config.
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  loadConfig,
  configSource,
  saveAgentConfig,
  loadAgents,
  clearAgentsCache
} from '../lib/core.mjs';
import { ValidationError } from '../lib/errors.mjs';

const savedEnv = {
  DSH_HOME: process.env.DSH_HOME,
  SQUAD_CONFIG_PATH: process.env.SQUAD_CONFIG_PATH,
  USERPROFILE: process.env.USERPROFILE,
  HOME: process.env.HOME
};

let dir;
let overlayPath;
let projectPath;

function restoreEnv() {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function writeOverlay(roles) {
  writeFileSync(overlayPath, JSON.stringify({ version: 1, roles }, null, 2), 'utf-8');
}

function readOverlay() {
  return JSON.parse(readFileSync(overlayPath, 'utf-8'));
}

describe('config resolution', () => {
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'squad-config-'));
    overlayPath = join(dir, 'dsh-squad.json');
    projectPath = join(dir, 'squad.config.json');

    process.env.DSH_HOME = dir;
    process.env.SQUAD_CONFIG_PATH = projectPath;

    writeFileSync(projectPath, JSON.stringify({
      agents: { backend: { model: 'project-model' } },
      defaultModel: 'project-default',
      settings: { maxParallelTasks: 9 }
    }, null, 2), 'utf-8');

    clearAgentsCache();
  });

  afterEach(() => {
    clearAgentsCache();
    rmSync(dir, { recursive: true, force: true });
    restoreEnv();
  });

  test('reads the skill config when no DSH overlay exists', () => {
    assert.deepStrictEqual(configSource(), { path: projectPath, format: 'project' });

    const config = loadConfig();

    assert.strictEqual(config.defaultModel, 'project-default');
    assert.strictEqual(config.agents.backend.model, 'project-model');
  });

  test('fills in default settings missing from the skill config', () => {
    const config = loadConfig();

    assert.strictEqual(config.settings.maxParallelTasks, 9);
    assert.deepStrictEqual(
      {
        taskTimeout: config.settings.taskTimeout,
        retryAttempts: config.settings.retryAttempts,
        enableQA: config.settings.enableQA,
        enableHealthCheck: config.settings.enableHealthCheck
      },
      { taskTimeout: 600000, retryAttempts: 2, enableQA: true, enableHealthCheck: true }
    );
  });

  test('DSH overlay takes precedence over the skill config', () => {
    writeOverlay({
      backend: { inherit: true, routes: [{ provider: 'bailian-tpp', model: 'overlay-model' }] }
    });

    assert.deepStrictEqual(configSource(), { path: overlayPath, format: 'dsh' });

    const config = loadConfig();

    assert.strictEqual(config.agents.backend.model, 'overlay-model');
    assert.strictEqual(config.agents.backend.provider, 'bailian-tpp');
    assert.strictEqual(config.defaultModel, 'glm-5.3');
  });

  test('carries thinking mode from the overlay', () => {
    writeOverlay({
      architect: {
        inherit: true,
        routes: [{ model: 'thinking-model' }],
        thinking: 'enabled'
      }
    });

    const config = loadConfig();

    assert.deepStrictEqual(config.agents.architect, {
      model: 'thinking-model',
      thinking: 'enabled'
    });
  });

  test('ignores overlay roles without a usable route', () => {
    writeOverlay({
      backend: { inherit: true, routes: [] },
      qa: { inherit: true, routes: [{ provider: 'bailian' }] }
    });

    const config = loadConfig();

    assert.deepStrictEqual(config.agents, {});
  });

  test('falls back to the skill config when the overlay is broken JSON', () => {
    writeFileSync(overlayPath, '{ broken', 'utf-8');

    const warnings = [];
    const originalError = console.error;
    console.error = (...args) => warnings.push(args.join(' '));

    let config;
    try {
      config = loadConfig();
    } finally {
      console.error = originalError;
    }

    assert.strictEqual(config.agents.backend.model, 'project-model');
    assert.ok(warnings.some(line => line.includes('Failed to load DSH config')));
  });

  test('still resolves the skill config when no home directory is known', () => {
    delete process.env.DSH_HOME;
    process.env.USERPROFILE = '';
    process.env.HOME = '';

    assert.deepStrictEqual(configSource(), { path: projectPath, format: 'project' });
    assert.strictEqual(loadConfig().agents.backend.model, 'project-model');
  });
});

describe('saveAgentConfig', () => {
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'squad-config-write-'));
    overlayPath = join(dir, 'dsh-squad.json');
    projectPath = join(dir, 'squad.config.json');

    process.env.DSH_HOME = dir;
    process.env.SQUAD_CONFIG_PATH = projectPath;

    writeFileSync(projectPath, JSON.stringify({
      agents: { backend: { model: 'project-model' } },
      defaultModel: 'project-default',
      settings: { maxParallelTasks: 9 }
    }, null, 2), 'utf-8');

    clearAgentsCache();
  });

  afterEach(() => {
    clearAgentsCache();
    rmSync(dir, { recursive: true, force: true });
    restoreEnv();
  });

  test('writes into the overlay when the overlay is active', () => {
    writeOverlay({
      backend: { inherit: true, routes: [{ provider: 'bailian-tpp', model: 'old-model' }] }
    });
    const projectBefore = readFileSync(projectPath, 'utf-8');

    const result = saveAgentConfig('backend', 'model', 'new-model');

    assert.deepStrictEqual(result, { path: overlayPath, format: 'dsh' });
    assert.strictEqual(readOverlay().roles.backend.routes[0].model, 'new-model');
    assert.strictEqual(readOverlay().roles.backend.routes[0].provider, 'bailian-tpp');
    assert.strictEqual(readFileSync(projectPath, 'utf-8'), projectBefore);
    assert.strictEqual(loadConfig().agents.backend.model, 'new-model');
  });

  test('creates the overlay role when it is missing', () => {
    writeOverlay({});

    saveAgentConfig('qa', 'model', 'qa-model');

    assert.deepStrictEqual(readOverlay().roles.qa, {
      inherit: true,
      routes: [{ model: 'qa-model' }]
    });
  });

  test('writes into the skill config when no overlay exists', () => {
    const result = saveAgentConfig('backend', 'model', 'written-model');

    assert.deepStrictEqual(result, { path: projectPath, format: 'project' });

    const written = JSON.parse(readFileSync(projectPath, 'utf-8'));
    assert.strictEqual(written.agents.backend.model, 'written-model');
    assert.strictEqual(written.defaultModel, 'project-default');
    assert.strictEqual(written.settings.maxParallelTasks, 9);
    assert.ok(!existsSync(overlayPath));
  });

  test('thinking enabled is stored, disabled removes the key', () => {
    writeOverlay({ architect: { inherit: true, routes: [{ model: 'm' }] } });

    saveAgentConfig('architect', 'thinking', 'enabled');
    assert.strictEqual(readOverlay().roles.architect.thinking, 'enabled');
    assert.strictEqual(loadConfig().agents.architect.thinking, 'enabled');

    saveAgentConfig('architect', 'thinking', 'disabled');
    assert.strictEqual('thinking' in readOverlay().roles.architect, false);
    assert.strictEqual(loadConfig().agents.architect.thinking, null);
  });

  test('rejects an unknown agent without touching either file', () => {
    writeOverlay({});
    const overlayBefore = readFileSync(overlayPath, 'utf-8');

    assert.throws(
      () => saveAgentConfig('ghost', 'model', 'x'),
      error => error instanceof ValidationError && /Unknown agent/.test(error.message)
    );
    assert.strictEqual(readFileSync(overlayPath, 'utf-8'), overlayBefore);
  });

  test('rejects an unknown property', () => {
    assert.throws(
      () => saveAgentConfig('backend', 'temperature', '0.2'),
      error => error instanceof ValidationError && /Unknown property/.test(error.message)
    );
  });

  test('rejects an empty or malformed model name', () => {
    assert.throws(() => saveAgentConfig('backend', 'model', ''), ValidationError);
    assert.throws(() => saveAgentConfig('backend', 'model', 'two words'), ValidationError);
    assert.throws(() => saveAgentConfig('backend', 'model', 42), ValidationError);
  });

  test('rejects an invalid thinking value', () => {
    assert.throws(
      () => saveAgentConfig('backend', 'thinking', 'on'),
      error => error instanceof ValidationError && /Invalid thinking value/.test(error.message)
    );
  });

  test('invalidates the agent cache so loadAgents sees the new model', () => {
    writeOverlay({ backend: { inherit: true, routes: [{ model: 'before-model' }] } });

    assert.strictEqual(loadAgents().find(a => a.name === 'backend').model, 'before-model');

    saveAgentConfig('backend', 'model', 'after-model');

    assert.strictEqual(loadAgents().find(a => a.name === 'backend').model, 'after-model');
  });

  test('applies configured thinking to loadAgents', () => {
    writeOverlay({
      backend: { inherit: true, routes: [{ model: 'm' }], thinking: 'enabled' }
    });

    assert.strictEqual(loadAgents().find(a => a.name === 'backend').thinking, 'enabled');
  });
});