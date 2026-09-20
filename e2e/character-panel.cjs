const fs = require('fs');
const path = require('path');
const { assert, finish, sleep, launchPage, goto, openFile, waitFor,
    openMenuBar, clickByLabel, closeMenus, modelText, WS } = require('./lib.js');

async function openCharacterPanel(page) {
    await openMenuBar(page, 'View');
    await clickByLabel(page, 'Character Panel');
    await waitFor(page, '.notepadia-character-panel', 10000, 'character panel');
}

async function go(page) {
    await page.keyboard.press('Home');
    await sleep(200);
}

(async () => {
    // Earlier suites can leave dirty buffers saved over sample.txt (Theia
    // persists dirty editors on shutdown), so restore the fixture first.
    fs.writeFileSync(path.join(WS, 'sample.txt'), 'alpha\nbeta\ngamma\n');
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await goto(page);
    await openFile(page, 'sample.txt');

    await openCharacterPanel(page);
    const categories = await page.$$eval('.notepadia-character-panel-summary', els => els.map(e => e.textContent.trim()));
    assert('Character Panel lists the expected categories',
        ['Arrows', 'Box Drawing', 'Mathematical', 'Greek', 'Currency', 'Typography', 'Misc']
            .every(c => categories.includes(c)),
        JSON.stringify(categories));

    // Insert an arrow at the start of the first line
    await page.evaluate(() => {
        const el = document.querySelector('.monaco-editor .view-lines .view-line');
        el && el.click();
    });
    await sleep(400);
    await go(page);
    await page.click('.notepadia-character-panel-button[title="Insert →"]');
    await sleep(600);
    const afterArrow = await modelText(page);
    assert('arrow inserted at the cursor on line 1', afterArrow.startsWith('→alpha'),
        'line1=' + JSON.stringify(afterArrow.split('\n')[0]));

    // Insert a box-drawing character on a later line without moving the cursor home
    // (real-coordinate click on the third visible line)
    const line3 = await page.evaluate(() => {
        const lines = document.querySelectorAll('.monaco-editor .view-lines .view-line');
        const el = lines[2];
        const r = el.getBoundingClientRect();
        return { x: r.x + 6, y: r.y + r.height / 2 };
    });
    await page.mouse.click(line3.x, line3.y);
    await sleep(400);
    await go(page);
    await page.click('.notepadia-character-panel-button[title="Insert │"]');
    await sleep(600);
    const afterBox = await modelText(page);
    assert('box character inserted on line 3', afterBox.split('\n')[2].startsWith('│'),
        'line3=' + JSON.stringify(afterBox.split('\n')[2]));

    // Toggling the View entry collapses the panel. A collapsed dock panel keeps
    // its DOM node, so visibility (not existence) is what matters.
    await openMenuBar(page, 'View');
    await clickByLabel(page, 'Character Panel');
    await sleep(1200);
    const visible = await page.evaluate(() => {
        const el = document.querySelector('.notepadia-character-panel');
        return !!el && !!el.getClientRects().length;
    });
    assert('Character Panel closes when toggled again', !visible, 'panel still visible');
    await closeMenus(page);

    assert('no page errors', errors.length === 0, JSON.stringify(errors));
    await finish(browser);
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });