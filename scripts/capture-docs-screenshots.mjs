#!/usr/bin/env node
// Capture the documentation site's UI screenshots from a seeded browser app.
// Boots its own server on E2E_PORT (default 3100) against a fresh workspace so
// the shots show the real product; writes PNGs under docs/images/.
//
// Usage: node scripts/capture-docs-screenshots.mjs
// Prereq: `yarn build` has been run (the browser app lib must exist).

import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.E2E_PORT || '3100';
const URL = `http://127.0.0.1:${PORT}/`;
const WS = path.join(os.tmpdir(), 'notepadia-shot-ws');
const CONFIG_DIR = path.join(os.tmpdir(), 'notepadia-shot-config');
const OUT = path.join(ROOT, 'docs', 'images');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function seedWorkspace() {
    fs.rmSync(WS, { recursive: true, force: true });
    fs.mkdirSync(WS, { recursive: true });
    fs.rmSync(CONFIG_DIR, { recursive: true, force: true });
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(path.join(WS, 'sample.txt'), 'alpha\nbeta\ngamma\n');
    fs.writeFileSync(path.join(WS, 'app.js'), 'function greet(name) {\n  // a comment\n  return "hello " + name;\n}\n');
    fs.mkdirSync(path.join(WS, 'notes'), { recursive: true });
    fs.writeFileSync(path.join(WS, 'notes', 'todo.md'), '# Today\n\n- ship the docs pass\n- capture screenshots\n\nDone is better than perfect.\n');
    fs.writeFileSync(path.join(WS, 'long.txt'), Array.from({ length: 400 }, (_, i) => `line ${i + 1} of the long fixture`).join('\n') + '\n');
}

function startServer() {
    const theia = path.join(ROOT, 'node_modules', '.bin', 'theia');
    const child = spawn(theia,
        ['start', '--app-target=browser', '--hostname', '127.0.0.1', '--port', PORT, WS],
        { cwd: path.join(ROOT, 'applications', 'browser'), stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, THEIA_CONFIG_DIR: CONFIG_DIR } });
    return child;
}

function httpOk() {
    return new Promise(resolve => {
        const req = http.get(URL, res => { res.resume(); res.on('end', () => resolve(res.statusCode === 200)); });
        req.on('error', () => resolve(false));
        setTimeout(() => { req.destroy(); resolve(false); }, 3000).unref();
    });
}

async function waitForServer(child) {
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
        if (child.exitCode !== null) throw new Error('server exited early');
        if (await httpOk()) return;
        await sleep(2000);
    }
    throw new Error('server did not come up');
}

async function waitFor(page, sel, timeout = 30000) {
    await page.waitForSelector(sel, { timeout, visible: true });
}

// Open a file through the command palette, the route the e2e suites use.
async function openFile(page, fragment) {
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyP');
    await page.keyboard.up('Control');
    await sleep(1400);
    const input = await page.$('#quick-input-container input');
    if (!input) throw new Error('quick input did not open');
    await input.type(fragment, { delay: 30 });
    await sleep(900);
    const exact = await page.evaluate((frag) => {
        const rows = Array.from(document.querySelectorAll('#quick-input-container .monaco-list .monaco-list-row'));
        return rows.findIndex(r => {
            const a = (r.getAttribute('aria-label') || '').trim();
            return a.split(',')[0].trim() === frag;
        });
    }, fragment);
    if (exact > 0) {
        const rows = await page.$$('#quick-input-container .monaco-list .monaco-list-row');
        await rows[exact].click();
        await sleep(900);
    } else {
        await page.keyboard.press('Enter');
    }
    await waitFor(page, '.monaco-editor');
    await sleep(2000);
    await page.keyboard.press('Escape');
    await sleep(400);
}

// Click a top-level menu, then a named item inside it, using real mouse events
// (the same route the e2e suites take) so Lumino menu state toggles properly.
async function clickMenu(page, topLevel, itemSubstring) {
    const box = await page.evaluate((label) => {
        const e = Array.from(document.querySelectorAll('.lm-MenuBar-item')).find(x => (x.textContent || '').trim().startsWith(label));
        if (!e) return null;
        const r = e.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, topLevel);
    if (box) {
        await page.mouse.move(box.x, box.y);
        await page.mouse.click(box.x, box.y);
        await sleep(1100);
    }
    let clicked = await page.evaluate((sub) => {
        const item = Array.from(document.querySelectorAll('.lm-Menu .lm-Menu-item'))
            .find(el => (el.textContent || '').includes(sub));
        if (!item) return false;
        const r = item.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, itemSubstring);
    if (clicked) {
        await page.mouse.move(clicked.x, clicked.y);
        await page.mouse.click(clicked.x, clicked.y);
    }
    await sleep(1500);
}

async function main() {
    seedWorkspace();
    const server = startServer();
    try {
        await waitForServer(server);
    } catch (e) {
        console.error(e.message);
        server.kill('SIGTERM');
        process.exit(1);
    }

    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(URL, { waitUntil: 'networkidle2' });
    await page.waitForSelector('#theia-app-shell', { timeout: 60000 });
    await page.waitForSelector('.lm-MenuBar', { timeout: 30000 });
    await sleep(3000);

    fs.mkdirSync(OUT, { recursive: true });

    // Main editor with a file open, toolbar and status bar visible.
    await openFile(page, 'app.js');
    await page.screenshot({ path: path.join(OUT, 'main-editor.png') });

    // The tabbed Find dialog over the editor.
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyF');
    await page.keyboard.up('Control');
    await sleep(1800);
    const findOpen = await page.evaluate(() => !!document.querySelector('.notepadia-find'));
    if (!findOpen) {
        console.log('warning: Find dialog did not open');
    }
    await page.screenshot({ path: path.join(OUT, 'find-dialog.png') });
    await page.keyboard.press('Escape');
    await sleep(500);

    // The Incremental Search bar at the foot of the editor, opened via the
    // Search menu (same route the e2e suite uses to prove discoverability).
    await clickMenu(page, 'Search', 'Incremental Search');
    let barVisible = false;
    try {
        await waitFor(page, '#notepadia-incremental-term', 15000);
        await page.waitForFunction(() => {
            const input = document.querySelector('#notepadia-incremental-term');
            return input && document.activeElement === input;
        }, { timeout: 15000 }).catch(() => { });
        await sleep(500);
        barVisible = true;
    } catch (e) {
        console.log('warning: incremental search bar did not open');
    }
    if (barVisible) {
        const input = await page.$('#notepadia-incremental-term');
        if (input) {
            await input.type('hello', { delay: 20 });
            await sleep(800);
        }
        await page.screenshot({ path: path.join(OUT, 'incremental-search.png') });
    } else {
        await page.screenshot({ path: path.join(OUT, 'incremental-search.png') });
    }
    await page.keyboard.press('Escape');
    await sleep(500);

    // Split view: clone into a second pane, then open a long file beside it.
    await clickMenu(page, 'View', 'Clone to Other View');
    await sleep(1500);
    await openFile(page, 'long.txt');
    await sleep(1000);
    await page.screenshot({ path: path.join(OUT, 'split-view.png') });

    await browser.close();
    server.kill('SIGTERM');
    try { await new Promise(r => server.on('exit', r)); } catch { }
    const files = ['main-editor.png', 'find-dialog.png', 'incremental-search.png', 'split-view.png']
        .map(f => [f, fs.existsSync(path.join(OUT, f)) ? fs.statSync(path.join(OUT, f)).size : 0]);
    console.log('screenshots written:');
    for (const [f, size] of files) console.log(`  ${f} (${size} bytes)`);
}

main();