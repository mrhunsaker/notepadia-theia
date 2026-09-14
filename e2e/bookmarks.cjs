const { assert, finish, sleep, waitFor, launchPage, goto, openFile,
    currentLine, clickEditorLine, openMenuBar, hoverByLabel, clickByLabel, subLabels, closeMenus } = require('./lib.js');

(async () => {
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await goto(page);
    await openFile(page, 'bookmarks.txt');
    await page.evaluate(() => document.querySelector('.monaco-editor').focus());
    await sleep(400);

    async function pressCombo(keys) {
        await page.keyboard.down(keys[0]);
        if (keys[1]) await page.keyboard.press(keys[1]);
        await page.keyboard.up(keys[0]);
        await sleep(500);
    }
    const decoCount = () => page.evaluate(() => document.querySelectorAll('.notepadia-bookmark-glyph').length);

    await page.keyboard.down('Control'); await page.keyboard.press('Home'); await page.keyboard.up('Control'); await sleep(300);
    await page.keyboard.press('ArrowDown'); await sleep(300);
    assert('cursor on line 2', await currentLine(page) === 2, 'line=' + await currentLine(page));

    await pressCombo(['Control', 'F2']);
    assert('Ctrl+F2 toggles bookmark on', (await decoCount()) === 1, 'count=' + await decoCount());
    await pressCombo(['Control', 'F2']);
    assert('Ctrl+F2 toggles bookmark off', (await decoCount()) === 0, 'count=' + await decoCount());

    for (const lineNo of [2, 3, 4]) {
        await clickEditorLine(page, lineNo - 1);
        await pressCombo(['Control', 'F2']);
    }
    assert('three bookmarks on lines 2/3/4', (await decoCount()) === 3, 'count=' + await decoCount());

    await page.keyboard.down('Control'); await page.keyboard.press('Home'); await page.keyboard.up('Control'); await sleep(300);
    const seq = [];
    for (let i = 0; i < 4; i++) { await page.keyboard.press('F2'); await sleep(400); seq.push(await currentLine(page)); }
    assert('F2 next wraps 2,3,4,2', JSON.stringify(seq) === '[2,3,4,2]', JSON.stringify(seq));
    const seqPrev = [];
    for (let i = 0; i < 3; i++) { await pressCombo(['Shift', 'F2']); seqPrev.push(await currentLine(page)); }
    assert('Shift+F2 previous wraps 4,3,2', JSON.stringify(seqPrev) === '[4,3,2]', JSON.stringify(seqPrev));

    await closeMenus(page);
    await openMenuBar(page, 'Edit');
    await hoverByLabel(page, 'Bookmarks');
    await sleep(1000);
    await page.waitForFunction(() => Array.from(document.querySelectorAll('.lm-Menu-item .lm-Menu-itemLabel'))
        .some(l => (l.textContent || '').trim() === 'Toggle Bookmark'), { timeout: 10000 });
    const bmItems = (await subLabels(page)).filter(l => l && l !== 'Bookmarks');
    assert('Bookmarks submenu has toggle/next/prev/clear',
        ['Toggle Bookmark', 'Next Bookmark', 'Previous Bookmark', 'Clear All Bookmarks'].every(l => bmItems.includes(l)),
        JSON.stringify(bmItems));
    await clickByLabel(page, 'Clear All Bookmarks');
    await closeMenus(page);
    assert('Clear All Bookmarks removes decorations', (await decoCount()) === 0, 'count=' + await decoCount());

    assert('no page errors', errors.length === 0, JSON.stringify(errors));
    await finish(browser);
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });