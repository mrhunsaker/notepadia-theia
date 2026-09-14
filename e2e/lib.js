const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer');

const URL = process.env.E2E_URL || 'http://127.0.0.1:3000/';
const WS = process.env.E2E_WS || path.join(os.tmpdir(), 'notepadia-e2e-ws');

let checks = 0;
let failures = 0;

function assert(name, ok, extra = '') {
    checks += 1;
    if (ok) {
        console.log(`PASS ${name}`);
    } else {
        failures += 1;
        console.log(`FAIL ${name}${extra ? ' -- ' + extra : ''}`);
    }
}

async function finish(browser) {
    if (browser) await browser.close();
    console.log(`SUMMARY checks=${checks} failures=${failures}`);
    process.exit(failures ? 1 : 0);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitFor(page, sel, timeout = 30000, msg) {
    try {
        await page.waitForSelector(sel, { timeout, visible: true });
    } catch (e) {
        throw new Error('timeout waiting for ' + sel + (msg ? ' (' + msg + ')' : ''));
    }
}

async function launchPage(opts = {}) {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);
    if (opts.viewport) await page.setViewport(opts.viewport);
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => {
        if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) {
            errors.push('console.error: ' + m.text());
        }
    });
    return { browser, page, errors };
}

async function goto(page) {
    await page.goto(URL, { waitUntil: 'networkidle2' });
    await waitFor(page, '#theia-app-shell', 60000);
    await waitFor(page, '.lm-MenuBar', 30000);
    await sleep(2500);
}

async function openFile(page, fragment) {
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyP');
    await page.keyboard.up('Control');
    await sleep(1400);
    const input = await page.$('#quick-input-container input');
    await input.type(fragment, { delay: 30 });
    await sleep(900);
    const exact = await page.evaluate((frag) => {
        const rows = Array.from(document.querySelectorAll('#quick-input-container .monaco-list .monaco-list-row'));
        return rows.findIndex(r => {
            const a = (r.getAttribute('aria-label') || '').trim();
            const name = a.split(',')[0].trim();
            return name === frag;
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

async function save(page) {
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyS');
    await page.keyboard.up('Control');
    await sleep(2200);
}

async function openTopMenu(page, menu) {
    const names = await page.$$eval('.lm-MenuBar-item', els => els.map(e => e.innerText.trim()));
    const idx = names.findIndex(n => n.startsWith(menu));
    if (idx < 0) throw new Error('menu not found: ' + menu);
    const handles = await page.$$('.lm-MenuBar-item');
    await handles[idx].click();
    await sleep(700);
}

async function findItemIndex(page, label) {
    return page.$$eval('.lm-Menu-item', (els, l) =>
        els.findIndex(e => (e.querySelector('.lm-Menu-itemLabel')?.innerText || '').trim() === l), label);
}

async function clickMenuItem(page, menu, label) {
    await openTopMenu(page, menu);
    const idx = await findItemIndex(page, label);
    if (idx < 0) throw new Error('menu item not found: ' + menu + ' > ' + label);
    const all = await page.$$('.lm-Menu-item');
    await all[idx].click();
    await sleep(700);
}

async function clickSubMenuItem(page, menu, sub, label) {
    await openTopMenu(page, menu);
    await sleep(200);
    const subIdx = await findItemIndex(page, sub);
    if (subIdx < 0) throw new Error('no submenu ' + sub + ' in menu ' + menu);
    const items = await page.$$('.lm-Menu-item');
    await items[subIdx].hover();
    await sleep(1200);
    const labelIdx = await findItemIndex(page, label);
    if (labelIdx < 0) throw new Error('submenu item not found: ' + sub + ' > ' + label);
    const all = await page.$$('.lm-Menu-item');
    await all[labelIdx].click();
    await sleep(1200);
}

async function clickByLabel(page, text) {
    const box = await page.evaluate(t => {
        const el = Array.from(document.querySelectorAll('.lm-Menu-item .lm-Menu-itemLabel'))
            .find(l => (l.textContent || '').trim() === t);
        if (!el) return null;
        const r = el.closest('.lm-Menu-item').getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, text);
    if (!box) return false;
    await page.mouse.move(box.x, box.y);
    await page.mouse.click(box.x, box.y);
    await sleep(1300);
    return true;
}

async function hoverByLabel(page, text) {
    const box = await page.evaluate(t => {
        const el = Array.from(document.querySelectorAll('.lm-Menu-item .lm-Menu-itemLabel'))
            .find(l => (l.textContent || '').trim() === t);
        if (!el) return null;
        const r = el.closest('.lm-Menu-item').getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, text);
    if (!box) return false;
    await page.mouse.move(box.x, box.y);
    await sleep(900);
    return true;
}

async function openMenuBar(page, label) {
    const box = await page.evaluate(l => {
        const e = Array.from(document.querySelectorAll('.lm-MenuBar-item')).find(x => (x.textContent || '').trim().startsWith(l));
        if (!e) return null;
        const r = e.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, label);
    if (!box) return null;
    await page.mouse.move(box.x, box.y);
    await page.mouse.click(box.x, box.y);
    await sleep(1100);
    return true;
}

function subLabels(page) {
    return page.$$eval('.lm-Menu-item .lm-Menu-itemLabel', els => els.map(e => (e.textContent || '').trim()).filter(Boolean));
}

async function closeMenus(page) {
    await page.keyboard.press('Escape');
    await sleep(400);
    await page.keyboard.press('Escape');
    await sleep(400);
}

async function editorLines(page) {
    return page.$$eval('.monaco-editor .view-lines .view-line', els => els.map(e => e.innerText));
}

async function clickEditorLine(page, n) {
    const lines = await page.$$('.monaco-editor .view-lines .view-line');
    await lines[n].click();
    await sleep(300);
}

async function currentLine(page) {
    return page.evaluate(() => {
        const lines = document.querySelectorAll('.view-lines .view-line');
        if (!lines.length) return null;
        const cl = document.querySelector('.current-line');
        if (!cl) return null;
        const first = lines[0];
        const fTop = first.getBoundingClientRect().top;
        const fLine = parseInt(first.getAttribute('data-linenumber')) || 1;
        const lh = first.getBoundingClientRect().height;
        return Math.round((cl.getBoundingClientRect().top - fTop) / lh) + fLine;
    });
}

async function modelText(page) {
    return page.evaluate(() => {
        const el = document.querySelector('.monaco-editor textarea, .monaco-editor .inputarea');
        const w = el ? el.closest('.monaco-editor') : null;
        return w ? Array.from(w.querySelectorAll('.view-line')).map(e => e.innerText).join('\n') : '';
    });
}

async function statusLang(page) {
    return page.evaluate(() => document.querySelector('[id="status-bar-notepadia.language"]')?.textContent.trim() || null);
}

async function statusBar(page) {
    return page.evaluate(() => Array.from(document.querySelectorAll('#theia-statusBar > *')).map(e => (e.textContent || '').trim()).filter(Boolean).join(' | '));
}

module.exports = {
    URL, WS, assert, finish, sleep, waitFor, launchPage, goto,
    openFile, save, openTopMenu, findItemIndex, clickMenuItem, clickSubMenuItem,
    clickByLabel, hoverByLabel, openMenuBar, subLabels, closeMenus,
    editorLines, clickEditorLine, currentLine, modelText, statusLang, statusBar
};