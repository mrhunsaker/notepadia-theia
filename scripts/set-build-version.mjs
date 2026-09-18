#!/usr/bin/env node
// Generates the Notepadia **build version** (`YYYY.M.D`, e.g. `2026.9.18`) and,
// when given package.json path(s), injects it into them at build/package time.
//
// The repository itself stays versioned `0.0.0`; the date version is generated
// and injected by the build/CI (checkouts are disposable, and
// `scripts/package-electron.mjs` restores the tree afterwards), so no commit
// ever carries a date.
//
// Usage:
//   node scripts/set-build-version.mjs                          # print today's UTC date (YYYY.M.D)
//   node scripts/set-build-version.mjs --print 2026.9.19        # print an explicit version
//   node scripts/set-build-version.mjs <package.json> [VERSION] # inject into one or more files

import { readFileSync, writeFileSync } from 'node:fs';

const VERSION_RE = /^\d+\.\d+\.\d+$/;

export function isValidBuildVersion(version) {
    return VERSION_RE.test(version);
}

export function buildVersionFromDate(date = new Date()) {
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth() + 1;
    const d = date.getUTCDate();
    return `${y}.${m}.${d}`;
}

function parseArgs(argv) {
    const files = [];
    let version = null;
    let print = false;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--print') {
            print = true;
        } else if (arg === '--version') {
            version = argv[++i];
        } else if (isValidBuildVersion(arg)) {
            version = arg;
        } else {
            files.push(arg);
        }
    }
    return { files, version, print };
}

const { files, version, print } = parseArgs(process.argv.slice(2));
const resolved = version ?? buildVersionFromDate();

if (!isValidBuildVersion(resolved)) {
    console.error(`Invalid build version: ${resolved} (expected YYYY.M.D, e.g. 2026.9.19)`);
    process.exit(1);
}

if (print || files.length === 0) {
    console.log(resolved);
    process.exit(0);
}

for (const file of files) {
    const pkg = JSON.parse(readFileSync(file, 'utf8'));
    const before = pkg.version;
    pkg.version = resolved;
    writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`${file}: ${before} -> ${resolved}`);
}
console.log(`Build version: ${resolved}`);