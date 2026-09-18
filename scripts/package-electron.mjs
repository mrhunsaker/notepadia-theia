#!/usr/bin/env node
// Local helper for packaging the Electron app with the date-based **build
// version** injected, without ever leaving the checked-in package.json dirty.
//
// It temporarily writes the computed build version (via scripts/set-build-version.mjs)
// into applications/electron/package.json, runs electron-builder, then restores
// the original file - even when the build fails. The Git working tree is never
// left with a bumped version.
//
// Usage:
//   node scripts/package-electron.mjs [--win|--linux|--mac|--dir] [--version X.Y.Z]
//
// With no target, electron-builder packages for the current platform, like the
// old `electron-builder -c.mac.identity=null --publish never` invocation.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'cross-spawn';
import { buildVersionFromDate, isValidBuildVersion } from './set-build-version.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const targetArg = args.find((a) => ['--win', '--linux', '--mac', '--dir'].includes(a)) || '';
const versionIdx = args.indexOf('--version');
const explicitVersion = versionIdx >= 0 ? args[versionIdx + 1] : undefined;

const version = explicitVersion && isValidBuildVersion(explicitVersion)
    ? explicitVersion
    : buildVersionFromDate();

const appDir = resolve(root, 'applications/electron');
const pkgPath = join(appDir, 'package.json');
const original = readFileSync(pkgPath, 'utf8');
const pkg = JSON.parse(original);
const repoVersion = pkg.version;
pkg.version = version;

const ebBin = join(
    root,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder'
);

const ebArgs = [
    ...(targetArg ? [targetArg] : []),
    '--config.mac.identity=null',
    '--publish',
    'never',
];

console.log(`Injecting build version ${version} into ${pkgPath}`);
try {
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    const child = spawn(ebBin, ebArgs, { cwd: appDir, stdio: 'inherit' });
    const code = await new Promise((resolveExit) => child.on('close', resolveExit));
    if (code !== 0) {
        process.exitCode = code;
    }
} finally {
    writeFileSync(pkgPath, original);
    console.log(`\nRestored ${pkgPath} (${version} -> ${repoVersion}); working tree is clean.`);
}