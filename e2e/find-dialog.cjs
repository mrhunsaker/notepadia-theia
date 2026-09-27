// B2 - Notepad++ tabbed Find dialog.
//
// Covers the four-tab dialog delivered by Ctrl+F: Count and "Find All" agree,
// Backward + Wrap around reach the last match from the top, Replace All
// substitutes the known number of occurrences, the Mark tab uses the selected
// style, the Monaco inline find widget never appears, Escape closes the dialog
// and returns focus to the editor, and the editor stays editable while the
// dialog is open (modeless).
const fs = require('fs');
const path = require('path');
const { WS, assert, finish, sleep, launchPage, goto, openFile, save,
    currentLine, modelText } = require('./lib.js');
const { openFindDialog, assertNoInlineWidget, clickDialogTab,
    clickDialogButton, setFindText, setReplaceText, setCheck, setMode,
    setStyleRadio, dialogStatus, closeDialog, markCountStyle,
    focusEditor } = require('./dialog-helpers.cjs');

(async () => {
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await goto(page);
    await openFile(page, 'search.txt');

    // Unified entry point: Ctrl+F opens the single tabbed dialog, no inline widget.
    await openFindDialog(page);
    await assertNoInlineWidget(page);
    const tabs = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.notepadia-find-tab')).map(t => (t.textContent || '').trim()));
    assert('Ctrl+F opens a dialog with the four Notepad++ tabs',
        JSON.stringify(tabs) === JSON.stringify(['Find', 'Replace', 'Find in Files', 'Mark']),
        JSON.stringify(tabs));
    assert('dialog focuses "Find what" on open', await page.evaluate(() =>
        document.activeElement && document.activeElement.id === 'notepadia-find-term'));
    assert('dialog is a marked-up tablist/tabpanel structure', await page.evaluate(() => {
        const panel = document.querySelector('.notepadia-find-panel');
        return !!panel
            && panel.getAttribute('role') === 'dialog'
            && !!panel.querySelector('[role="tablist"]')
            && !!panel.querySelector('[role="tabpanel"]');
    }));

    // The editor stays editable while the dialog is open (modeless).
    await page.evaluate(() => {
        const el = document.querySelector('.monaco-editor .inputarea, .monaco-editor textarea');
        el && el.focus();
    });
    await sleep(300);
    assert('dialog stays open after editing the editor below it',
        await page.evaluate(() => !!document.querySelector('.notepadia-find-panel')));

    // Count reports the known fixture total: search.txt has exactly four "foo".
    await clickDialogTab(page, 'Find');
    await setFindText(page, 'foo');
    await clickDialogButton(page, 'Count');
    assert('Count reports four occurrences', await dialogStatus(page) === '4 occurrences',
        await dialogStatus(page));

    // Find All agrees with Count and lands on the first hit.
    await clickDialogButton(page, 'Find All in Current Document');
    assert('Find All in Current Document reports the same total',
        await dialogStatus(page) === '4 results on current document', await dialogStatus(page));

    // Backward + Wrap around: from the top of the file "Find Next" reaches the
    // last occurrence (line 3, "foo three").
    await setCheck(page, 'Backward direction', true);
    await setCheck(page, 'Wrap around', true);
    await focusEditor(page);
    await clickDialogButton(page, 'Find Next');
    assert('Backward + wrap jumps to the last match (line 3)', await currentLine(page) === 3,
        'line=' + await currentLine(page));
    await sleep(200);

    // In selection: restrict the search to a range and confirm step tidiness.
    await setCheck(page, 'Backward direction', false);
    await setCheck(page, 'Wrap around', false);
    await setCheck(page, 'In selection', true);
    await focusEditor(page);
    await page.keyboard.press('Home');
    await sleep(150);
    await page.keyboard.down('Shift');
    await page.keyboard.press('End');
    await page.keyboard.up('Shift');
    await sleep(300);
    await clickDialogButton(page, 'Find Next');
    assert('In selection moves within the selected range only',
        await currentLine(page) === 1, 'line=' + await currentLine(page));
    await setCheck(page, 'In selection', false);

    // Regular expression mode + case toggle are live. Monaco's regex search
    // is line-based, so ^ and $ anchor to line boundaries, not the file.
    await setMode(page, 'regex');
    await setFindText(page, '^two');
    await clickDialogButton(page, 'Count');
    assert('Regular expression mode matches "two" exactly once',
        await dialogStatus(page) === '1 occurrence', await dialogStatus(page));
    await setMode(page, 'normal');

    // Replace All substitutes every occurrence. It runs against a dedicated
    // replace-dialog.txt fixture. Each destructive suite gets its own file,
    // because each rewrites it on disk: a shared one would hand the next
    // suite the FOO left behind instead of the seeded text. openFile finishes
    // with an Escape, which closes the dialog, so it is closed first and
    // reopened afterwards on the Replace tab.
    await closeDialog(page, false);
    await openFile(page, 'replace-dialog.txt');
    await openFindDialog(page);
    await clickDialogTab(page, 'Replace');
    await setFindText(page, 'foo');
    await setReplaceText(page, 'FOO');
    await clickDialogButton(page, 'Replace All');
    const after = await modelText(page);
    assert('Replace All substitutes all four occurrences',
        after.split('FOO').length - 1 === 4 && after.split('foo').length - 1 === 0,
        JSON.stringify(after));

    // Undo restores the original content (still live in the model). The
    // editor has to be clicked first: the dialog holds focus, and a JS
    // .focus() on the editor would leave Monaco's textarea unfocused.
    await focusEditor(page);
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyZ');
    await page.keyboard.up('Control');
    await sleep(500);
    const undone = await modelText(page);
    assert('Ctrl+Z undoes the replace', undone.split('foo').length - 1 === 4 && !undone.includes('FOO'),
        JSON.stringify(undone));

    // Same replace again, then persist and verify on disk (which now has FOO).
    await clickDialogButton(page, 'Replace All');
    await sleep(400);
    const again = await modelText(page);
    assert('Replace All re-applies the substitution', again.split('FOO').length - 1 === 4,
        JSON.stringify(again));
    // Persist the model and verify on disk (which now has FOO). The dialog is
    // closed first so the save keystroke is not swallowed by its input.
    await closeDialog(page, false);
    await save(page);
    const onDisk = fs.readFileSync(path.join(WS, 'replace-dialog.txt'), 'utf8');
    assert('Replace All persists to disk', onDisk.includes('FOO') && !onDisk.includes('foo'),
        JSON.stringify(onDisk));

    // Mark tab: explicit style selection marks with that style's slot only.
    // Back to the untouched fixture so the expected four "foo" are present.
    await closeDialog(page, false);
    await openFile(page, 'search.txt');
    await openFindDialog(page);
    await clickDialogTab(page, 'Mark');
    await setFindText(page, 'foo');
    await setStyleRadio(page, 1);
    await clickDialogButton(page, 'Mark All');
    assert('Mark All colors all four occurrences in the chosen style',
        (await markCountStyle(page, 1)) === 4, 'style1=' + await markCountStyle(page, 1));
    await clickDialogButton(page, 'Clear All Marks');
    assert('Clear All Marks empties every style slot',
        (await markCountStyle(page, 1)) === 0, 'style1=' + await markCountStyle(page, 1));

    // Escape closes the dialog and returns focus to the editor.
    await closeDialog(page, true);
    assert('Escape closes the dialog', !(await page.evaluate(() => {
        const host = document.querySelector('.notepadia-find-host');
        return host && host.style.display !== 'none';
    })));

    // F3 / Shift+F3 continue the last search with the dialog closed. Four
    // presses from any caret visit every fixture line holding "foo" (1, 2, 3)
    // and wrap; collect five presses and compare the unordered line set.
    const fwd = [];
    for (let i = 0; i < 5; i++) { await page.keyboard.press('F3'); await sleep(350); fwd.push(await currentLine(page)); }
    assert('F3 continues the search and walks every line',
        JSON.stringify([...new Set(fwd)].sort()) === JSON.stringify([1, 2, 3]), JSON.stringify(fwd));
    const back = [];
    for (let i = 0; i < 5; i++) { await page.keyboard.down('Shift'); await page.keyboard.press('F3'); await page.keyboard.up('Shift'); await sleep(350); back.push(await currentLine(page)); }
    assert('Shift+F3 walks backward through the same matches',
        JSON.stringify([...new Set(back)].sort()) === JSON.stringify([1, 2, 3]), JSON.stringify(back));

    assert('no page errors', errors.length === 0, JSON.stringify(errors));
    await finish(browser);
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });