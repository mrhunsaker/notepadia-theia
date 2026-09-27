const fs = require('fs');
const path = require('path');
const { WS, assert, finish, sleep, waitFor, launchPage, goto, openFile, save,
    currentLine, modelText, openMenuBar, subLabels, clickByLabel, closeMenus } = require('./lib.js');
const { openFindDialog, assertNoInlineWidget, setFindText, setReplaceText,
    clickDialogTab, clickDialogButton, dialogStatus, closeDialog,
    focusEditor } = require('./dialog-helpers.cjs');

function countOccurrences(text, needle) {
    if (!needle) return 0;
    return text.split(needle).length - 1;
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
    assert('Search menu has the full Notepad++ order incl. Mark...',
        ['Find...', 'Find Next', 'Find Previous', 'Replace...', 'Find in Files', 'Replace in Files...', 'Mark...', 'Go To Line...', 'Matching Bracket'].every(l => items.includes(l)),
        JSON.stringify(items));
    await closeMenus(page);

    // Ctrl+F opens the tabbed dialog, prefilled with the word at the caret, and
    // never surfaces Monaco's inline find widget.
    await openFindDialog(page);
    await assertNoInlineWidget(page);
    const term = await page.evaluate(() => document.querySelector('#notepadia-find-term').value);
    assert('find dialog pre-fills the word under the cursor',
        term === 'foo', JSON.stringify(term));

    // Enter advances through matches.
    const seq = [];
    for (let i = 0; i < 5; i++) { await page.keyboard.press('Enter'); await sleep(350); seq.push(await currentLine(page)); }
    assert('find next walks lines 1,1,2,3,1', JSON.stringify(seq) === '[1,1,2,3,1]', JSON.stringify(seq));

    // No-match state
    await setFindText(page, 'zzz-nothing');
    await page.keyboard.press('Enter');
    await sleep(350);
    assert('no-match shows "No results"', await dialogStatus(page) === 'No results', await dialogStatus(page));

    // Back to a real query
    await setFindText(page, 'three');
    await page.keyboard.press('Enter');
    await sleep(350);
    assert('find "three" shows 1 of 1', await dialogStatus(page) === '1 of 1', await dialogStatus(page));

    // Ctrl+H opens the Replace tab of the same dialog (not the inline widget).
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyH');
    await page.keyboard.up('Control');
    await sleep(600);
    assert('Ctrl+H lands on the Replace tab', await page.evaluate(() => {
        const tab = document.querySelector('.notepadia-find-tab-active');
        return !!tab && (tab.textContent || '').trim() === 'Replace';
    }));
    await assertNoInlineWidget(page);

    // Replace All runs against a dedicated replace-menu.txt fixture. Each
    // destructive suite gets its own file, because each rewrites it on disk:
    // a shared one would hand the next suite the FOO left behind instead of
    // the seeded text. openFile ends with an Escape, which now closes the
    // dialog, so it is closed first and reopened on the Replace tab.
    await closeDialog(page, false);
    await openFile(page, 'replace-menu.txt');
    await openFindDialog(page);
    await clickDialogTab(page, 'Replace');
    await setFindText(page, 'foo');
    await setReplaceText(page, 'FOO');
    await clickDialogButton(page, 'Replace All');
    const afterReplace = await modelText(page);
    assert('Replace All substitutes every occurrence', countOccurrences(afterReplace, 'FOO') === 4 && countOccurrences(afterReplace, 'foo') === 0,
        JSON.stringify(afterReplace));

    await closeDialog(page, false);
    await save(page);
    const onDisk = fs.readFileSync(path.join(WS, 'replace-menu.txt'), 'utf8');
    assert('Replace All persisted to disk', onDisk.includes('FOO') && !onDisk.includes('foo'),
        onDisk.length + ' bytes ' + JSON.stringify(onDisk));

    // Undo restores the original content. A real click is needed: the dialog
    // held focus and a JS .focus() leaves Monaco's textarea without text focus.
    await focusEditor(page);
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyZ');
    await page.keyboard.up('Control');
    await sleep(600);
    const undone = await modelText(page);
    assert('Ctrl+Z undoes the replace', countOccurrences(undone, 'foo') === 4 && countOccurrences(undone, 'FOO') === 0,
        JSON.stringify(undone));

    // Find in Files from the Search menu opens the dialog's Find in Files tab.
    await openMenuBar(page, 'Search');
    await clickByLabel(page, 'Find in Files');
    await sleep(600);
    const filesTab = await page.evaluate(() => {
        const tab = document.querySelector('.notepadia-find-tab-active');
        return tab ? (tab.textContent || '').trim() : null;
    });
    assert('Search > Find in Files opens the dialog Find in Files tab', filesTab === 'Find in Files', JSON.stringify(filesTab));
    assert('Find in Files tab exposes Filters and Directory fields', await page.evaluate(() =>
        !!document.querySelector('#notepadia-find-filters') && !!document.querySelector('#notepadia-find-directory')));
    await closeDialog(page);

    // Replace in Files from the Search menu also lands on the dialog.
    await openMenuBar(page, 'Search');
    await clickByLabel(page, 'Replace in Files...');
    await sleep(600);
    assert('Search > Replace in Files opens the dialog too', await page.evaluate(() =>
        (document.querySelector('.notepadia-find-tab-active')?.textContent || '').trim() === 'Find in Files'));
    await closeDialog(page);

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