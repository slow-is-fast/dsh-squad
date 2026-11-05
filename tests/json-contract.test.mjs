/**
 * Every command that accepts --json must print parseable JSON, never silence.
 *
 * This suite exists because several commands used to swallow --json: output()
 * is suppressed in JSON mode, so a command without a JSON branch exited 0 with
 * zero bytes on stdout.
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { repoRoot, runCLI } from './helpers/run-cli.mjs';

const examplesTasks = join(repoRoot, 'examples', 'tasks.json');

async function jsonResult(args, env) {
  const result = await runCLI([...args, '--json'], env ? { env } : {});

  assert.strictEqual(result.code, 0, `${args.join(' ')} failed: ${result.stderr}`);
  assert.notStrictEqual(
    result.stdout.trim(),
    '',
    `${args.join(' ')} --json produced no output`
  );

  return JSON.parse(result.stdout);
}

describe('--json contract', () => {
  test('agents returns the full agent list', async () => {
    const data = await jsonResult(['agents']);

    assert.strictEqual(data.total, 12);
    assert.strictEqual(data.agents.length, 12);
  });

  test('deps returns the dependency graph', async () => {
    const data = await jsonResult(['deps', examplesTasks]);

    assert.ok(Object.keys(data.graph).length > 0);
  });

  test('validate returns a success verdict', async () => {
    const data = await jsonResult(['validate', examplesTasks]);

    assert.strictEqual(data.success, true);
    assert.deepStrictEqual(data.errors, []);
  });

  test('plan --goal returns the suggested tasks', async () => {
    const data = await jsonResult(['plan', '--goal', 'build a REST API with auth and tests']);

    assert.strictEqual(data.goal, 'build a REST API with auth and tests');
    assert.deepStrictEqual(
      data.tasks.map(task => task.id),
      ['design', 'backend', 'frontend', 'security', 'tests']
    );
  });

  test('plan --tasks returns the task file', async () => {
    const data = await jsonResult(['plan', '--tasks', examplesTasks]);

    assert.strictEqual(data.goal, null);
    assert.ok(data.tasks.length > 0);
    assert.ok(data.tasks.every(task => typeof task.id === 'string'));
  });
});

describe('--json contract: config commands', () => {
  let dir;
  let env;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'squad-json-contract-'));
    const projectConfig = join(dir, 'squad.config.json');
    writeFileSync(projectConfig, JSON.stringify({
      agents: { backend: { model: 'cli-project-model' } },
      defaultModel: 'cli-default',
      settings: { maxParallelTasks: 3 }
    }, null, 2), 'utf-8');

    const modelsFile = join(dir, 'models.json');
    writeFileSync(modelsFile, JSON.stringify({
      providers: { test: ['cli-project-model', 'json-model'] }
    }), 'utf-8');

    env = { DSH_HOME: dir, SQUAD_CONFIG_PATH: projectConfig, SQUAD_MODELS_PATH: modelsFile };
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test('config show returns the config object', async () => {
    const data = await jsonResult(['config', 'show'], env);

    assert.strictEqual(data.defaultModel, 'cli-default');
    assert.strictEqual(data.agents.backend.model, 'cli-project-model');
  });

  test('config get returns the resolved agent', async () => {
    const data = await jsonResult(['config', 'get', 'backend'], env);

    assert.strictEqual(data.agent, 'backend');
    assert.strictEqual(data.configured, true);
    assert.strictEqual(data.model, 'cli-project-model');
    assert.strictEqual(data.defaultModel, 'cli-default');
  });

  test('config get reports an unconfigured agent', async () => {
    const data = await jsonResult(['config', 'get', 'architect'], env);

    assert.strictEqual(data.configured, false);
    assert.strictEqual(data.model, 'cli-default');
  });

  test('config list returns one entry per agent', async () => {
    const data = await jsonResult(['config', 'list'], env);

    assert.strictEqual(data.agents.length, 12);
    assert.strictEqual(data.defaultModel, 'cli-default');
    assert.strictEqual(data.catalog.models, 2);
  });

  test('config models returns the catalog', async () => {
    const data = await jsonResult(['config', 'models'], env);

    assert.strictEqual(data.total, 2);
    assert.deepStrictEqual(data.models['json-model'], ['test']);
    assert.ok(data.source.endsWith('models.json'));
  });

  test('config set reports what it wrote', async () => {
    const data = await jsonResult(['config', 'set', 'architect', 'thinking', 'enabled'], env);

    assert.deepStrictEqual(data, {
      agent: 'architect',
      property: 'thinking',
      value: 'enabled',
      path: join(dir, 'squad.config.json'),
      forced: false
    });
  });

  test('config unset reports what was removed', async () => {
    await runCLI(['config', 'set', 'architect', 'thinking', 'enabled'], { env });

    const data = await jsonResult(['config', 'unset', 'architect', 'thinking'], env);

    assert.strictEqual(data.removed, true);
    assert.strictEqual(data.agent, 'architect');
    assert.strictEqual(data.property, 'thinking');
  });

  test('config validate reports failures as JSON and exits 1', async () => {
    await runCLI(['config', 'set', 'architect', 'model', 'typo-model', '--force'], { env });

    const result = await runCLI(['config', 'validate', '--json'], { env });

    assert.strictEqual(result.code, 1);

    const data = JSON.parse(result.stdout);
    assert.strictEqual(data.success, false);
    assert.ok(data.errors[0].includes("unknown model 'typo-model'"));
  });
});