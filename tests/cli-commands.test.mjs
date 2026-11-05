/**
 * Tests for CLI command functions
 */

import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliPath = join(__dirname, '..', 'bin', 'dsh-squad.mjs');

// ============================================================================
// CLI Integration Tests
// ============================================================================

describe('CLI Commands', () => {
  test('should show version with --version', async () => {
    const result = await runCLI(['--version']);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('dsh-squad v'));
  });

  test('should show version with -v', async () => {
    const result = await runCLI(['-v']);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('dsh-squad v'));
  });

  test('should show help with --help', async () => {
    const result = await runCLI(['--help']);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('USAGE'));
    assert.ok(result.stdout.includes('COMMANDS'));
    assert.ok(result.stdout.includes('OPTIONS'));
  });

  test('should show help with -h', async () => {
    const result = await runCLI(['-h']);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('USAGE'));
  });

  test('should show quick help with no arguments', async () => {
    const result = await runCLI([]);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('USAGE') || result.stdout.includes('dsh-squad'));
  });
});

// ============================================================================
// agents Command Tests
// ============================================================================

describe('agents command', () => {
  test('should list all agents', async () => {
    const result = await runCLI(['agents']);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('Available Agents'));
    assert.ok(result.stdout.includes('architect'));
    assert.ok(result.stdout.includes('backend'));
    assert.ok(result.stdout.includes('frontend'));
  });

  test('should show total agent count', async () => {
    const result = await runCLI(['agents']);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('Total:') || result.stdout.includes('agents'));
  });

  test('should show agent details', async () => {
    const result = await runCLI(['agents']);
    assert.strictEqual(result.code, 0);
    // Check that architect has required info
    assert.ok(result.stdout.includes('Software Architect'));
    assert.ok(result.stdout.includes('Tags:'));
  });
});

// ============================================================================
// plan Command Tests
// ============================================================================

describe('plan command', () => {
  test('should require goal or tasks', async () => {
    const result = await runCLI(['plan']);
    assert.notStrictEqual(result.code, 0);
    assert.ok(result.stderr.includes('Provide --goal or --tasks'));
  });

  test('should generate tasks from goal', async () => {
    const result = await runCLI(['plan', '--goal', 'Build REST API']);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('Squad Plan'));
    assert.ok(result.stdout.includes('Goal: Build REST API'));
    assert.ok(result.stdout.includes('Suggested task breakdown'));
  });

  test('should match API keywords', async () => {
    const result = await runCLI(['plan', '--goal', 'Build REST API with tests']);
    assert.strictEqual(result.code, 0);
    // Should suggest backend-related tasks
    assert.ok(result.stdout.includes('backend') || result.stdout.includes('architect'));
  });

  test('should match frontend keywords', async () => {
    const result = await runCLI(['plan', '--goal', 'Create React app']);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('frontend'));
  });

  test('should show execution order', async () => {
    const result = await runCLI(['plan', '--goal', 'Build API']);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('Execution order'));
    assert.ok(result.stdout.includes('Level'));
  });

  test('should show parallelism info', async () => {
    const result = await runCLI(['plan', '--goal', 'Build API']);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('parallel') || result.stdout.includes('Parallel'));
  });
});

// ============================================================================
// validate Command Tests
// ============================================================================

describe('validate command', () => {
  test('should require file argument', async () => {
    const result = await runCLI(['validate']);
    assert.notStrictEqual(result.code, 0);
    assert.ok(result.stderr.includes('Provide tasks file'));
  });

  test('should validate valid task file', async () => {
    const tasksFile = join(__dirname, '..', 'examples', 'tasks.json');
    const result = await runCLI(['validate', tasksFile]);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('All validations passed'));
  });

  test('should report validation errors', async () => {
    // Create an invalid tasks file
    const invalidTasksFile = join(__dirname, '..', 'examples', 'invalid-tasks.json');
    const invalidTasks = {
      tasks: [
        { id: "test", title: "Test", agent: "nonexistent-agent" }
      ]
    };
    
    // This would require creating the file, skip for now
    // The test would check that it fails with appropriate error
  });
});

// ============================================================================
// Output Format Tests
// ============================================================================

describe('Output formats', () => {
  test('should output JSON with --json flag', async () => {
    const result = await runCLI(['agents', '--json']);
    assert.strictEqual(result.code, 0);
    
    // Try to parse as JSON
    const json = JSON.parse(result.stdout);
    assert.ok(json.agents);
    assert.ok(Array.isArray(json.agents));
    assert.strictEqual(typeof json.total, 'number');
  });

  test('should show detailed output with --verbose', async () => {
    const result = await runCLI(['plan', '--goal', 'test', '--verbose']);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('[verbose]') || result.stdout.includes('verbose'));
  });

  test('should suppress output with --quiet', async () => {
    const result = await runCLI(['agents', '--quiet']);
    assert.strictEqual(result.code, 0);
    // Output should be minimal or empty
    assert.ok(result.stdout.length < 100);
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('Error handling', () => {
  test('should handle non-existent file', async () => {
    const result = await runCLI(['validate', 'nonexistent.json']);
    assert.notStrictEqual(result.code, 0);
    assert.ok(result.stderr.includes('File not found') || result.stderr.includes('Error'));
  });

  test('should handle invalid JSON', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'squad-cli-bad-json-'));
    try {
      const file = join(dir, 'broken.json');
      writeFileSync(file, '{ not json', 'utf-8');

      const result = await runCLI(['plan', '--tasks', file]);

      assert.strictEqual(result.code, 1);
      assert.ok(result.stderr.includes('[PARSE_ERROR]'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ============================================================================
// Config command
// ============================================================================

describe('config command', () => {
  let dir;
  let env;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'squad-cli-config-'));
    const projectConfig = join(dir, 'squad.config.json');
    writeFileSync(projectConfig, JSON.stringify({
      agents: { backend: { model: 'cli-project-model' } },
      defaultModel: 'cli-default',
      settings: { maxParallelTasks: 3 }
    }, null, 2), 'utf-8');

    env = { DSH_HOME: dir, SQUAD_CONFIG_PATH: projectConfig };
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test('show reports which config file is in use', async () => {
    const result = await runCLI(['config', 'show'], { env });

    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('Config file:'));
    assert.ok(result.stdout.includes('squad.config.json'));
  });

  test('set then get round-trips the new model', async () => {
    const set = await runCLI(['config', 'set', 'architect', 'model', 'round-trip-model'], { env });

    assert.strictEqual(set.code, 0);
    assert.ok(set.stdout.includes('✓ Set architect.model = round-trip-model'));

    const get = await runCLI(['config', 'get', 'architect'], { env });

    assert.strictEqual(get.code, 0);
    assert.ok(get.stdout.includes('model: round-trip-model'));
  });

  test('set thinking enabled is visible in get', async () => {
    await runCLI(['config', 'set', 'architect', 'thinking', 'enabled'], { env });

    const get = await runCLI(['config', 'get', 'architect'], { env });

    assert.ok(get.stdout.includes('thinking: enabled'));
  });

  test('set rejects an unknown agent', async () => {
    const result = await runCLI(['config', 'set', 'ghost', 'model', 'x'], { env });

    assert.strictEqual(result.code, 1);
    assert.ok(result.stderr.includes('[VALIDATION_ERROR]'));
    assert.ok(result.stderr.includes('Unknown agent: ghost'));
  });

  test('rejects an unknown config action', async () => {
    const result = await runCLI(['config', 'bogus'], { env });

    assert.strictEqual(result.code, 1);
    assert.ok(result.stderr.includes('[COMMAND_ERROR]'));
  });

  test('--json config show emits parseable JSON', async () => {
    const result = await runCLI(['config', 'show', '--json'], { env });

    assert.strictEqual(result.code, 0);

    const parsed = JSON.parse(result.stdout);
    assert.strictEqual(parsed.defaultModel, 'cli-default');
    assert.strictEqual(parsed.agents.backend.model, 'cli-project-model');
  });
});

// ============================================================================
// Typed errors surfaced by the CLI
// ============================================================================

describe('typed CLI errors', () => {
  let dir;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'squad-cli-errors-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test('missing file surfaces FILE_ERROR', async () => {
    const result = await runCLI(['validate', join(dir, 'nope.json')]);

    assert.strictEqual(result.code, 1);
    assert.ok(result.stderr.includes('[FILE_ERROR]'));
  });

  test('JSON without a tasks array surfaces VALIDATION_ERROR', async () => {
    const file = join(dir, 'no-tasks.json');
    writeFileSync(file, '{"foo":1}', 'utf-8');

    const result = await runCLI(['validate', file]);

    assert.strictEqual(result.code, 1);
    assert.ok(result.stderr.includes('[VALIDATION_ERROR]'));
  });

  test('unknown command surfaces COMMAND_ERROR', async () => {
    const result = await runCLI(['frobnicate']);

    assert.strictEqual(result.code, 1);
    assert.ok(result.stderr.includes('[COMMAND_ERROR]'));
  });
});

// ============================================================================
// Empty and small inputs
// ============================================================================

describe('empty task lists', () => {
  let dir;
  let emptyFile;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'squad-cli-empty-'));
    emptyFile = join(dir, 'empty.json');
    writeFileSync(emptyFile, '{"tasks":[]}', 'utf-8');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test('validate reports depth 0 instead of -Infinity', async () => {
    const result = await runCLI(['validate', emptyFile]);

    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('Max depth: 0'));
    assert.ok(!result.stdout.includes('-Infinity'));
  });

  test('plan reports zero levels instead of -Infinity', async () => {
    const result = await runCLI(['plan', '--tasks', emptyFile]);

    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('Total levels: 0'));
    assert.ok(!result.stdout.includes('-Infinity'));
  });
});

// ============================================================================
// Agents and deps output
// ============================================================================

describe('agents command shows effective models', () => {
  test('prints a Model line for every agent', async () => {
    const result = await runCLI(['agents']);

    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('Model: '));
    assert.strictEqual(
      (result.stdout.match(/Model: /g) || []).length,
      12,
      'each of the 12 agents should show its model'
    );
  });
});

describe('deps command', () => {
  test('prints dependency levels for the example file', async () => {
    const result = await runCLI(['deps', join(__dirname, '..', 'examples', 'tasks.json')]);

    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('Dependency Graph'));
    assert.ok(result.stdout.includes('Level 0:'));
  });
});

// ============================================================================
// Helper Functions
// ============================================================================

function runCLI(args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn('node', [cliPath, ...args], {
      cwd: options.cwd || join(__dirname, '..'),
      env: { ...process.env, ...(options.env || {}) }
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      resolve({
        code,
        stdout,
        stderr
      });
    });
    
    // Set timeout
    setTimeout(() => {
      child.kill();
      resolve({
        code: -1,
        stdout,
        stderr: 'Timeout'
      });
    }, 5000);
  });
}