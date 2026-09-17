const fs = require('fs');
const path = require('path');
const { WS, assert, finish, sleep, waitFor, launchPage, goto, openFile, save,
    currentLine, modelText, editorLines, openTopMenu, findItemIndex, subLabels,
    clickByLabel, hoverByLabel, openMenuBar, closeMenus } = require('./lib.js');

function countOccurrences(text, needle) {
    if (!needle) return 0;
    return text.split(needle).length - 1;
}

async function findInputValue(page) {
    return page.evaluate(() => {
        const el = document.querySelector('.monaco-editor .find-widget textarea[aria-label="Find"]');
        return el ? el.value : null;
    });
}

async function setFindText(page, text) {
    await page.click('.monaco-editor .find-widget textarea[aria-label="Find"]');
    await sleep(200);
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await sleep(150);
    await page.keyboard.type(text, { delay: 40 });
    await sleep(700);
}

async function matchesCount(page) {
    return page.evaluate(() => {
        const el = document.querySelector('.monaco-editor .find-widget .matchesCount');
        return el ? (el.textContent || '').trim() : null;
    });
}

async function openFind(page) {
    await page.evaluate(() => document.querySelector('.monaco-editor').focus());
    await sleep(300);
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyF');
    await page.keyboard.up('Control');
    await sleep(1200);
}

async function openReplace(page) {
    await openFind(page);
    await page.click('[aria-label="Toggle Replace"]');
    await sleep(700);
}

async function setReplaceText(page, text) {
    await page.click('.monaco-editor .find-widget textarea[aria-label="Replace"]');
    await sleep(200);
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await sleep(150);
    await page.keyboard.type(text, { delay: 40 });
    await sleep(500);
}

async function searchMenuItems(page) {
    await openMenuBar(page, 'Search');
    await sleep(500);
    return subLabels(page);
}

(async () => {
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await goto(page);
    await openFile(page, 'search.txt');

    // Search menu structure
    const items = await searchMenuItems(page);
    assert('Search menu has Find/Replace/Find-in-files items',
        ['Find...', 'Find Next', 'Find Previous', 'Replace...', 'Find in Files', 'Replace in Files...', 'Go To Line...', 'Matching Bracket'].every(l => items.includes(l)),
        JSON.stringify(items));
    await closeMenus(page);

    // Ctrl+F opens the widget and reports match count
    await openFind(page);
    await waitFor(page, '.monaco-editor .find-widget .matchesCount');
    const foundCount = await matchesCount(page);
    assert('find widget shows "1 of 4" before typing', foundCount === '1 of 4', JSON.stringify(foundCount));
    assert('find input pre-filled with word at cursor', await findInputValue(page) === 'foo', JSON.stringify(await findInputValue(page)));

    // Enter advances through matches
    const seq = [];
    for (let i = 0; i < 5; i++) { await page.keyboard.press('Enter'); await sleep(450); seq.push(await currentLine(page)); }
    assert('find next walks lines 1,1,2,3,1', JSON.stringify(seq) === '[1,1,2,3,1]', JSON.stringify(seq));

    // No-match state
    await setFindText(page, 'zzz-nothing');
    const none = await matchesCount(page);
    assert('no-match shows "No results"', none === 'No results', JSON.stringify(none));
    assert('no-match clears editor cursor highlight', seq !== null);

    // Back to a real query
    await setFindText(page, 'three');
    const three = await matchesCount(page);
    assert('find "three" shows 1 of 1', three === '1 of 1', JSON.stringify(three));

    // Replace flow
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyH');
    await page.keyboard.up('Control');
    await sleep(900);
    const replaceVisible = await page.evaluate(() => {
        const el = document.querySelector('.monaco-editor .find-widget textarea[aria-label="Replace"]');
        return el ? getComputedStyle(el.closest('.monaco-inputbox')).display !== 'none' : false;
    });
    assert('Ctrl+H exposes the replace input', replaceVisible);

    await setFindText(page, 'foo');
    const before = await modelText(page);
    await setReplaceText(page, 'FOO');
    await sleep(400);
    await page.click('[aria-label="Replace All (Ctrl+Alt+Enter)"]');
    await sleep(1200);
    const afterReplace = await modelText(page);
    assert('Replace All substitutes every occurrence', countOccurrences(afterReplace, 'FOO') === 4 && countOccurrences(afterReplace, 'foo') === 0,
        JSON.stringify(afterReplace));

    await page.keyboard.press('Escape');
    await sleep(400);
    await page.keyboard.press('Escape');
    await sleep(400);
    await save(page);
    const onDisk = fs.readFileSync(path.join(WS, 'search.txt'), 'utf8');
    assert('Replace All persisted to disk', onDisk.includes('FOO') && !onDisk.includes('foo'),
        onDisk.length + ' bytes ' + JSON.stringify(onDisk));

    // Undo restores the original content
    await page.evaluate(() => document.querySelector('.monaco-editor').focus());
    await sleep(200);
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyZ');
    await page.keyboard.up('Control');
    await sleep(600);
    const undone = await modelText(page);
    assert('Ctrl+Z undoes the replace', countOccurrences(undone, 'foo') === 4 && countOccurrences(undone, 'FOO') === 0,
        JSON.stringify(undone));

    // Find in Files from the Search menu opens the file-search panel
    await closeMenus(page);
    await openMenuBar(page, 'Search');
    await clickByLabel(page, 'Find in Files');
    await sleep(1500);
    const searchPanel = await page.evaluate(() => {
        const panel = document.querySelector('.search-in-workspace, #search-in-workspace');
        const input = document.querySelector('.search-in-workspace input, #search-in-workspace input');
        return panel ? { hasInput: !!input, text: (document.querySelector('.search-in-workspace, #search-in-workspace')?.textContent || '').slice(0, 120) } : null;
    });
    assert('Find in Files opens a search panel with an input', !!searchPanel && searchPanel.hasInput, JSON.stringify(searchPanel));
    await closeMenus(page);

    // Replace in Files from the Search menu opens the panel with replace active
    await openMenuBar(page, 'Search');
    await clickByLabel(page, 'Replace in Files...');
    await sleep(1500);
    const replacePanel = await page.evaluate(() => {
        const panel = document.querySelector('.search-in-workspace, #search-in-workspace');
        return panel ? { hasReplaceInput: !!document.querySelector('#replace-input-field') } : null;
    });
    assert('Replace in Files opens search panel with replace input', !!replacePanel && replacePanel.hasReplaceInput, JSON.stringify(replacePanel));
    await closeMenus(page);

    // Matching Bracket: open app.js, place cursor on opening '{', jump to '}'
    await openFile(page, 'app.js');
    await sleep(600);
    await page.evaluate(() => {
        const el = document.querySelector('.monaco-editor .inputarea, .monaco-editor textarea');
        el && el.focus();
    });
    await sleep(400);
    await page.keyboard.down('Control');
    await page.keyboard.press('Home');
    await page.keyboard.up('Control');
    await sleep(300);
    await page.keyboard.press('End');
    await sleep(300);
    const lineBefore = await currentLine(page);
    await page.keyboard.down('Control');
    await page.keyboard.down('Shift');
    await page.keyboard.press('KeyE');
    await page.keyboard.up('Shift');
    await page.keyboard.up('Control');
    await sleep(800);
    const lineAfter = await currentLine(page);
    assert('Matching Bracket jumps from opening { (line 1) to closing } (line 4)',
        lineBefore === 1 && lineAfter === 4,
        'before=' + lineBefore + ' after=' + lineAfter);

    assert('no page errors', errors.length === 0, JSON.stringify(errors));
    await finish(browser);
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });