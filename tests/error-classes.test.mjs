/**
 * Error hierarchy tests.
 *
 * These exercise the real classes in lib/errors.mjs and the real throw sites in
 * lib/core.mjs. The previous version of this file re-declared the classes
 * locally, so it passed even if the CLI had no error handling at all.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  SquadError,
  ValidationError,
  FileError,
  ParseError,
  CommandError,
  formatError
} from '../lib/errors.mjs';
import { loadTasks, validateTasks } from '../lib/core.mjs';

describe('error classes', () => {
  test('SquadError carries message, code and details', () => {
    const error = new SquadError('boom', 'X_ERROR', 'extra context');

    assert.strictEqual(error.message, 'boom');
    assert.strictEqual(error.name, 'SquadError');
    assert.strictEqual(error.code, 'X_ERROR');
    assert.strictEqual(error.details, 'extra context');
    assert.ok(error instanceof Error);
  });

  test('SquadError defaults details to null', () => {
    assert.strictEqual(new SquadError('boom', 'X_ERROR').details, null);
  });

  test('ValidationError uses VALIDATION_ERROR', () => {
    const error = new ValidationError('bad input', 'field: id');

    assert.strictEqual(error.code, 'VALIDATION_ERROR');
    assert.strictEqual(error.name, 'ValidationError');
    assert.strictEqual(error.details, 'field: id');
    assert.ok(error instanceof SquadError);
  });

  test('FileError uses FILE_ERROR', () => {
    const error = new FileError('cannot read', '/tmp/x.json');

    assert.strictEqual(error.code, 'FILE_ERROR');
    assert.strictEqual(error.name, 'FileError');
    assert.ok(error instanceof SquadError);
  });

  test('ParseError uses PARSE_ERROR', () => {
    const error = new ParseError('bad json', 'position 1');

    assert.strictEqual(error.code, 'PARSE_ERROR');
    assert.strictEqual(error.name, 'ParseError');
    assert.ok(error instanceof SquadError);
  });

  test('CommandError uses COMMAND_ERROR', () => {
    const error = new CommandError('unknown command', 'plan, agents');

    assert.strictEqual(error.code, 'COMMAND_ERROR');
    assert.strictEqual(error.name, 'CommandError');
    assert.ok(error instanceof SquadError);
  });

  test('subclasses are distinguishable by instanceof', () => {
    const error = new FileError('missing');

    assert.ok(error instanceof FileError);
    assert.ok(!(error instanceof ValidationError));
    assert.ok(!(error instanceof ParseError));
  });
});

describe('real throw sites in lib/core.mjs', () => {
  let dir;

  before(() => {
    dir = mkdtempSync(join(tmpdir(), 'squad-errors-'));
  });

  after(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test('loadTasks rejects a non-string path as ValidationError', () => {
    assert.throws(() => loadTasks(null), ValidationError);
    assert.throws(() => loadTasks(''), ValidationError);
    assert.throws(() => loadTasks(42), ValidationError);
  });

  test('loadTasks reports a missing file as FileError', () => {
    assert.throws(
      () => loadTasks(join(dir, 'nope.json')),
      error => error instanceof FileError && /File not found/.test(error.message)
    );
  });

  test('loadTasks reports broken JSON as ParseError', () => {
    const file = join(dir, 'broken.json');
    writeFileSync(file, '{ not json', 'utf-8');

    assert.throws(
      () => loadTasks(file),
      error => error instanceof ParseError && error.code === 'PARSE_ERROR'
    );
  });

  test('loadTasks rejects JSON without a tasks array as ValidationError', () => {
    const file = join(dir, 'no-tasks.json');
    writeFileSync(file, '{"foo":1}', 'utf-8');

    assert.throws(
      () => loadTasks(file),
      error => error instanceof ValidationError && /"tasks" array/.test(error.message)
    );
  });

  test('loadTasks accepts a top-level array', () => {
    const file = join(dir, 'array.json');
    writeFileSync(file, '[{"id":"a","agent":"backend"}]', 'utf-8');

    assert.deepStrictEqual(loadTasks(file), [{ id: 'a', agent: 'backend' }]);
  });

  test('loadTasks accepts an object with a tasks array', () => {
    const file = join(dir, 'wrapped.json');
    writeFileSync(file, '{"tasks":[{"id":"a","agent":"backend"}]}', 'utf-8');

    assert.deepStrictEqual(loadTasks(file), [{ id: 'a', agent: 'backend' }]);
  });

  test('validateTasks rejects a non-array instead of throwing a TypeError', () => {
    assert.throws(
      () => validateTasks({ foo: 1 }),
      error => error instanceof ValidationError && /expects an array/.test(error.message)
    );
  });
});

describe('formatError', () => {
  function capture(fn) {
    const lines = [];
    const originalError = console.error;
    console.error = (...args) => lines.push(args.join(' '));
    try {
      fn();
    } finally {
      console.error = originalError;
    }
    return lines;
  }

  test('renders a typed error with code and details', () => {
    const lines = capture(() => formatError(new FileError('missing', '/tmp/x.json')));

    assert.deepStrictEqual(lines, [
      '\n❌ Error [FILE_ERROR]: missing',
      '   Details: /tmp/x.json',
      ''
    ]);
  });

  test('omits the details line when there are none', () => {
    const lines = capture(() => formatError(new CommandError('nope')));

    assert.deepStrictEqual(lines, ['\n❌ Error [COMMAND_ERROR]: nope', '']);
  });

  test('renders unexpected errors without a stack by default', () => {
    const saved = process.env.DEBUG;
    delete process.env.DEBUG;
    try {
      const lines = capture(() => formatError(new TypeError('boom')));

      assert.deepStrictEqual(lines, ['\n❌ Unexpected error: boom\n']);
    } finally {
      if (saved !== undefined) process.env.DEBUG = saved;
    }
  });

  test('prints the stack for unexpected errors when DEBUG is set', () => {
    const saved = process.env.DEBUG;
    process.env.DEBUG = '1';
    try {
      const lines = capture(() => formatError(new TypeError('boom')));

      assert.strictEqual(lines.length, 2);
      assert.ok(lines[1].includes('TypeError: boom'));
    } finally {
      if (saved === undefined) {
        delete process.env.DEBUG;
      } else {
        process.env.DEBUG = saved;
      }
    }
  });
});