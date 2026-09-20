const { assert, finish, sleep, launchPage, goto, openFile,
    openMenuBar, subLabels, closeMenus, modelText } = require('./lib.js');

async function press(page, mods, key) {
    for (const m of mods) await page.keyboard.down(m);
    await page.keyboard.press(key);
    for (const m of mods) await page.keyboard.up(m);
    await sleep(700);
}

(async () => {
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await goto(page);
    await openFile(page, 'sample.txt');

    // File menu matches Notepad++ order (no Theia/workspace clutter, no duplicates)
    await openMenuBar(page, 'File');
    const fileItems = await subLabels(page);
    assert('File menu is Notepad++ order',
        JSON.stringify(fileItems) === JSON.stringify(
            ['New', 'Open...', 'Recent Files', 'Save', 'Save As...', 'Save All',
                'Close', 'Close All', 'Close All But Active',
                'Save Session...', 'Load Session...',
                'Print', 'Print Preview...']),
        JSON.stringify(fileItems));
    await closeMenus(page);

    // Edit menu keeps Find out (Notepad++ puts it under Search only)
    await openMenuBar(page, 'Edit');
    const editItems = await subLabels(page);
    assert('Edit menu has no Find/Replace',
        !editItems.some(i => /find|replace/i.test(i)),
        JSON.stringify(editItems));
    assert('Edit menu keeps line operations',
        editItems.includes('Duplicate Current Line') && editItems.includes('Delete Current Line') &&
        editItems.includes('Line Operations') && editItems.includes('Convert Case'),
        JSON.stringify(editItems));
    await closeMenus(page);

    // Search menu still owns Find/Replace/Find in Files
    await openMenuBar(page, 'Search');
    const searchItems = await subLabels(page);
    assert('Search menu has Find/Replace/Find in Files',
        searchItems.includes('Find...') && searchItems.includes('Replace...') &&
        searchItems.includes('Find in Files') && searchItems.includes('Go To Line...'),
        JSON.stringify(searchItems));
    await closeMenus(page);

    // Ctrl+Shift+U uppercases the selection, Ctrl+U lowercases it
    const base = await modelText(page);
    await page.evaluate(() => {
        const el = document.querySelector('.monaco-editor .inputarea, .monaco-editor textarea');
        el && el.focus();
    });
    await sleep(300);
    await press(page, ['Control'], 'KeyA');
    await press(page, ['Control', 'Shift'], 'KeyU');
    const upper = await modelText(page);
    assert('Ctrl+Shift+U uppercases the document', upper === base.toUpperCase(),
        'base=' + JSON.stringify(base) + ' upper=' + JSON.stringify(upper));
    await press(page, ['Control'], 'KeyU');
    const lower = await modelText(page);
    assert('Ctrl+U lowercases the document (overrides Monaco cursor undo)', lower === base,
        'base=' + JSON.stringify(base) + ' lower=' + JSON.stringify(lower));

    assert('no page errors', errors.length === 0, JSON.stringify(errors));
    await finish(browser);
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });