#!/usr/bin/env node
/**
 * Mirror this repo into an installed DSH skill directory.
 *
 * The skill under ~/.agents/skills/dsh-squad is a copy, not a git checkout, so
 * repo edits do not reach DSH until the copy is refreshed. This script does
 * that: it wipes stale entries, copies the shipped files, and refuses targets
 * that look like a mistake.
 *
 * Usage: node scripts/sync-skill.mjs [target] [--dry-run] [--force]
 *        target defaults to $SQUAD_SKILL_DIR or ~/.agents/skills/dsh-squad
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const positional = args.filter(arg => !arg.startsWith('--'));

const target = resolve(
  positional[0]
  || process.env.SQUAD_SKILL_DIR
  || join(homedir(), '.agents', 'skills', 'dsh-squad')
);

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

/** Files and directories shipped to the installed skill. */
function shippedEntries() {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
  const listed = Array.isArray(manifest.files) ? manifest.files : [];
  const entries = [...new Set([...listed, 'LICENSE', 'package.json'])]
    .filter(entry => existsSync(join(ROOT, entry)));

  return new Set(entries);
}

// --- Guards: never mirror onto something that is not a skill directory ------

if (target === ROOT) {
  fail(`Refusing to sync onto the repo itself: ${target}`);
}

if (target.startsWith(ROOT + sep)) {
  fail(`Refusing to sync into a subdirectory of the repo: ${target}`);
}

if (ROOT.startsWith(target + sep)) {
  fail(`Refusing to sync onto an ancestor of the repo: ${target}`);
}

if (target === homedir() || target === dirname(homedir())) {
  fail(`Refusing to sync onto a home-level directory: ${target}`);
}

const presentEntries = existsSync(target)
  ? readdirSync(target).filter(name => name !== '.git')
  : [];

if (presentEntries.length > 0 && !existsSync(join(target, 'SKILL.md')) && !force) {
  fail(
    `Refusing to overwrite ${target}: it is not empty and has no SKILL.md.\n`
    + `   Pass --force if this is really the skill directory.`
  );
}

// --- Mirror ----------------------------------------------------------------

const entries = shippedEntries();
// package.json lists directories as "bin/", while readdirSync returns "bin".
const shippedNames = new Set(
  [...entries].map(entry => entry.replace(/[\\/]+$/, ''))
);
const stale = existsSync(target)
  ? readdirSync(target).filter(name => name !== '.git' && !shippedNames.has(name))
  : [];

if (dryRun) {
  console.log(`Repo:   ${ROOT}`);
  console.log(`Target: ${target}`);
  console.log(`Copy:   ${[...shippedNames].join(', ')}`);
  if (stale.length > 0) console.log(`Delete: ${stale.join(', ')}`);
  process.exit(0);
}

mkdirSync(target, { recursive: true });

for (const name of stale) {
  rmSync(join(target, name), { recursive: true, force: true });
}

for (const entry of entries) {
  const destination = join(target, entry);
  rmSync(destination, { recursive: true, force: true });
  cpSync(join(ROOT, entry), destination, { recursive: true });
}

function countFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).reduce((total, entry) => {
    return total + (entry.isDirectory() ? countFiles(join(dir, entry.name)) : 1);
  }, 0);
}

if (!existsSync(join(target, 'SKILL.md'))) {
  fail(`Sync finished but ${join(target, 'SKILL.md')} is missing`);
}

console.log(`✓ Synced ${countFiles(target)} files to ${target}`);
if (stale.length > 0) {
  console.log(`  Removed stale: ${stale.join(', ')}`);
}
console.log('  Restart DSH (or start a new session) to reload SKILL.md changes.');