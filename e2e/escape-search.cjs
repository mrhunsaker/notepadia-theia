const { assert, finish, sleep, launchPage, goto, openFile } = require('./lib.js');
const { openFindDialog, setFindText, clickDialogButton, clickDialogTab,
    setMode, markCount } = require('./dialog-helpers.cjs');

(async () => {
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await goto(page);
    await openFile(page, 'escape.txt');

    // Extended mode lives in the dialog's Search Mode radio group. Switch to
    // it from the Mark tab (escape.txt has exactly two real tabs).
    await openFindDialog(page);
    await clickDialogTab(page, 'Mark');
    await setMode(page, 'extended');

    // \t in the find box matches a real tab character once extended mode is on
    await setFindText(page, '\\t');
    await clickDialogButton(page, 'Mark All');
    assert('extended \\t matches both real tabs', await markCount(page) === 2,
        'marks=' + await markCount(page));

    // \\ matches a literal backslash (exactly one in escape.txt)
    await clickDialogButton(page, 'Clear All Marks');
    await setFindText(page, '\\\\');
    await clickDialogButton(page, 'Mark All');
    assert('extended \\\\ matches the literal backslash', await markCount(page) === 1,
        'marks=' + await markCount(page));

    // Regex metacharacters are matched literally in extended mode
    await clickDialogButton(page, 'Clear All Marks');
    await setFindText(page, '(');
    await clickDialogButton(page, 'Mark All');
    assert('extended "(" matches literally (no regex explosion)', await markCount(page) === 1,
        'marks=' + await markCount(page));

    // \n matches every line break (escape.txt has five in the open model:
    // four interior line breaks plus a trailing one). Monaco paints a
    // decoration that spans a line break on BOTH adjacent lines, so assert at
    // least the interior breaks, not an exact DOM element count.
    await clickDialogButton(page, 'Clear All Marks');
    await setFindText(page, '\\n');
    await clickDialogButton(page, 'Mark All');
    assert('extended \\n marks the line breaks', await markCount(page) >= 5,
        'marks=' + await markCount(page));

    // Clearing still works after an extended search
    await clickDialogButton(page, 'Clear All Marks');
    assert('Clear All Marks clears extended marks', await markCount(page) === 0,
        'marks=' + await markCount(page));

    assert('no page errors', errors.length === 0, JSON.stringify(errors));
    await finish(browser);
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });