#!/usr/bin/env node
// Bump the Notepadia version. The version follows the date:
//   YYYY.M.D            (e.g. 2026.9.19)
// Run without arguments to use the current UTC date, or pass a version:
//   node scripts/bump-version.mjs [VERSION]
// Updates the root and applications/electron package.json files (the two
// that matter for builds, packaging and the updater). Prints the new version.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const explicit = process.argv[2];
const version = explicit || (() => {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth() + 1;
    const d = now.getUTCDate();
    return `${y}.${m}.${d}`;
})();

if (!/^\d+\.\d+\.\d+$/.test(version)) {
    console.error(`Invalid version: ${version} (expected YYYY.M.D)`);
    process.exit(1);
}

function bump(relPath) {
    const file = join(repoRoot, relPath);
    const pkg = JSON.parse(readFileSync(file, 'utf8'));
    const oldVersion = pkg.version;
    pkg.version = version;
    writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`${relPath}: ${oldVersion} -> ${version}`);
}

bump('package.json');
bump('applications/electron/package.json');
console.log(`\nBumped to ${version}`);