const fs = require('fs');
const os = require('os');
const path = require('path');
const { assert, finish, sleep, launchPage, goto, openFile,
    openMenuBar, hoverByLabel, clickByLabel, subLabels, closeMenus, save } = require('./lib.js');

const WS = process.env.E2E_WS || path.join(os.tmpdir(), 'notepadia-e2e-ws');
const SAMPLE = path.join(WS, 'indent.txt');

const indentStatus = page => page.evaluate(() =>
    document.querySelector('[id="status-bar-notepadia.indent"]')?.textContent?.trim() || null);

const statusWord = async page => ((await indentStatus(page)) || '').split(':')[0];

async function clickEditorFirstLine(page) {
    const box = await page.evaluate(() => {
        const el = document.querySelector('.monaco-editor .view-lines');
        const r = el.getBoundingClientRect();
        return { x: r.x + 60, y: r.y + 30 };
    });
    await page.mouse.click(box.x, box.y);
    await sleep(400);
}

async function toggleIndentMode(page, label, targetWord) {
    for (let attempt = 1; attempt <= 5; attempt++) {
        await page.keyboard.press('Escape');
        await sleep(300);
        await openMenuBar(page, 'View');
        await hoverByLabel(page, 'Tab Size');
        await sleep(800);
        await clickByLabel(page, label);
        await sleep(900);
        if ((await statusWord(page)) === targetWord) {
            return true;
        }
    }
    return false;
}

async function typeIndentedLineAndSave(page, marker) {
    await clickEditorFirstLine(page);
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await page.keyboard.type(marker);
    await save(page);
    return fs.readFileSync(SAMPLE, 'utf8').split('\n').find(line => line.includes(marker)) || '';
}

(async () => {
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await goto(page);
    await openFile(page, 'indent.txt');

    const initialWord = await statusWord(page);
    assert('status shows an indent mode', ['Spaces', 'Tabs'].includes(initialWord),
        'status=' + await indentStatus(page));
    // A6: with Notepad++ defaults on a cold profile the initial mode is real
    // tabs (insertSpaces=false) at width 4.
    assert('cold-profile default is tabs-4', (await indentStatus(page)) === 'Tabs: 4',
        'status=' + await indentStatus(page));

    await openMenuBar(page, 'View');
    await hoverByLabel(page, 'Tab Size');
    await sleep(800);
    const tabItems = await subLabels(page);
    assert('Tab Size submenu has Insert Spaces and Use Tabs',
        tabItems.includes('Insert Spaces') && tabItems.includes('Use Tabs'),
        JSON.stringify(tabItems));
    await closeMenus(page);

    assert('Insert Spaces selects spaces mode', await toggleIndentMode(page, 'Insert Spaces', 'Spaces'),
        'status=' + await indentStatus(page));
    const spacesLine = await typeIndentedLineAndSave(page, 'NOTEPADIA_SPACES');
    assert('Tab inserts spaces in Insert Spaces mode', spacesLine.startsWith('    ') && !spacesLine.startsWith('\t'),
        JSON.stringify(spacesLine));

    assert('Use Tabs selects tabs mode', await toggleIndentMode(page, 'Use Tabs', 'Tabs'),
        'status=' + await indentStatus(page));
    const tabsLine = await typeIndentedLineAndSave(page, 'NOTEPADIA_TABS');
    assert('Tab inserts a tab character in Use Tabs mode', tabsLine.startsWith('\t'),
        JSON.stringify(tabsLine));

    assert('Insert Spaces restores spaces mode', await toggleIndentMode(page, 'Insert Spaces', 'Spaces'),
        'status=' + await indentStatus(page));

    assert('no page errors', errors.length === 0, JSON.stringify(errors));
    await finish(browser);
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });