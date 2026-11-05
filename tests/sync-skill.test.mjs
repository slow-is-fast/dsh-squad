/**
 * Tests for scripts/sync-skill.mjs: mirroring the repo into an installed skill.
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { repoRoot, runNode } from './helpers/run-cli.mjs';

const script = join(repoRoot, 'scripts', 'sync-skill.mjs');

function runSync(args) {
  return runNode([script, ...args]);
}

describe('sync-skill', () => {
  let dir;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'squad-sync-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test('copies the shipped files into an empty target', async () => {
    const target = join(dir, 'skill');

    const result = await runSync([target]);

    assert.strictEqual(result.code, 0, result.stderr);
    for (const name of [
      'SKILL.md', 'README.md', 'LICENSE', 'package.json',
      'bin/dsh-squad.mjs', 'lib/core.mjs', 'config/models.json'
    ]) {
      assert.ok(existsSync(join(target, name)), `${name} was not copied`);
    }
    assert.ok(!existsSync(join(target, '.git')));
  });

  test('removes stale entries from the target', async () => {
    const target = join(dir, 'skill');
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, 'SKILL.md'), 'old copy');
    writeFileSync(join(target, 'stale.txt'), 'old');

    const result = await runSync([target]);

    assert.strictEqual(result.code, 0, result.stderr);
    assert.ok(!existsSync(join(target, 'stale.txt')));
    assert.ok(readFileSync(join(target, 'SKILL.md'), 'utf-8').includes('name: dsh-squad'));
  });

  test('keeps a .git directory when the target is a checkout', async () => {
    const target = join(dir, 'skill');
    mkdirSync(join(target, '.git'), { recursive: true });
    writeFileSync(join(target, '.git', 'HEAD'), 'ref: refs/heads/main');

    const result = await runSync([target]);

    assert.strictEqual(result.code, 0, result.stderr);
    assert.ok(existsSync(join(target, '.git', 'HEAD')));
  });

  test('refuses the repo root', async () => {
    const result = await runSync([repoRoot]);

    assert.strictEqual(result.code, 1);
    assert.ok(result.stderr.includes('Refusing'));
  });

  test('refuses a subdirectory of the repo', async () => {
    const target = join(repoRoot, 'tmp-sync-target');

    const result = await runSync([target]);

    assert.strictEqual(result.code, 1);
    assert.ok(result.stderr.includes('Refusing'));
    assert.ok(!existsSync(target));
  });

  test('refuses a non-empty directory that is not a skill', async () => {
    const target = join(dir, 'not-a-skill');
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, 'important.txt'), 'keep me');

    const result = await runSync([target]);

    assert.strictEqual(result.code, 1);
    assert.ok(result.stderr.includes('SKILL.md'));
    assert.ok(existsSync(join(target, 'important.txt')));
  });

  test('--force overwrites a non-skill directory', async () => {
    const target = join(dir, 'not-a-skill');
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, 'important.txt'), 'keep me');

    const result = await runSync([target, '--force']);

    assert.strictEqual(result.code, 0, result.stderr);
    assert.ok(existsSync(join(target, 'SKILL.md')));
    assert.ok(!existsSync(join(target, 'important.txt')));
  });

  test('--dry-run changes nothing', async () => {
    const target = join(dir, 'skill');

    const result = await runSync([target, '--dry-run']);

    assert.strictEqual(result.code, 0, result.stderr);
    assert.ok(!existsSync(target));
  });

  test('--dry-run treats shipped directories as kept, not stale', async () => {
    const target = join(dir, 'skill');
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, 'SKILL.md'), 'old');
    writeFileSync(join(target, 'stale.txt'), 'old');

    const result = await runSync([target, '--dry-run']);

    assert.strictEqual(result.code, 0, result.stderr);

    const deleteLine = result.stdout.split('\n').find(line => line.startsWith('Delete:')) || '';
    assert.ok(deleteLine.includes('stale.txt'), deleteLine);
    assert.ok(!deleteLine.includes('bin'), deleteLine);
    assert.ok(!deleteLine.includes('lib'), deleteLine);
  });
});