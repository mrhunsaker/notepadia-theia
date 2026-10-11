#!/usr/bin/env node
// Smoke-test the packaged Electron app (G5).
//
// Launches the built binary with a remote debugging port, then asserts, over
// the Chrome DevTools Protocol, that the window opened, the Notepadia toolbar
// actually rendered, the freshly opened workspace is trusted by default (G5:
// no workspace-trust dialog, no Restricted Mode), and that the native
// Ctrl/Cmd+N and F5 / Ctrl/Cmd+F5 keybindings from D2/G1 are delivered - the
// latter only in Electron, where the browser never sees (and never reloads on)
// the browser-reserved chords.
//
// Run it from the release workflow after electron-builder has produced the
// app, and from `yarn smoke:electron` locally after `yarn package:preview`.
//
// Usage:
//   node scripts/electron-smoke.mjs [path-to-binary]
//
// When no path is given, the script looks for the packaged app under
// applications/electron/dist for the current platform.
//
// An SMOKE_CDP_PORT can be given (default 9235) and an SMOKE_SCREENSHOT path
// receives a PNG of the page when the app booted (best effort, for CI logs).

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'applications', 'electron', 'dist');
const CDP_PORT = Number(process.env.SMOKE_CDP_PORT || '9235');
const SCREENSHOT = process.env.SMOKE_SCREENSHOT;
const CDP_URL = `http://127.0.0.1:${CDP_PORT}`;

function discoverBinary() {
    if (process.platform === 'linux') {
        const unpacked = path.join(DIST, 'linux-unpacked');
        if (!fs.existsSync(unpacked)) {
            return undefined;
        }
        for (const entry of fs.readdirSync(unpacked, { withFileTypes: true })) {
            if (!entry.isFile()) {
                continue;
            }
            const full = path.join(unpacked, entry.name);
            try {
                fs.accessSync(full, fs.constants.X_OK);
                return full;
            } catch { /* skip non-executable */ }
        }
        return undefined;
    }
    if (process.platform === 'darwin') {
        for (const appRoot of fs.readdirSync(DIST, { withFileTypes: true })) {
            if (!appRoot.isDirectory() || !appRoot.name.includes('mac')) {
                continue;
            }
            const binaries = path.join(DIST, appRoot.name, 'Contents', 'MacOS');
            if (!fs.existsSync(binaries)) {
                continue;
            }
            for (const entry of fs.readdirSync(binaries, { withFileTypes: true })) {
                const full = path.join(binaries, entry.name);
                try {
                    fs.accessSync(full, fs.constants.X_OK);
                    return full;
                } catch { /* skip non-executable */ }
            }
        }
        return undefined;
    }
    if (process.platform === 'win32') {
        const unpacked = path.join(DIST, 'win-unpacked');
        if (!fs.existsSync(unpacked)) {
            return undefined;
        }
        for (const entry of fs.readdirSync(unpacked, { withFileTypes: true })) {
            if (entry.isFile() && entry.name.endsWith('.exe')) {
                return path.join(unpacked, entry.name);
            }
        }
        return undefined;
    }
    return undefined;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url) {
    return new Promise((resolve, reject) => {
        const req = http.get(url, res => {
            let body = '';
            res.on('data', c => { body += c; if (body.length > 4_000_000) { req.destroy(); reject(new Error('response too large')); } });
            res.on('end', () => {
                try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
            });
        });
        req.on('error', reject);
        req.setTimeout(2000, () => req.destroy(new Error('timed out')));
    });
}

async function waitForPageTarget(deadlineMs = 120000) {
    const deadline = Date.now() + deadlineMs;
    let lastError;
    while (Date.now() < deadline) {
        try {
            const targets = await fetchJson(`${CDP_URL}/json`);
            const page = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
            if (page) {
                return page;
            }
        } catch (error) {
            lastError = error;
        }
        await sleep(1000);
    }
    throw new Error(`no page target appeared on port ${CDP_PORT}${lastError ? ` (${lastError.message})` : ''}`);
}

class CdpSession {
    constructor(ws) {
        this.ws = ws;
        this.nextId = 1;
        this.pending = new Map();
        this.consoleErrors = [];
        ws.addEventListener('message', event => {
            const message = JSON.parse(event.data);
            if (message.id) {
                const waiter = this.pending.get(message.id);
                if (waiter) {
                    this.pending.delete(message.id);
                    if (message.error) {
                        waiter.reject(new Error(message.error.message));
                    } else {
                        waiter.resolve(message.result);
                    }
                }
                return;
            }
            if (message.method === 'Runtime.exceptionThrown') {
                this.consoleErrors.push(message.params.exceptionDetails?.text || 'runtime exception');
            }
        });
    }

    send(method, params = {}, timeoutMs = 15000) {
        return new Promise((resolve, reject) => {
            const id = this.nextId++;
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`CDP ${method} timed out after ${timeoutMs}ms`));
            }, timeoutMs);
            this.pending.set(id, {
                resolve: value => { clearTimeout(timer); resolve(value); },
                reject: error => { clearTimeout(timer); reject(error); }
            });
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }

    async evaluate(expression) {
        const result = await this.send('Runtime.evaluate', {
            expression,
            returnByValue: true,
            awaitPromise: true
        });
        if (result.exceptionDetails) {
            throw new Error(result.exceptionDetails.text || 'expression threw');
        }
        return result.result?.value;
    }

    async waitFor(expression, description, deadlineMs = 60000) {
        const deadline = Date.now() + deadlineMs;
        while (Date.now() < deadline) {
            try {
                if (await this.evaluate(expression)) {
                    return;
                }
            } catch { /* keep polling */ }
            await sleep(1000);
        }
        throw new Error(`timeout waiting for ${description}`);
    }

    close() {
        try { this.ws.close(); } catch { /* already closed */ }
    }
}

const binary = process.argv[2] || discoverBinary();
if (!binary || !fs.existsSync(binary)) {
    console.error('FAIL no packaged Electron binary found. Build the app (yarn package:preview) or pass a path, e.g. node scripts/electron-smoke.mjs <path-to-binary>.');
    process.exit(1);
}

const args = [`--remote-debugging-port=${CDP_PORT}`];
if (process.platform === 'linux') {
    args.push('--no-sandbox', '--disable-gpu');
}

// Open a real workspace so the G5 workspace-trust check below is meaningful:
// the app must trust it without ever surfacing the trust dialog or Restricted
// Mode, because the packaged defaults set security.workspace.trust.enabled to
// false. The workspace folder is passed as the CLI's `[file]` positional.
const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notepadia-smoke-workspace-'));
fs.writeFileSync(path.join(workspaceDir, 'note.txt'), 'Notepadia smoke test\n');
args.push(workspaceDir);

// Electron 42 defaults to Ozone/Wayland when WAYLAND_DISPLAY is set. In a plain
// X session (and under xvfb, where WAYLAND_DISPLAY is usually unset anyway) that
// Wayland socket is not usable and Chromium hangs before it ever creates a
// window, so no CDP target appears. Force the X11 backend on Linux.
const childEnv = { ...process.env };
if (process.platform === 'linux') {
    childEnv.ELECTRON_OZONE_PLATFORM_HINT = childEnv.ELECTRON_OZONE_PLATFORM_HINT || 'x11';
}

const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'], env: childEnv });
const log = [];
const collect = d => {
    log.push(d.toString());
    if (log.length > 4000) {
        log.splice(0, log.length - 2000);
    }
};
child.stdout.on('data', collect);
child.stderr.on('data', collect);

async function fail(message) {
    console.error('FAIL ' + message);
    process.stderr.write(log.join('').slice(-3000));
    try { child.kill('SIGKILL'); } catch { /* keep going */ }
    process.exit(1);
}

try {
    const page = await waitForPageTarget();
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await Promise.race([
        new Promise((resolve, reject) => {
            ws.addEventListener('open', resolve, { once: true });
            ws.addEventListener('error', reject, { once: true });
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('CDP WebSocket did not open within 15000ms')), 15000))
    ]);
    const session = new CdpSession(ws);

    await session.send('Runtime.enable');

    // The workbench shell and the Notepadia toolbar render once the frontend
    // has booted; their presence is the "window opened and UI rendered" signal.
    await session.waitFor(
        `document.readyState === 'complete' && !!document.querySelector('#theia-app-shell') && !!document.querySelector('#notepadia-toolbar')`,
        'the app window and the Notepadia toolbar',
        180000
    );
    const title = await session.evaluate('document.title');
    const buttonCount = await session.evaluate(`document.querySelectorAll('#notepadia-toolbar button.notepadia-toolbar-button').length`);
    console.log(`PASS app window opened (title="${title}") and toolbar rendered (${buttonCount} buttons)`);

    // G5 workspace-trust parity: the packaged app defaults
    // security.workspace.trust.enabled to false, so the freshly opened
    // workspace must be trusted immediately - no trust dialog and no
    // Restricted Mode in the status bar (a stale generated frontend config
    // previously dropped this setting from Electron).
    let sawTrustPrompt = false;
    const trustDeadline = Date.now() + 20000;
    while (Date.now() < trustDeadline) {
        sawTrustPrompt = await session.evaluate(
            `!!document.querySelector('.workspace-trust-dialog') || !!document.querySelector('#status-bar-workspace-trust-status')`
        );
        if (sawTrustPrompt) {
            throw new Error('the workspace-trust dialog or Restricted Mode status item appeared - the workspace was not trusted by default');
        }
        await sleep(300);
    }
    console.log(`PASS workspace "${workspaceDir}" trusted by default: no workspace-trust dialog and no Restricted Mode`);

    if (SCREENSHOT) {
        try {
            await session.send('Page.enable');
            const shot = await session.send('Page.captureScreenshot', { format: 'png' });
            fs.writeFileSync(SCREENSHOT, Buffer.from(shot.data, 'base64'));
            console.log(`PASS screenshot saved to ${SCREENSHOT}`);
        } catch (error) {
            console.warn(`WARN screenshot failed: ${error.message}`);
        }
    }

    // D2 parity: in Electron the native Ctrl/Cmd+N chord opens a new document.
    const tabSelector = `.p-TabBar-tab`;
    const tabsBefore = await session.evaluate(`document.querySelectorAll('${tabSelector}').length`);
    const modifier = process.platform === 'darwin' ? 4 : 2; // Meta on macOS, Ctrl elsewhere
    await session.send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        modifiers: modifier,
        key: 'n',
        code: 'KeyN',
        windowsVirtualKeyCode: 78,
        nativeVirtualKeyCode: 78
    });
    await session.send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        modifiers: modifier,
        key: 'n',
        code: 'KeyN',
        windowsVirtualKeyCode: 78,
        nativeVirtualKeyCode: 78
    });
    await session.waitFor(
        `document.querySelectorAll('${tabSelector}').length > ${tabsBefore}`,
        'a new document tab to open after Ctrl/Cmd+N',
        15000
    );
    const tabsAfter = await session.evaluate(`document.querySelectorAll('${tabSelector}').length`);
    console.log(`PASS native ${process.platform === 'darwin' ? 'Cmd' : 'Ctrl'}+N opened a new document (tabs ${tabsBefore} -> ${tabsAfter})`);

    // G1/D2 parity for the Date & Time chords: F5 (short) and Ctrl/Cmd+F5
    // (long) are browser reloads, so the browser suite can only cover their
    // alternates (Ctrl+Alt+D / Ctrl+Alt+Shift+D). Electron delivers the native
    // chords, and this is the one place that can prove it - the editor must be
    // focused first, because both bindings are scoped to `editorTextFocus`.
    const editorBox = await session.evaluate(`(function () {
        var el = document.querySelector('.monaco-editor');
        if (!el) { return null; }
        var r = el.getBoundingClientRect();
        return { x: r.x + 40, y: r.y + 20 };
    })()`);
    if (!editorBox) {
        throw new Error('no editor found to focus for the Date & Time chord check');
    }
    await session.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: editorBox.x, y: editorBox.y, button: 'left', clickCount: 1 });
    await session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: editorBox.x, y: editorBox.y, button: 'left', clickCount: 1 });
    await sleep(500);

    const readEditorText = `(function () {
        var el = document.querySelector('.monaco-editor .view-lines');
        return el ? el.textContent.replace(/\\u00a0/g, ' ') : '';
    })()`;
    const pressChords = async (modifiers, key, code, vk) => {
        await session.send('Input.dispatchKeyEvent', { type: 'keyDown', modifiers, key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
        await session.send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers, key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
    };

    // F5 -> the short, numeric format "HH:mm:ss dd/MM/yyyy" (locale-independent).
    await pressChords(0, 'F5', 'F5', 116);
    await session.waitFor(
        `/\\d{2}:\\d{2}:\\d{2} \\d{2}\\/\\d{2}\\/\\d{4}/.test(${readEditorText})`,
        'F5 to insert the short Date & Time',
        10000
    );
    console.log('PASS native F5 inserted the short Date & Time (G1/D2 parity)');

    // Ctrl/Cmd+F5 -> the long format; assert the locale-stable "d, yyyy h:mm".
    await pressChords(modifier, 'F5', 'F5', 116);
    await session.waitFor(
        `/\\d{1,2}, \\d{4} \\d{1,2}:\\d{2}/.test(${readEditorText})`,
        `Ctrl/Cmd+F5 to insert the long Date & Time`,
        10000
    );
    console.log(`PASS native ${process.platform === 'darwin' ? 'Cmd' : 'Ctrl'}+F5 inserted the long Date & Time (G1/D2 parity)`);

    const errors = session.consoleErrors;
    if (errors.length > 0) {
        console.warn(`WARN ${errors.length} runtime exception(s) captured during the smoke run (first: ${errors[0]})`);
    }

    session.close();
    try { child.kill('SIGKILL'); } catch { /* already gone */ }
    console.log('PASS Electron smoke test');
    process.exit(0);
} catch (error) {
    await fail(error.message);
}