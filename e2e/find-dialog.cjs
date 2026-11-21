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
    currentLine, modelText, openMenuBar, clickByLabel, statusBar, waitFor } = require('./lib.js');
const { openFindDialog, assertNoInlineWidget, clickDialogTab,
    clickDialogButton, setFindText, setReplaceText, setCheck, setMode,
    setStyleRadio, dialogStatus, closeDialog, markCountStyle,
    focusEditor } = require('./dialog-helpers.cjs');

/** The caret's Ln / Col readout from the status bar. */
async function caret(page) {
    const found = /Ln : (\d+),?\s*Col : (\d+)/.exec(await statusBar(page));
    return found ? { line: Number(found[1]), column: Number(found[2]) } : null;
}

/** Monaco renders ordinary spaces as NBSP in some view lines. */
async function editorText(page) {
    return (await modelText(page)).replace(/[\u00a0\u202f\u2007]/g, ' ');
}

(async () => {
    // A folder to pick from the workspace tree for the E3 prefill check, so the
    // selected node is not the root (the root seeds an empty Directory field,
    // which is the field's own default and would prove nothing).
    const subFolder = 'find-sub';
    fs.mkdirSync(path.join(WS, subFolder), { recursive: true });
    fs.writeFileSync(path.join(WS, subFolder, 'inside.txt'), 'foo inside\n', 'utf8');

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
    assert('In selection counts only the matches inside the selection',
        await dialogStatus(page) === '1 of 2', await dialogStatus(page));
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
    const after = await editorText(page);
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
    const undone = await editorText(page);
    assert('Ctrl+Z undoes the replace', undone.split('foo').length - 1 === 4 && !undone.includes('FOO'),
        JSON.stringify(undone));

    // Same replace again, then persist and verify on disk (which now has FOO).
    await clickDialogButton(page, 'Replace All');
    await sleep(400);
    const again = await editorText(page);
    assert('Replace All re-applies the substitution', again.split('FOO').length - 1 === 4,
        JSON.stringify(again));
    // Persist the model and verify on disk (which now has FOO). The dialog is
    // closed first so the save keystroke is not swallowed by its input.
    await closeDialog(page, false);
    await save(page);
    const onDisk = fs.readFileSync(path.join(WS, 'replace-dialog.txt'), 'utf8');
    assert('Replace All persists to disk', onDisk.includes('FOO') && !onDisk.includes('foo'),
        JSON.stringify(onDisk));

    // Replace All must honour "In selection" exactly as Find Next does: only
    // the two occurrences on line 1 change, the ones below are left alone.
    await closeDialog(page, false);
    await openFile(page, 'replace-selection.txt');
    await openFindDialog(page);
    await clickDialogTab(page, 'Replace');
    await setFindText(page, 'foo');
    await setReplaceText(page, 'BAR');
    await setCheck(page, 'In selection', true);
    await focusEditor(page);
    await page.keyboard.press('Home');
    await page.keyboard.down('Shift');
    await page.keyboard.press('End');
    await page.keyboard.up('Shift');
    await sleep(300);
    await clickDialogButton(page, 'Replace All');
    const scopedReplace = await editorText(page);
    assert('Replace All honours In selection',
        scopedReplace === 'BAR one BAR\ntwo foo\nfoo three\n', JSON.stringify(scopedReplace));
    await setCheck(page, 'In selection', false);

    // Regex Replace All expands backreferences. `$1`/`$2` and `\1`/`\2` use
    // separate fixtures so each check starts from the seeded text.
    await closeDialog(page, false);
    await openFile(page, 'regex-replace-dollar.txt');
    await openFindDialog(page);
    await clickDialogTab(page, 'Replace');
    await setMode(page, 'regex');
    await setFindText(page, '(\\w+)@(\\w+)');
    await setReplaceText(page, '$2-$1');
    await clickDialogButton(page, 'Replace All');
    const swapped = await editorText(page);
    assert('regex Replace All expands $1/$2 capture groups',
        swapped === 'example-alice.com\ntest-bob.org\nexample-carol.net\n', JSON.stringify(swapped));

    await closeDialog(page, false);
    await openFile(page, 'regex-replace-backslash.txt');
    await openFindDialog(page);
    await clickDialogTab(page, 'Replace');
    await setMode(page, 'regex');
    await setFindText(page, '(\\w+)@(\\w+)');
    await setReplaceText(page, '[\\1]');
    await clickDialogButton(page, 'Replace All');
    const backreffed = await editorText(page);
    assert('regex Replace All expands \\1 capture groups',
        backreffed === '[alice].com\n[bob].org\n[carol].net\n', JSON.stringify(backreffed));

    // Monaco's FindMatch.matches is a plain array, so named groups have to be
    // recovered by re-running the regex on the matched line.
    await closeDialog(page, false);
    await openFile(page, 'regex-replace-named.txt');
    await openFindDialog(page);
    await clickDialogTab(page, 'Replace');
    await setMode(page, 'regex');
    await setFindText(page, '(?<user>\\w+)@(?<host>\\w+)');
    await setReplaceText(page, '$<host>-$<user>');
    await clickDialogButton(page, 'Replace All');
    const named = await editorText(page);
    assert('regex Replace All expands named groups',
        named === 'example-alice.com\ntest-bob.org\n', JSON.stringify(named));

    // A regex spanning a line break keeps its captures in single Replace too;
    // the old single-line recovery scope returned empty groups here.
    await closeDialog(page, false);
    await openFile(page, 'regex-replace-multiline.txt');
    await openFindDialog(page);
    await clickDialogTab(page, 'Find');
    await setMode(page, 'regex');
    await setFindText(page, '(\\w+)\\n(\\w+)');
    await clickDialogButton(page, 'Find Next');
    await clickDialogTab(page, 'Replace');
    await setReplaceText(page, '$2-$1');
    await clickDialogButton(page, 'Replace');
    const multiline = await editorText(page);
    assert('single Replace expands groups from a multiline regex match',
        multiline.startsWith('second-first\n') && multiline.includes('third\nfourth'),
        JSON.stringify(multiline));

    // Single Replace on the match already selected by Find Next uses the same
    // expansion path, and must not leave a literal backreference behind.
    await closeDialog(page, false);
    await openFile(page, 'regex-replace-single.txt');
    await openFindDialog(page);
    await clickDialogTab(page, 'Find');
    await setMode(page, 'regex');
    await setFindText(page, '(\\w+)@(\\w+)');
    await clickDialogButton(page, 'Find Next');
    await clickDialogTab(page, 'Replace');
    await setReplaceText(page, '[\\1]');
    await clickDialogButton(page, 'Replace');
    const singleStatus = await dialogStatus(page);
    assert('single Replace keeps the replacement count in the status line',
        /character[s]? replaced/.test(singleStatus), singleStatus);
    const single = await editorText(page);
    assert('single Replace expands backreferences on the selected match',
        single.startsWith('[alice].com\n') && single.includes('bob@test.org') && !single.includes('\\1'),
        JSON.stringify(single));

    // A selection only counts as the current match when it is exactly one
    // match according to Monaco. A superset must not be replaced wholesale.
    await closeDialog(page, false);
    await openFile(page, 'regex-selection.txt');
    await openFindDialog(page);
    await clickDialogTab(page, 'Find');
    await setMode(page, 'regex');
    await setFindText(page, 'foo');
    await focusEditor(page);
    await page.keyboard.down('Shift');
    for (let i = 0; i < 7; i++) { await page.keyboard.press('ArrowRight'); }
    await page.keyboard.up('Shift');
    await sleep(300);
    await clickDialogTab(page, 'Replace');
    await setReplaceText(page, 'BAR');
    await clickDialogButton(page, 'Replace');
    const superset = await editorText(page);
    assert('a selection containing a regex match is not replaced wholesale',
        superset === 'xxfooyy BAR\n', JSON.stringify(superset));

    await closeDialog(page, false);
    await openFile(page, 'wholeword-selection.txt');
    await openFindDialog(page);
    await clickDialogTab(page, 'Find');
    await setMode(page, 'normal');
    await setFindText(page, 'foo');
    await setCheck(page, 'Match whole word only', true);
    await focusEditor(page);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.down('Shift');
    for (let i = 0; i < 3; i++) { await page.keyboard.press('ArrowRight'); }
    await page.keyboard.up('Shift');
    await sleep(300);
    await clickDialogTab(page, 'Replace');
    await setReplaceText(page, 'BAR');
    await clickDialogButton(page, 'Replace');
    const wholeWord = await editorText(page);
    assert('whole word ignores a partial word inside a selected superset',
        wholeWord === 'xfooy BAR\n', JSON.stringify(wholeWord));
    await setCheck(page, 'Match whole word only', false);

    // Extended mode decodes escape sequences in the Replace field too.
    await closeDialog(page, false);
    await openFile(page, 'extended-replace.txt');
    await openFindDialog(page);
    await clickDialogTab(page, 'Replace');
    await setMode(page, 'extended');
    await setFindText(page, 'alpha');
    await setReplaceText(page, 'A\\tB');
    await clickDialogButton(page, 'Replace All');
    // `modelText` reads rendered text, where a tab becomes spaces; save and
    // check the bytes on disk instead.
    await closeDialog(page, false);
    await save(page);
    const extendedOnDisk = fs.readFileSync(path.join(WS, 'extended-replace.txt'), 'utf8');
    assert('extended Replace All decodes \\t in the replacement',
        extendedOnDisk === 'A\tB beta\n', JSON.stringify(extendedOnDisk));

    // Replace All in All Opened Documents edits every open buffer, not just the
    // active one, and each document keeps its own undo history. Close the
    // earlier fixtures first so only the two dedicated documents are in scope.
    await page.evaluate(async () => {
        const c = window.theia.container;
        const key = Array.from(c._bindingDictionary._map.keys()).find(k =>
            String(k && (k.id || k.name || k)) === 'EditorManager');
        if (key) await c.get(key).closeAll({ save: false });
    });
    await sleep(500);
    const remainingDocs = await page.evaluate(() => {
        const c = window.theia.container;
        const key = Array.from(c._bindingDictionary._map.keys()).find(k =>
            String(k && (k.id || k.name || k)) === 'EditorManager');
        return key ? c.get(key).all.length : -1;
    });
    assert('all earlier editors are closed before the all-documents check',
        remainingDocs === 0, String(remainingDocs));
    await openFile(page, 'all-docs-a.txt');
    await openFile(page, 'all-docs-b.txt');
    const allDocsTabs = await page.$$eval('li.lm-TabBar-tab .lm-TabBar-tabLabel',
        els => els.map(el => el.textContent.trim()));
    assert('both all-documents fixtures are open',
        allDocsTabs.includes('all-docs-a.txt') && allDocsTabs.includes('all-docs-b.txt'),
        JSON.stringify(allDocsTabs));
    await openFindDialog(page);
    await clickDialogTab(page, 'Replace');
    await setFindText(page, 'foo');
    await setReplaceText(page, 'BAR');
    await clickDialogButton(page, 'Replace All in All Opened Documents');
    const allDocsStatus = await dialogStatus(page);
    const activeDoc = await editorText(page);
    assert('Replace All in All Opened Documents reports one edit per match',
        allDocsStatus === '4 replacements made in 2 documents', allDocsStatus);
    assert('the active document is replaced too',
        activeDoc === 'BAR three\nfour BAR\n', JSON.stringify(activeDoc));
    await closeDialog(page, false);
    await openFile(page, 'all-docs-a.txt');
    const otherDoc = await editorText(page);
    assert('every opened document is replaced',
        otherDoc === 'BAR one\ntwo BAR\n', JSON.stringify(otherDoc));
    await focusEditor(page);
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyZ');
    await page.keyboard.up('Control');
    await sleep(500);
    assert('undo is per document after a multi-document Replace All',
        (await editorText(page)) === 'foo one\ntwo foo\n', JSON.stringify(await editorText(page)));

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

    // F3 / Shift+F3 continue the last search with the dialog closed. search.txt
    // has two "foo" on line 1, so comparing only the unordered line set would
    // pass even if navigation skipped or re-ordered a hit. Monaco leaves the
    // caret just past the selected match, so each step is (match column + 3).
    const hits = [{ line: 1, col: 1 }, { line: 1, col: 9 }, { line: 2, col: 5 }, { line: 3, col: 1 }];
    const caretOn = hit => ({ line: hit.line, column: hit.col + 3 });
    const fwd = [];
    for (let i = 0; i < 5; i++) { await page.keyboard.press('F3'); await sleep(350); fwd.push(await caret(page)); }
    assert('F3 visits every occurrence in order, including both on line 1',
        JSON.stringify(fwd) === JSON.stringify([...hits, hits[0]].map(caretOn)), JSON.stringify(fwd));
    const back = [];
    for (let i = 0; i < 5; i++) {
        await page.keyboard.down('Shift');
        await page.keyboard.press('F3');
        await page.keyboard.up('Shift');
        await sleep(350);
        back.push(await caret(page));
    }
    assert('Shift+F3 walks backward through the same matches in order',
        JSON.stringify(back) === JSON.stringify([hits[3], hits[2], hits[1], hits[0], hits[3]].map(caretOn)),
        JSON.stringify(back));

    // E3 follow-up: "Find in Files..." from a folder's context menu hands the
    // folder into the dialog's Directory field, instead of just opening the tab.
    await closeDialog(page, false);
    await openMenuBar(page, 'View');
    await clickByLabel(page, 'Folder as Workspace');
    await waitFor(page, '.theia-Files', 10000, 'file navigator');
    await sleep(1200);

    const folderNode = await page.evaluateHandle(name =>
        Array.from(document.querySelectorAll('.theia-Files .theia-TreeNode'))
            .find(el => (el.textContent || '').includes(name) && el.getBoundingClientRect().height > 0) || null,
        subFolder);
    const folderElement = folderNode.asElement();
    assert('the folder to search is visible in the workspace tree', !!folderElement);
    if (folderElement) {
        const box = await folderElement.boundingBox();
        const point = {
            x: box.x + Math.min(60, box.width / 2),
            y: box.y + box.height / 2
        };
        // A DOM `.click()` does not update Theia's tree selection, so the
        // context menu would belong to whichever file was selected before.
        await page.mouse.click(point.x, point.y);
        await sleep(300);
        // Lumino's context menu needs real mouse events (see chrome.cjs).
        await page.mouse.click(point.x, point.y, { button: 'right' });
        await sleep(1200);
        if (!await clickByLabel(page, 'Find in Files...')) {
            throw new Error('folder context menu did not offer Find in Files...');
        }
        await sleep(800);

        const seeded = await page.evaluate(() => {
            const el = document.querySelector('#notepadia-find-directory');
            return el ? el.value : null;
        });
        assert('Find in Files from a folder prefills the Directory field with it',
            seeded === subFolder, JSON.stringify(seeded));
        const selectedTab = await page.evaluate(() => {
            const el = document.querySelector('.notepadia-find-tab[aria-selected="true"]');
            return el ? (el.textContent || '').trim() : null;
        });
        assert('the prefilled dialog opens on the Find in Files tab',
            selectedTab === 'Find in Files', JSON.stringify(selectedTab));
    }

    assert('no page errors', errors.length === 0, JSON.stringify(errors));
    await finish(browser);
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });