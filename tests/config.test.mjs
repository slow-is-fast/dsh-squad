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
  unsetAgentConfig,
  loadModelCatalog,
  loadAgents,
  clearAgentsCache
} from '../lib/core.mjs';
import { ValidationError } from '../lib/errors.mjs';

const savedEnv = {
  DSH_HOME: process.env.DSH_HOME,
  SQUAD_CONFIG_PATH: process.env.SQUAD_CONFIG_PATH,
  SQUAD_MODELS_PATH: process.env.SQUAD_MODELS_PATH,
  USERPROFILE: process.env.USERPROFILE,
  HOME: process.env.HOME
};

let dir;
let overlayPath;
let projectPath;
let modelsPath;
const TEST_MODELS = [
  'new-model', 'qa-model', 'written-model', 'before-model', 'after-model',
  'project-model', 'catalog-model', 'tools-model'
];

function writeCatalog(models) {
  writeFileSync(modelsPath, JSON.stringify({ providers: { test: models } }), 'utf-8');
  process.env.SQUAD_MODELS_PATH = modelsPath;
}

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
    modelsPath = join(dir, 'models.json');

    process.env.DSH_HOME = dir;
    process.env.SQUAD_CONFIG_PATH = projectPath;
    writeCatalog(TEST_MODELS);

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
    modelsPath = join(dir, 'models.json');

    process.env.DSH_HOME = dir;
    process.env.SQUAD_CONFIG_PATH = projectPath;
    writeCatalog(TEST_MODELS);

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

function setupWriteEnv(prefix) {
  dir = mkdtempSync(join(tmpdir(), prefix));
  overlayPath = join(dir, 'dsh-squad.json');
  projectPath = join(dir, 'squad.config.json');
  modelsPath = join(dir, 'models.json');

  process.env.DSH_HOME = dir;
  process.env.SQUAD_CONFIG_PATH = projectPath;
  writeCatalog(TEST_MODELS);

  writeFileSync(projectPath, JSON.stringify({
    agents: { backend: { model: 'project-model' } },
    defaultModel: 'project-default',
    settings: { maxParallelTasks: 9 }
  }, null, 2), 'utf-8');

  clearAgentsCache();
}

function teardownWriteEnv() {
  clearAgentsCache();
  rmSync(dir, { recursive: true, force: true });
  restoreEnv();
}

describe('model catalog validation', () => {
  beforeEach(() => setupWriteEnv('squad-config-models-'));
  afterEach(teardownWriteEnv);

  test('accepts a model listed in the catalog', () => {
    saveAgentConfig('backend', 'model', 'catalog-model');

    assert.strictEqual(loadConfig().agents.backend.model, 'catalog-model');
  });

  test('rejects an unknown model without touching the file', () => {
    const before = readFileSync(projectPath, 'utf-8');

    assert.throws(
      () => saveAgentConfig('backend', 'model', 'typo-model'),
      error => error instanceof ValidationError && /Unknown model: typo-model/.test(error.message)
    );
    assert.strictEqual(readFileSync(projectPath, 'utf-8'), before);
  });

  test('force writes an unknown model', () => {
    saveAgentConfig('backend', 'model', 'typo-model', { force: true });

    assert.strictEqual(loadConfig().agents.backend.model, 'typo-model');
  });

  test('skips the check when no catalog is available', () => {
    process.env.SQUAD_MODELS_PATH = join(dir, 'no-such-models.json');

    saveAgentConfig('backend', 'model', 'anything-goes');

    assert.strictEqual(loadConfig().agents.backend.model, 'anything-goes');
  });

  test('maps models to their providers', () => {
    writeFileSync(modelsPath, JSON.stringify({
      providers: { alpha: ['m1'], beta: ['m1', 'm2'] }
    }), 'utf-8');

    const catalog = loadModelCatalog();

    assert.strictEqual(catalog.path, modelsPath);
    assert.deepStrictEqual(
      [...catalog.models.entries()].sort(),
      [['m1', ['alpha', 'beta']], ['m2', ['beta']]]
    );
  });

  test('returns null for a broken catalog instead of throwing', () => {
    writeFileSync(modelsPath, '{ broken', 'utf-8');

    const originalError = console.error;
    console.error = () => {};
    let catalog;
    try {
      catalog = loadModelCatalog();
    } finally {
      console.error = originalError;
    }

    assert.strictEqual(catalog, null);
  });
});

describe('tools property', () => {
  beforeEach(() => setupWriteEnv('squad-config-tools-'));
  afterEach(teardownWriteEnv);

  test('accepts a comma-separated list', () => {
    saveAgentConfig('backend', 'tools', 'read, write');

    assert.deepStrictEqual(
      JSON.parse(readFileSync(projectPath, 'utf-8')).agents.backend.tools,
      ['read', 'write']
    );
  });

  test('accepts a JSON array', () => {
    saveAgentConfig('backend', 'tools', '["read","edit"]');

    assert.deepStrictEqual(loadConfig().agents.backend.tools, ['read', 'edit']);
  });

  test('is applied by loadAgents', () => {
    saveAgentConfig('backend', 'tools', 'read');

    assert.deepStrictEqual(loadAgents().find(a => a.name === 'backend').tools, ['read']);
  });

  test('round-trips through the DSH overlay format', () => {
    writeOverlay({
      backend: { inherit: true, routes: [{ model: 'catalog-model' }], tools: ['read', 'write'] }
    });

    assert.deepStrictEqual(loadConfig().agents.backend.tools, ['read', 'write']);
    assert.deepStrictEqual(loadAgents().find(a => a.name === 'backend').tools, ['read', 'write']);
  });

  test('rejects an empty list', () => {
    assert.throws(() => saveAgentConfig('backend', 'tools', ''), ValidationError);
    assert.throws(() => saveAgentConfig('backend', 'tools', '[]'), ValidationError);
    assert.throws(() => saveAgentConfig('backend', 'tools', ',,'), ValidationError);
  });

  test('rejects malformed JSON', () => {
    assert.throws(
      () => saveAgentConfig('backend', 'tools', '["read",'),
      error => error instanceof ValidationError && /Invalid tools JSON/.test(error.message)
    );
  });
});

describe('unsetAgentConfig', () => {
  beforeEach(() => setupWriteEnv('squad-config-unset-'));
  afterEach(teardownWriteEnv);

  test('removes one property and keeps the rest', () => {
    saveAgentConfig('backend', 'thinking', 'enabled');

    const result = unsetAgentConfig('backend', 'thinking');

    assert.strictEqual(result.removed, true);
    assert.deepStrictEqual(
      JSON.parse(readFileSync(projectPath, 'utf-8')).agents.backend,
      { model: 'project-model' }
    );
  });

  test('removes the whole agent entry', () => {
    const result = unsetAgentConfig('backend');

    assert.strictEqual(result.removed, true);
    assert.strictEqual(
      'backend' in JSON.parse(readFileSync(projectPath, 'utf-8')).agents,
      false
    );
  });

  test('is idempotent for an already unset property', () => {
    const before = readFileSync(projectPath, 'utf-8');

    const result = unsetAgentConfig('backend', 'tools');

    assert.strictEqual(result.removed, false);
    assert.strictEqual(readFileSync(projectPath, 'utf-8'), before);
  });

  test('removes thinking from the overlay but keeps the model', () => {
    writeOverlay({
      backend: {
        inherit: true,
        routes: [{ provider: 'bailian-tpp', model: 'catalog-model' }],
        thinking: 'enabled'
      }
    });

    unsetAgentConfig('backend', 'thinking');

    assert.deepStrictEqual(readOverlay().roles.backend, {
      inherit: true,
      routes: [{ provider: 'bailian-tpp', model: 'catalog-model' }]
    });
  });

  test('removing the model from the overlay drops the unusable route', () => {
    writeOverlay({
      backend: { inherit: true, routes: [{ model: 'catalog-model' }] }
    });

    unsetAgentConfig('backend', 'model');

    assert.deepStrictEqual(readOverlay().roles.backend.routes, []);
    // The overlay still wins over the skill config, but a role without a route
    // no longer resolves, so the agent falls back to defaultModel.
    assert.strictEqual(loadConfig().agents.backend, undefined);
    assert.strictEqual(loadAgents().find(a => a.name === 'backend').model, 'glm-5.3');
  });

  test('removes a whole overlay role', () => {
    writeOverlay({ backend: { inherit: true, routes: [{ model: 'catalog-model' }] } });

    const result = unsetAgentConfig('backend');

    assert.strictEqual(result.removed, true);
    assert.strictEqual('backend' in readOverlay().roles, false);
  });

  test('rejects an unknown agent', () => {
    assert.throws(
      () => unsetAgentConfig('ghost'),
      error => error instanceof ValidationError && /Unknown agent/.test(error.message)
    );
  });

  test('rejects an unknown property', () => {
    assert.throws(
      () => unsetAgentConfig('backend', 'temperature'),
      error => error instanceof ValidationError && /Unknown property/.test(error.message)
    );
  });
});