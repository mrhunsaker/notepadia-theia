const fs = require('fs');
const path = require('path');
const { assert, finish, sleep, launchPage, goto, openFile, waitFor,
    openMenuBar, clickByLabel, closeMenus, WS } = require('./lib.js');

async function openSessionDialog(page, label, dialogSel = '.dialogContent') {
    await openMenuBar(page, 'File');
    await clickByLabel(page, label);
    await waitFor(page, dialogSel, 10000, label + ' dialog');
}

function tabs(page) {
    // scope to the main content area so sidebar view tabs (Explorer, Search,
    // Problems, Outline) are not counted as document tabs
    return page.$$eval('#theia-main-content-panel .lm-TabBar-tab',
        els => els.map(e => (e.innerText || '').trim()).filter(Boolean));
}

function activeTab(page) {
    return page.evaluate(() => {
        const el = document.querySelector('#theia-main-content-panel .lm-TabBar-tab.lm-mod-current, #theia-main-content-panel .p-TabBar-tab.p-mod-current');
        return el ? (el.innerText || '').trim() : null;
    });
}

(async () => {
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await goto(page);
    await openFile(page, 'search.txt');
    await openFile(page, 'app.js');

    // Save Session writes session.json into the workspace root
    await openSessionDialog(page, 'Save Session...');
    const inputHasDefault = await page.evaluate(() => {
        const el = document.querySelector('.dialogContent input[type="text"]');
        return el ? el.value : null;
    });
    assert('Save Session dialog defaults the name to session', inputHasDefault === 'session',
        'value=' + inputHasDefault);
    const saveButton = await page.evaluate(() => {
        const el = document.querySelector('.dialogControl button.main');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    assert('Save Session dialog has a Save button', !!saveButton, 'no .dialogControl button.main');
    await page.mouse.click(saveButton.x, saveButton.y);
    await sleep(1500);

    const sessionPath = path.join(WS, 'session.json');
    const onDisk = fs.existsSync(sessionPath);
    assert('session.json written to the workspace root', onDisk, sessionPath);
    if (onDisk) {
        const data = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
        assert('session file has version 1', data.version === 1, data.version);
        assert('session file lists both documents in order',
            data.files.length === 2
            && data.files[0].endsWith('/search.txt')
            && data.files[1].endsWith('/app.js'),
            JSON.stringify(data.files));
        assert('session file records the active document',
            typeof data.activeFile === 'string' && data.activeFile.endsWith('/app.js'),
            String(data.activeFile));
    }

    // Close All, then load the session back
    await openMenuBar(page, 'File');
    await clickByLabel(page, 'Close All');
    await sleep(1200);
    await closeMenus(page);
    const afterClose = await tabs(page).catch(() => []);
    assert('Close All emptied the tab bar', afterClose.length === 0, JSON.stringify(afterClose));

    await openSessionDialog(page, 'Load Session...');
    await page.evaluate(() => {
        const select = document.querySelector('.dialogContent select');
        if (select) {
            select.value = 'session.json';
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });
    await sleep(300);
    const loadButton = await page.evaluate(() => {
        const el = document.querySelector('.dialogControl button.main');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await page.mouse.click(loadButton.x, loadButton.y);
    await sleep(3000);

    const afterLoad = await tabs(page);
    assert('session reopens both documents',
        afterLoad.includes('search.txt') && afterLoad.includes('app.js') && afterLoad.length === 2,
        JSON.stringify(afterLoad));
    const active = await activeTab(page);
    assert('session restores the active document', active === 'app.js', 'active=' + active);

    assert('no page errors', errors.length === 0, JSON.stringify(errors));
    await finish(browser);
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });