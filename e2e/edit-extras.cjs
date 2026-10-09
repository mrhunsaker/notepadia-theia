// C2 - the Edit menu extras: Copy to Clipboard, Paste Special, Insert Date &
// Time, the read-only flag, Begin/End Select, Multi-Select All, Column Mode and
// the Clipboard History panel.
//
// Every check here is against the buffer or the clipboard, not against the
// menu: an entry that appears and does nothing is the failure mode these tests
// exist to catch. The fixtures are written by the suite itself rather than
// seeded in run.cjs, because each one is specific to a single assertion and a
// shared fixture would hand the next check whatever the previous one left.

const fs = require('fs');
const path = require('path');
const {
    assert, finish, sleep, waitFor, launchPage, goto, openFile, openMenuBar,
    clickMenuItem, clickSubMenuItem, clickMenuPath, subLabels, closeMenus, modelText,
    clickEditorLine, dialogPrimaryLabel, clickDialogButton, setDialogInput, dialogError, WS
} = require('./lib.js');

const ws = name => path.join(WS, name);

/**
 * Normalize the glyphs Monaco can render for a plain space. The date formats
 * are built from ordinary ASCII spaces, but the editor column can render a
 * non-breaking space in surrounding layout and lib.js' modelText reads the
 * rendered line, so treat every space-like codepoint as a space before the
 * checks below match on it.
 */
function normTxt(s) {
    return (s || '').replace(/[\u00A0\u202F\u2007]/g, ' ');
}

function write(name, text) {
    fs.rmSync(ws(name), { force: true });
    fs.writeFileSync(ws(name), text);
}

/**
 * Park the caret on a 1-based line and column, entirely through the keyboard:
 * clicking a line puts the caret wherever the click happened to land, which is
 * the end of the line for any line short than the click, so the starting
 * position would not be the one the test means. Home + arrows is.
 */
async function caretTo(page, line, column) {
    await page.click('.monaco-editor .view-lines');
    await sleep(300);
    await page.keyboard.down('Control');
    await page.keyboard.press('Home');
    await page.keyboard.up('Control');
    await sleep(250);
    for (let i = 1; i < line; i++) {
        await page.keyboard.press('ArrowDown');
    }
    for (let i = 1; i < column; i++) {
        await page.keyboard.press('ArrowRight');
    }
    await sleep(250);
}

/** The number of cursors Monaco is currently showing. */
async function cursorCount(page) {
    return page.evaluate(() =>
        document.querySelectorAll('.monaco-editor .cursors-layer .cursor').length);
}

/** How many separate highlight segments Monaco has drawn for the selection. */
async function selectionSpans(page) {
    return page.evaluate(() =>
        document.querySelectorAll('.monaco-editor .selected-text').length);
}

/**
 * Seed the system clipboard and prove it took.
 *
 * The read-back is the point: headless Chrome can refuse `writeText` without
 * reporting why, and the Paste Special checks would then quietly be testing the
 * clipboard's previous contents instead of the text they claim to paste.
 */
async function setClipboard(page, text) {
    await page.bringToFront();
    const ok = await page.evaluate(async t => {
        try {
            await navigator.clipboard.writeText(t);
            return (await navigator.clipboard.readText()) === t;
        } catch (e) {
            return false;
        }
    }, text);
    if (!ok) {
        throw new Error('could not seed the clipboard with ' + JSON.stringify(text));
    }
    await sleep(200);
}

/** What the page would put on the system clipboard, read back the same way. */
async function clipboardText(page) {
    return page.evaluate(() => navigator.clipboard.readText().catch(() => null));
}

async function statusMode(page) {
    return page.evaluate(() =>
        document.querySelector('[id="status-bar-notepadia.mode"]')?.textContent.trim() || null);
}

/**
 * The classes on the editor tab for a file, the same way the tab-bar suite
 * finds them (a live tab, by label, in the main content panel).
 */
async function tabClasses(page, fragment) {
    return page.evaluate(frag => {
        const el = Array.from(document.querySelectorAll('li.lm-TabBar-tab'))
            .filter(t => t.getBoundingClientRect().width > 0 && t.getBoundingClientRect().height > 0)
            .find(t => (t.textContent || '').trim().startsWith(frag));
        return el ? Array.from(el.classList) : null;
    }, fragment);
}

(async () => {
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    try {
        // Clipboard permissions are granted up front: Copy to Clipboard and
        // Paste Special are the point of two of the checks below, and a
        // permission prompt the headless browser cannot answer would turn them
        // into timeouts rather than failures.
        const context = browser.defaultBrowserContext();
        await context.overridePermissions(new URL(require('./lib.js').URL).origin, [
            'clipboard-read', 'clipboard-write', 'clipboard-sanitized-write'
        ]);

        write('edit-clipboard.txt', 'copy path target\n');
        write('edit-datestamp.txt', 'start\n');
        write('edit-readonly.txt', 'locked content\n');
        write('edit-column.txt', 'abcd\nefgh\nijkl\nmnop\n');
        write('edit-paste.txt', '  if (a) {\n    b();\n  }\nTAIL\n');
        write('edit-history.txt', 'history target\n');

        await goto(page);

        // ------------------------------------------------ Copy to Clipboard
        await openFile(page, 'edit-clipboard.txt');

        await openMenuBar(page, 'Edit');
        const editItems = await subLabels(page);
        await closeMenus(page);
        for (const label of ['Copy to Clipboard', 'Paste Special', 'Select', 'Insert',
            'Clipboard History', 'Character Panel']) {
            assert(`Edit menu has "${label}"`, editItems.includes(label), JSON.stringify(editItems));
        }
        // Find/Replace stay under Search only, as before.
        assert('Edit menu still has no Find/Replace',
            !editItems.some(i => /find|replace/i.test(i)), JSON.stringify(editItems));

        await clickSubMenuItem(page, 'Edit', 'Copy to Clipboard', 'Current Filename');
        assert('Copy to Clipboard > Current Filename copies the name',
            (await clipboardText(page)) === 'edit-clipboard.txt',
            'clipboard=' + JSON.stringify(await clipboardText(page)));

        await clickSubMenuItem(page, 'Edit', 'Copy to Clipboard', 'Current Full File Path');
        const fullPath = await clipboardText(page);
        assert('Copy to Clipboard > Current Full File Path copies the whole path',
            typeof fullPath === 'string' && fullPath.endsWith('edit-clipboard.txt'), 'path=' + fullPath);

        await clickSubMenuItem(page, 'Edit', 'Copy to Clipboard', 'Current Directory Path');
        const dirPath = await clipboardText(page);
        assert('Copy to Clipboard > Current Directory Path copies the folder',
            typeof dirPath === 'string' && !dirPath.endsWith('edit-clipboard.txt') && dirPath.length > 0,
            'dir=' + dirPath);

        // -------------------------------------------------- Insert Date & Time
        await openFile(page, 'edit-datestamp.txt');
        await clickEditorLine(page, 0);
        await sleep(200);

        await clickMenuPath(page, ['Edit', 'Insert', 'Date & Time', 'Date & Time (short)']);
        const afterShort = normTxt(await modelText(page));
        assert('Date & Time (short) inserts HH:mm:ss dd/MM/yyyy',
            /\d{2}:\d{2}:\d{2} \d{2}\/\d{2}\/\d{4}/.test(afterShort), JSON.stringify(afterShort));

        await clickMenuPath(page, ['Edit', 'Insert', 'Date & Time', 'Date & Time (long)']);
        const afterLong = normTxt(await modelText(page));
        assert('Date & Time (long) inserts a spelled-out date',
            /[A-Za-z]{3}, [A-Za-z]{3} \d{1,2}, \d{4} \d{1,2}:\d{2} (AM|PM)/.test(afterLong),
            JSON.stringify(afterLong));

        // The customized box refuses a format with no token in it, rather than
        // inserting the same constant string on every use. ('no tokens here'
        // would pass the check: its trailing "s" is the seconds token.)
        await clickMenuPath(page, ['Edit', 'Insert', 'Date & Time', 'Date & Time (customized)...']);
        await waitFor(page, '.dialogContent input[type="text"]', 10000, 'date format dialog');
        assert('the customized dialog is titled for the command it came from',
            (await dialogPrimaryLabel(page)) === 'Insert',
            'label=' + await dialogPrimaryLabel(page));
        assert('setDialogInput reaches the dialog', await setDialogInput(page, '!!!'));
        const invalidError = await dialogError(page);
        assert('a format with no token is refused with a reason',
            invalidError.length > 0, 'error=' + JSON.stringify(invalidError));
        const beforeRefused = await modelText(page);
        await clickDialogButton(page, 'Insert');
        assert('the refused format inserts nothing',
            (await modelText(page)) === beforeRefused,
            JSON.stringify(await modelText(page)));
        // The refusal keeps the user in the box (the whole point of refusing),
        // so leave it the way they would: with Escape, not with the overlay
        // still swallowing the next menu.
        await page.keyboard.press('Escape');
        await sleep(400);

        // A format that does contain a token is accepted and applied.
        await clickMenuPath(page, ['Edit', 'Insert', 'Date & Time', 'Date & Time (customized)...']);
        await waitFor(page, '.dialogContent input[type="text"]', 10000, 'date format dialog');
        await setDialogInput(page, "yyyy'-'MM'-'dd");
        await clickDialogButton(page, 'Insert');
        const afterCustom = normTxt(await modelText(page));
        assert('a custom format is inserted as typed',
            /\d{4}-\d{2}-\d{2}/.test(afterCustom), JSON.stringify(afterCustom));

        // The browser-safe Date & Time chords. F5 / Ctrl+F5 are the reload
        // chords the browser claims before the app can see them, so they have
        // no browser e2e coverage (that is the G5 Electron parity leg); the
        // alternates must reproduce the exact same short/long formats.
        await clickEditorLine(page, 0);
        await sleep(250);
        for (const m of ['Control', 'Alt']) await page.keyboard.down(m);
        await page.keyboard.press('KeyD');
        for (const m of ['Alt', 'Control']) await page.keyboard.up(m);
        await sleep(700);
        const chordShort = normTxt(await modelText(page));
        assert('Ctrl+Alt+D inserts the short format like F5',
            /\d{2}:\d{2}:\d{2} \d{2}\/\d{2}\/\d{4}/.test(chordShort), JSON.stringify(chordShort));

        for (const m of ['Control', 'Alt', 'Shift']) await page.keyboard.down(m);
        await page.keyboard.press('KeyD');
        for (const m of ['Shift', 'Alt', 'Control']) await page.keyboard.up(m);
        await sleep(700);
        const chordLong = normTxt(await modelText(page));
        assert('Ctrl+Alt+Shift+D inserts the long format like Ctrl+F5',
            /[A-Za-z]{3}, [A-Za-z]{3} \d{1,2}, \d{4} \d{1,2}:\d{2} (AM|PM)/.test(chordLong),
            JSON.stringify(chordLong));

        // --------------------------------------------------- the read-only flag
        await openFile(page, 'edit-readonly.txt');
        await clickEditorLine(page, 0);
        await sleep(250);

        // The flag is a document property, so it lives in the File menu.
        await openMenuBar(page, 'File');
        const fileItems = await subLabels(page);
        await closeMenus(page);
        assert('File menu has Set/Clear Read-Only',
            fileItems.includes('Set/Clear Read-Only'), JSON.stringify(fileItems));

        await clickMenuItem(page, 'File', 'Set/Clear Read-Only');
        await sleep(500);
        assert('the status bar shows Read-Only',
            (await statusMode(page)) === 'Read-Only', 'mode=' + await statusMode(page));
        const roTab = await tabClasses(page, 'edit-readonly.txt');
        assert('the tab carries the read-only class',
            roTab && roTab.includes('notepadia-tab-readonly'), JSON.stringify(roTab));

        const beforeTyping = await modelText(page);
        await page.keyboard.type('nope');
        await sleep(600);
        assert('typing in a read-only document changes nothing',
            (await modelText(page)) === beforeTyping, JSON.stringify(await modelText(page)));

        // Ctrl+Alt+R is Notepad++'s chord and the browser does not claim it.
        await page.keyboard.down('Control');
        await page.keyboard.down('Alt');
        await page.keyboard.press('KeyR');
        await page.keyboard.up('Alt');
        await page.keyboard.up('Control');
        await sleep(700);
        assert('Ctrl+Alt+R clears the flag',
            (await statusMode(page)) === 'INS', 'mode=' + await statusMode(page));
        await page.keyboard.type('yes');
        await sleep(500);
        assert('the document is editable again',
            (await modelText(page)) !== beforeTyping, JSON.stringify(await modelText(page)));
        // Undo the edit so the read-only fixture is left as seeded.
        await page.keyboard.down('Control');
        await page.keyboard.press('KeyZ');
        await page.keyboard.up('Control');
        await sleep(400);

        // ---------------------------------------------------- Begin/End Select
        // "search.txt" has a word on every line, so the anchored selection has
        // something visible to grow over: the anchor goes at the caret on line
        // 1 and the highlight must follow the caret down to line 2.
        await openFile(page, 'search.txt');
        await caretTo(page, 1, 5);
        await page.keyboard.down('Control');
        await page.keyboard.down('Alt');
        await page.keyboard.press('KeyB');
        await page.keyboard.up('Alt');
        await page.keyboard.up('Control');
        await sleep(400);
        const afterAnchor = await selectionSpans(page);
        assert('Begin/End Select alone selects nothing yet',
            afterAnchor === 0, 'segments=' + afterAnchor);
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowRight');
        await sleep(600);
        const afterMove = await selectionSpans(page);
        assert('the selection grows from the anchor to the caret across lines',
            afterMove > afterAnchor, 'segments=' + afterMove + ' anchor=' + afterAnchor);

        // Begin/End Select stays armed until the second press, by design. Left
        // armed it keeps extending every caret move, so the navigation below
        // would build a selection instead of placing a caret, and Multi-Select
        // All would then read that selection rather than the word under it.
        await clickMenuPath(page, ['Edit', 'Select', 'Begin/End Select']);
        await sleep(500);

        // ----------------------------------------------------- Multi-Select All
        // 'foo' occurs four times in search.txt; a caret inside a word is
        // enough, which is what makes the command useful without a selection.
        await openFile(page, 'search.txt');
        await caretTo(page, 1, 2);
        await clickMenuPath(page, ['Edit', 'Select', 'Multi-Select All', 'Multi-Select All']);
        await sleep(600);
        // A stack of cursors reads as one blinking caret plus the per-occurrence
        // selection highlights, so count the highlights the way the eye does.
        const fooSpans = await selectionSpans(page);
        if (process.env.E2E_DEBUG_MSEL) {
            console.error('[msel] term probe', JSON.stringify(await page.evaluate(() => ({
                editors: Array.from(document.querySelectorAll('.monaco-editor')).map(e => ({
                    visible: e.getBoundingClientRect().width * e.getBoundingClientRect().height > 0,
                    cursors: e.querySelectorAll('.cursors-layer .cursor').length,
                    selected: e.querySelectorAll('.selected-text').length,
                    text: Array.from(e.querySelectorAll('.view-line')).map(l => l.innerText).join('|')
                }))
            }))));
        }
        assert('Multi-Select All puts a cursor on every occurrence of the word',
            fooSpans === 4, 'segments=' + fooSpans + ' cursors=' + await cursorCount(page));

        // Match case and whole word are the two variants. search.txt holds only
        // lowercase 'foo', so the two agree with the plain command there; the
        // whole-word variant is the one that can differ in general, which the
        // unit tests cover against a mixed-case fixture.
        await openFile(page, 'search.txt');
        await caretTo(page, 1, 2);
        await clickMenuPath(page, ['Edit', 'Select', 'Multi-Select All', 'Match case']);
        await sleep(600);
        assert('Multi-Select All (Match case) finds the same four occurrences',
            (await selectionSpans(page)) === 4,
            'segments=' + await selectionSpans(page) + ' cursors=' + await cursorCount(page));

        await openFile(page, 'search.txt');
        await caretTo(page, 1, 2);
        await clickMenuPath(page, ['Edit', 'Select', 'Multi-Select All', 'Whole word']);
        await sleep(600);
        assert('Multi-Select All (Whole word) finds the same four occurrences',
            (await selectionSpans(page)) === 4,
            'segments=' + await selectionSpans(page) + ' cursors=' + await cursorCount(page));

        // ---------------------------------------------------------- Column Mode
        await openFile(page, 'edit-column.txt');
        // Select "ab" on line 1 and extend that down to line 2, so the command
        // has a real rectangle to work with. Alt+C is the chord, and it is not
        // one the browser claims.
        await caretTo(page, 1, 1);
        await page.keyboard.down('Shift');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.up('Shift');
        await sleep(400);
        await page.keyboard.down('Alt');
        await page.keyboard.press('KeyC');
        await page.keyboard.up('Alt');
        await sleep(700);
        const blockCursors = await cursorCount(page);
        // The selection spans lines 1-2, so the block is one cursor per line it
        // spans - two, not four. The 1-line selection it came from had one.
        assert('Column Mode turns the selection into one cursor per line it spans',
            blockCursors === 2, 'cursors=' + blockCursors);
        // Typing replaces every cell of the block at once, which is the whole
        // point of column mode and the only way to prove the block is real.
        await page.keyboard.type('Z');
        await sleep(700);
        const columnText = await modelText(page);
        assert('typing in column mode edits every cell of the block',
            columnText === 'Zcd\nZgh\nijkl\nmnop\n', JSON.stringify(columnText));
        await page.keyboard.down('Control');
        await page.keyboard.press('KeyZ');
        await page.keyboard.up('Control');
        await sleep(500);

        // ------------------------------------------------------ Clipboard History
        await openFile(page, 'edit-history.txt');
        // Copy some text the way a user would, so the document's own `copy`
        // event is what lands in the history. A click at the end of the line
        // would leave nothing to the right of the caret to select, so go to the
        // start first - the word that is meant to be copied is "history".
        await clickEditorLine(page, 0);
        await sleep(250);
        await page.keyboard.press('Home');
        await sleep(200);
        await page.keyboard.down('Shift');
        for (let i = 0; i < 7; i++) {
            await page.keyboard.press('ArrowRight');
        }
        await page.keyboard.up('Shift');
        await sleep(300);
        await page.keyboard.down('Control');
        await page.keyboard.press('KeyC');
        await page.keyboard.up('Control');
        await sleep(600);

        await clickMenuItem(page, 'Edit', 'Clipboard History');
        await waitFor(page, '.notepadia-clipboard-history', 10000, 'clipboard history panel');
        const entries = await page.$$eval('.notepadia-clipboard-history-entry', els =>
            els.map(e => e.getAttribute('title')));
        assert('the copied text is in the history',
            entries.length === 1 && entries[0] === 'history', JSON.stringify(entries));
        const historyTitle = await page.$eval('.notepadia-clipboard-history-title', e => e.textContent);
        assert('the panel reports how much it is holding',
            historyTitle === 'Clipboard History (1/20)', JSON.stringify(historyTitle));

        // Clicking an entry pastes it at the caret.
        await clickEditorLine(page, 0);
        await sleep(250);
        await page.keyboard.press('Home');
        await sleep(150);
        await page.click('.notepadia-clipboard-history-entry');
        await sleep(700);
        const historyText = await modelText(page);
        assert('clicking a history entry inserts it at the caret',
            // The fixture document ends with a newline, so the pasted text
            // carries one through.
            normTxt(historyText) === 'historyhistory target\n', JSON.stringify(historyText));

        // The header button empties the list, and the panel stays open so the
        // empty state is visible; only then toggle it shut.
        await page.click('.notepadia-clipboard-history-clear');
        await sleep(600);
        assert('Clear empties the history',
            (await page.$$('.notepadia-clipboard-history-entry')).length === 0, 'entries remain');
        assert('an empty history says so',
            (await page.$eval('.notepadia-clipboard-history-empty', e => e.textContent)).includes('Nothing has been copied'));
        await clickMenuItem(page, 'Edit', 'Clipboard History');
        await sleep(500);

        // ------------------------------------------------------- Character Panel
        await clickMenuItem(page, 'Edit', 'Character Panel');
        await waitFor(page, '.notepadia-character-panel', 10000, 'character panel');
        assert('Character Panel opens from the Edit menu',
            (await page.$('.notepadia-character-panel')) !== null, 'panel not found');
        await clickMenuItem(page, 'Edit', 'Character Panel');
        await sleep(600);

        // ---------------------------------------------------------- Paste Special
        // The line above the caret is "  }", so both indent commands have real
        // work to do here: Paste and Indent adds that indent to an unindented
        // clipboard, Paste and Unindent takes it off an already-indented one.
        // The fixture file itself ends with a newline, so the document text
        // does too; the expected value has to carry it.
        const PASTED = '  if (a) {\n    b();\n  }\n  b();TAIL\n';
        await openFile(page, 'edit-paste.txt');
        await caretTo(page, 4, 1);
        await setClipboard(page, 'b();');
        await clickSubMenuItem(page, 'Edit', 'Paste Special', 'Paste and Indent');
        await sleep(600);
        assert('Paste and Indent lines the pasted text up with the line above',
            normTxt(await modelText(page)) === PASTED, JSON.stringify(await modelText(page)));

        await page.keyboard.down('Control');
        await page.keyboard.press('KeyZ');
        await page.keyboard.up('Control');
        await sleep(500);
        await setClipboard(page, '    b();');
        await clickSubMenuItem(page, 'Edit', 'Paste Special', 'Paste and Unindent');
        await sleep(600);
        assert('Paste and Unindent strips the line indent from the pasted text',
            normTxt(await modelText(page)) === PASTED, JSON.stringify(await modelText(page)));

        // Paste Unformatted is the plain text of the clipboard, unchanged: with
        // no rich text involved it must land exactly as it was copied, so the
        // caret's own indent is not applied to the pasted lines. The clipboard
        // starts with a tab and the line above ends at column 3, so an indent
        // that leaked in would leave 'c();' at column 7 rather than its own tab.
        //
        // The tab is read as its rendered width: Monaco draws a tab as spaces,
        // so a literal '\t' is not observable in the rendered lines.
        await page.keyboard.down('Control');
        await page.keyboard.press('KeyZ');
        await page.keyboard.up('Control');
        await sleep(500);
        await setClipboard(page, '\tc();\nd();');
        await clickSubMenuItem(page, 'Edit', 'Paste Special', 'Paste Unformatted');
        await sleep(600);
        assert('Paste Unformatted keeps the clipboard as it stands, with no indent added',
            normTxt(await modelText(page)) === '  if (a) {\n    b();\n  }\n    c();\nd();TAIL\n',
            JSON.stringify(await modelText(page)));

        assert('no page errors', errors.length === 0, errors.join('\n'));
    } catch (e) {
        console.error('edit-extras FAILED: ' + (e && e.stack || e));
        process.exitCode = 1;
    } finally {
        await finish(browser);
    }
})();
