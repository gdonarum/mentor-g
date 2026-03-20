#!/usr/bin/env node
// Wrapper script to ensure uppercase drive letter on Windows
// See: https://github.com/vitest-dev/vitest/issues/5251
import { execSync } from 'node:child_process';

const cwd = process.cwd().replace(/^([a-z]):/, (_, letter) => letter.toUpperCase() + ':');

const args = process.argv.slice(2);
const watchMode = args.includes('--watch');
const cmd = watchMode ? 'npx vitest' : 'npx vitest run';

try {
  execSync(cmd, { cwd, stdio: 'inherit' });
} catch {
  process.exit(1);
}
