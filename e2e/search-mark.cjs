const { assert, finish, sleep, launchPage, goto, openFile } = require('./lib.js');
const { openFindDialog, setFindText, clickDialogButton, clickDialogTab,
    setStyleRadio, markCount, markCountStyle, setMode,
    closeDialog } = require('./dialog-helpers.cjs');

(async () => {
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await goto(page);
    await openFile(page, 'search.txt');

    // The Mark tab offers everything the old submenu did, consolidated into the
    // dialog (B2): Mark All, Clear All Marks, Select and Find Next, extended
    // mode radio, purge, and the five-style selector.
    await openFindDialog(page);
    await clickDialogTab(page, 'Mark');
    const markControls = await page.evaluate(() => Array.from(
        document.querySelectorAll('.notepadia-find-buttons button')).map(b => (b.textContent || '').trim()));
    assert('Mark tab lists the Mark controls',
        ['Mark All', 'Clear All Marks', 'Select and Find Next'].every(l => markControls.includes(l)),
        JSON.stringify(markControls));
    assert('Mark tab offers all five styles', await page.evaluate(() =>
        document.querySelectorAll('input[name="notepadia-find-mark-style"]').length === 5));
    assert('Mark tab has a purge checkbox', await page.evaluate(() =>
        Array.from(document.querySelectorAll('.notepadia-find-check'))
            .some(el => (el.textContent || '').trim() === 'Purge for each search')));

    // Mark All colors every occurrence of the search term.
    await setFindText(page, 'foo');
    await clickDialogButton(page, 'Mark All');
    assert('Mark All colors all four occurrences', await markCount(page) === 4,
        'marks=' + await markCount(page));

    // The selected style slot is the one that gets inked; others stay empty.
    await clickDialogButton(page, 'Clear All Marks');
    await setStyleRadio(page, 2);
    await clickDialogButton(page, 'Mark All');
    assert('Mark All uses the selected style', (await markCountStyle(page, 2)) === 4
        && (await markCountStyle(page, 0)) === 0,
        'style2=' + await markCountStyle(page, 2) + ' style0=' + await markCountStyle(page, 0));
    await clickDialogButton(page, 'Clear All Marks');
    assert('Clear All Marks removes all marks', await markCount(page) === 0,
        'marks=' + await markCount(page));

    // Select and Find Next selects the next occurrence and extends the selection.
    const selCount = () => page.evaluate(() =>
        document.querySelectorAll('.monaco-editor .selected-text').length);
    await setFindText(page, 'foo');
    await clickDialogButton(page, 'Select and Find Next');
    const first = await selCount();
    assert('Select and Find Next selects an occurrence', first >= 1, 'selections=' + first);
    await clickDialogButton(page, 'Select and Find Next');
    const second = await selCount();
    assert('Select and Find Next selects a further occurrence', second >= 2, 'selections=' + second);

    // Extended mode radio belongs to every tab's Search Mode group; confirm
    // it is live from the Mark tab (a \t literal marks the two real tabs).
    // openFile ends with an Escape, which closes the dialog, so it is closed
    // first and reopened on the Mark tab.
    await closeDialog(page, false);
    await openFile(page, 'escape.txt');
    await openFindDialog(page);
    await clickDialogTab(page, 'Mark');
    await setFindText(page, '\\t');
    await setMode(page, 'extended');
    await clickDialogButton(page, 'Mark All');
    assert('Mark All honors the Extended radio', await markCount(page) === 2,
        'marks=' + await markCount(page));

    assert('no page errors', errors.length === 0, JSON.stringify(errors));
    await finish(browser);
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });