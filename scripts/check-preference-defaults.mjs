import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function load(relative) {
    return JSON.parse(readFileSync(path.join(ROOT, relative), 'utf8'));
}

const browser = load('applications/browser/package.json').theia.frontend.config;
const electron = load('applications/electron/package.json').theia.frontend.config;

const GENERATED_CONFIGS = [
    ['browser frontend', 'applications/browser/src-gen/frontend/index.js', 'FrontendApplicationConfigProvider.set('],
    ['electron frontend', 'applications/electron/src-gen/frontend/index.js', 'FrontendApplicationConfigProvider.set('],
    ['electron backend', 'applications/electron/src-gen/backend/electron-main.js', 'const config = ']
];

function extractConfig(source, marker) {
    const markerIndex = source.indexOf(marker);
    if (markerIndex < 0) {
        return undefined;
    }
    const start = source.indexOf('{', markerIndex);
    if (start < 0) {
        return undefined;
    }
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < source.length; i++) {
        const ch = source[i];
        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (ch === '\\') {
                escaped = true;
            } else if (ch === '"') {
                inString = false;
            }
            continue;
        }
        if (ch === '"') {
            inString = true;
        } else if (ch === '{') {
            depth++;
        } else if (ch === '}') {
            depth--;
            if (depth === 0) {
                return JSON.parse(source.slice(start, i + 1));
            }
        }
    }
    return undefined;
}

const problems = [];

if (browser.applicationName !== electron.applicationName) {
    problems.push(`applicationName: browser=${JSON.stringify(browser.applicationName)} electron=${JSON.stringify(electron.applicationName)}`);
}

const browserPrefs = browser.preferences ?? {};
const electronPrefs = electron.preferences ?? {};
const keys = [...new Set([...Object.keys(browserPrefs), ...Object.keys(electronPrefs)])].sort();

for (const key of keys) {
    const inBrowser = Object.prototype.hasOwnProperty.call(browserPrefs, key);
    const inElectron = Object.prototype.hasOwnProperty.call(electronPrefs, key);
    if (!inBrowser) {
        problems.push(`preference "${key}" exists only in electron (=${JSON.stringify(electronPrefs[key])})`);
    } else if (!inElectron) {
        problems.push(`preference "${key}" exists only in browser (=${JSON.stringify(browserPrefs[key])})`);
    } else if (JSON.stringify(browserPrefs[key]) !== JSON.stringify(electronPrefs[key])) {
        problems.push(`preference "${key}": browser=${JSON.stringify(browserPrefs[key])} electron=${JSON.stringify(electronPrefs[key])}`);
    }
}

// G5: the preferences must also be baked into the committed src-gen configs.
// `theia build` regenerates them from package.json, but a stale checked-in
// src-gen silently ships an app whose frontend config loses the preferences
// (this previously dropped security.workspace.trust.enabled from Electron, so
// the workspace-trust dialog appeared at startup). Verify all three.
for (const [label, relative, marker] of GENERATED_CONFIGS) {
    const generated = extractConfig(readFileSync(path.join(ROOT, relative), 'utf8'), marker);
    if (!generated) {
        problems.push(`${label} generated config could not be parsed (${relative})`);
        continue;
    }
    const generatedPrefs = generated.preferences ?? {};
    for (const key of Object.keys(electronPrefs)) {
        if (JSON.stringify(generatedPrefs[key]) !== JSON.stringify(electronPrefs[key])) {
            problems.push(`preference "${key}" missing or different in the generated ${label} config (${relative})`);
        }
    }
}

if (problems.length > 0) {
    console.error('FAIL the browser and electron preference defaults have drifted apart (A6):');
    for (const problem of problems) {
        console.error('  - ' + problem);
    }
    console.error('Both applications must ship the same defaults, and the committed src-gen configs must match. Update the package.json files, then regenerate with:');
    console.error('  yarn -C applications/browser build && yarn -C applications/electron build');
    process.exit(1);
}

console.log(`PASS preference defaults identical: ${keys.length} keys and applicationName "${browser.applicationName}" match in browser and electron, and all generated src-gen configs share them.`);
