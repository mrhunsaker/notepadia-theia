const { assert, finish, sleep, waitFor, launchPage, goto, openFile,
    openTopMenu, findItemIndex, clickMenuItem, editorLines, clickEditorLine } = require('./lib.js');

(async () => {
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await goto(page);

    const favicon = await page.$eval('link[rel~="icon"]', el => el.getAttribute('href')).catch(() => null);
    assert('branded favicon injected', !!favicon && favicon.indexOf('data:image/svg+xml') === 0, String(favicon).slice(0, 40));

    const menubar = await page.$$eval('.lm-MenuBar-item', els => els.map(e => e.innerText.trim()));
    console.log('menubar:', JSON.stringify(menubar));
    const required = ['File', 'Edit', 'Search', 'View', 'Encoding', 'Language', 'Settings'];
    assert('top-level menus present', required.every(r => menubar.some(m => m.startsWith(r))), JSON.stringify(menubar));

    await openFile(page, 'sample.txt');
    const trimEmpty = arr => arr.filter(l => l !== '');
    let lines = trimEmpty(await editorLines(page));
    assert('initial content alpha/beta/gamma', lines.join('/') === 'alpha/beta/gamma', JSON.stringify(lines));

    await clickEditorLine(page, 1);

    await clickMenuItem(page, 'Edit', 'Duplicate Current Line');
    lines = trimEmpty(await editorLines(page));
    assert('duplicate line duplicates current line', lines.length === 4 && lines.filter(l => l === 'beta').length === 2,
        JSON.stringify(lines));

    await clickMenuItem(page, 'Edit', 'Delete Current Line');
    lines = trimEmpty(await editorLines(page));
    assert('delete line removes one', lines.length === 3 && lines.filter(l => l === 'beta').length === 1,
        JSON.stringify(lines));

    await clickEditorLine(page, 2);
    await clickMenuItem(page, 'Edit', 'Move Current Line Up');
    lines = trimEmpty(await editorLines(page));
    assert('move line up swaps gamma above beta', lines[1] === 'gamma' && lines[2] === 'beta', JSON.stringify(lines));

    await clickEditorLine(page, 1);
    await clickMenuItem(page, 'Edit', 'Join Lines');
    lines = trimEmpty(await editorLines(page));
    assert('join lines merges two into one', lines.length === 2 && lines[1].includes('gamma') && lines[1].includes('beta'),
        JSON.stringify(lines));

    const preSort = trimEmpty(await editorLines(page));
    await clickMenuItem(page, 'Edit', 'Line Operations');
    await sleep(500);
    const sortIdx = await findItemIndex(page, 'Sort Lines Descending');
    assert('Line Operations offers Sort Lines Descending', sortIdx >= 0);
    if (sortIdx >= 0) {
        const all = await page.$$('.lm-Menu-item');
        await all[sortIdx].click();
    }
    await sleep(600);
    lines = trimEmpty(await editorLines(page));
    const sortedDesc = [...preSort].map(s => s.toLowerCase()).sort((a, b) => a < b ? 1 : -1);
    assert('sort descending sorts', JSON.stringify(lines.map(s => s.toLowerCase())) === JSON.stringify(sortedDesc),
        JSON.stringify(preSort) + ' -> ' + JSON.stringify(lines));

    const preCase = trimEmpty(await editorLines(page));
    await clickMenuItem(page, 'Edit', 'Convert Case');
    await sleep(500);
    const caseIdx = await findItemIndex(page, 'UPPER CASE');
    assert('Convert Case offers UPPER CASE', caseIdx >= 0);
    if (caseIdx >= 0) {
        const all = await page.$$('.lm-Menu-item');
        await all[caseIdx].click();
    }
    await sleep(600);
    lines = trimEmpty(await editorLines(page));
    assert('convert to upper case', JSON.stringify(lines) === JSON.stringify(preCase.map(l => l.toUpperCase())),
        JSON.stringify(preCase) + ' -> ' + JSON.stringify(lines));

    assert('no page errors', errors.length === 0, JSON.stringify(errors));
    await finish(browser);
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });