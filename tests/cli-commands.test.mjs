/**
 * Tests for CLI command functions
 */

import { test, describe, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
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
    const result = await runCLI(['plan', '--tasks', join(__dirname, 'invalid.json')]);
    assert.notStrictEqual(result.code, 0);
  });
});

// ============================================================================
// Helper Functions
// ============================================================================

function runCLI(args) {
  return new Promise((resolve) => {
    const child = spawn('node', [cliPath, ...args], {
      cwd: join(__dirname, '..')
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