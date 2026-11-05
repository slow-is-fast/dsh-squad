/**
 * Shared test helpers: spawn node with a script and capture its output.
 */

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export const repoRoot = join(here, '..', '..');
export const cliPath = join(repoRoot, 'bin', 'dsh-squad.mjs');

export function runNode(args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn('node', args, {
      cwd: options.cwd || repoRoot,
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
      resolve({ code, stdout, stderr });
    });

    setTimeout(() => {
      child.kill();
      resolve({ code: -1, stdout, stderr: 'Timeout' });
    }, 5000);
  });
}

export function runCLI(cliArgs, options = {}) {
  return runNode([cliPath, ...cliArgs], options);
}