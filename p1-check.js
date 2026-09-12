const puppeteer = require('puppeteer');
const SHOT = '/tmp/opencode/';
const URL = 'http://127.0.0.1:3000/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitFor(page, selector, timeout = 30000, msg) {
    try {
        await page.waitForSelector(selector, { timeout, visible: true });
    } catch (e) {
        throw new Error('Timeout waiting for ' + selector + (msg ? ' (' + msg + ')' : ''));
    }
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
    const idx = await page.$$eval('.lm-Menu-item', (els, l) =>
        els.findIndex(e => (e.querySelector('.lm-Menu-itemLabel')?.innerText || '').trim() === l), label);
    return idx;
}

// Open top-level menu `menu`, then click item whose label === label.
async function clickMenuItem(page, menu, label) {
    await openTopMenu(page, menu);
    const idx = await findItemIndex(page, label);
    if (idx < 0) throw new Error('menu item not found: ' + menu + ' > ' + label);
    const all = await page.$$('.lm-Menu-item');
    await all[idx].click();
    await sleep(700);
}

async function editorLines(page) {
    return page.$$eval('.monaco-editor .view-lines .view-line', els => els.map(e => e.innerText));
}

async function clickEditorLine(page, n) {
    const lines = await page.$$('.monaco-editor .view-lines .view-line');
    await lines[n].click();
    await sleep(300);
}

(async () => {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });

    await page.goto(URL, { waitUntil: 'networkidle2' });
    await waitFor(page, '#theia-app-shell', 60000, 'app shell');
    await waitFor(page, '.lm-MenuBar', 30000, 'menu bar');
    await sleep(2500);

    const menubar = await page.$$eval('.lm-MenuBar-item', els => els.map(e => e.innerText.trim()));
    console.log('MENUBAR:', JSON.stringify(menubar));
    const required = ['File', 'Edit', 'Search', 'View', 'Encoding', 'Language', 'Settings'];
    console.log('Missing top-level:', required.filter(r => !menubar.some(m => m.startsWith(r))).join(',') || 'none');

    await page.screenshot({ path: SHOT + 'p1-initial.png' });

    // Open sample.txt via quick-open
    await page.keyboard.down('Control'); await page.keyboard.press('KeyP'); await page.keyboard.up('Control');
    await sleep(1500);
    const input = await page.$('#quick-input-container input');
    await input.type('sam', { delay: 40 });
    await sleep(800);
    await page.keyboard.press('Enter');
    await waitFor(page, '.monaco-editor', 30000, 'monaco editor');
    await sleep(1200);

    let lines = await editorLines(page);
    console.log('INITIAL LINES:', JSON.stringify(lines));
    if (lines.slice(0, 3).join('/') !== 'alpha/beta/gamma') {
        throw new Error('unexpected initial content: ' + JSON.stringify(lines));
    }

    // Position cursor on "beta" (line 2)
    await clickEditorLine(page, 1);

    // Duplicate Current Line (cursor on beta)
    await clickMenuItem(page, 'Edit', 'Duplicate Current Line');
    lines = await editorLines(page);
    console.log('AFTER DUPLICATE LINE:', JSON.stringify(lines));

    // Delete Current Line (remove one of the duplicated betas)
    await clickMenuItem(page, 'Edit', 'Delete Current Line');
    lines = await editorLines(page);
    console.log('AFTER DELETE LINE:', JSON.stringify(lines));

    // Move Current Line Up (move gamma above beta)
    await clickEditorLine(page, 2);
    await clickMenuItem(page, 'Edit', 'Move Current Line Up');
    lines = await editorLines(page);
    console.log('AFTER MOVE LINE UP:', JSON.stringify(lines));

    // Join Lines (join gamma+beta pair, cursor area)
    await clickEditorLine(page, 1); // beta (now #2? lines=alpha,gamma,beta... recheck)
    await clickMenuItem(page, 'Edit', 'Join Lines');
    lines = await editorLines(page);
    console.log('AFTER JOIN LINES:', JSON.stringify(lines));

    // Line Operations -> Sort Lines Descending
    await clickMenuItem(page, 'Edit', 'Line Operations');
    await sleep(500);
    const sortIdx = await findItemIndex(page, 'Sort Lines Descending');
    console.log('sort idx:', sortIdx);
    if (sortIdx >= 0) {
        const all = await page.$$('.lm-Menu-item');
        await all[sortIdx].click();
    }
    await sleep(600);
    lines = await editorLines(page);
    console.log('AFTER SORT DESC:', JSON.stringify(lines));

    // Convert Case -> UPPER CASE
    await clickMenuItem(page, 'Edit', 'Convert Case');
    await sleep(500);
    const caseIdx = await findItemIndex(page, 'UPPER CASE');
    if (caseIdx >= 0) {
        const all = await page.$$('.lm-Menu-item');
        await all[caseIdx].click();
    }
    await sleep(600);
    lines = await editorLines(page);
    console.log('AFTER UPPER CASE:', JSON.stringify(lines));

    await page.screenshot({ path: SHOT + 'p1-editor-commands.png' });

    // Keybinding spot-check: Ctrl+Shift+S (Save All) should not throw; check server log instead.
    console.log('PAGE ERRORS:', errors.length ? errors : 'none');
    await browser.close();
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });