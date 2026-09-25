const { assert, finish, sleep, launchPage, goto, openFile,
    editorLines, clickEditorLine } = require('./lib.js');

const statusField = (page, id) => page.evaluate(i =>
    document.querySelector(`[id="status-bar-${i}"]`)?.textContent?.trim() || null, id);

(async () => {
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await goto(page);
    // bookmarks.txt is 'one\ntwo\nthree\nfour\nfive\n' -> 24 chars;
    // Monaco counts the trailing empty line, so 6 lines.
    await openFile(page, 'bookmarks.txt');

    const lengthText = await statusField(page, 'notepadia.length');
    assert('status bar shows length and lines',
        lengthText === 'length : 24  lines : 6', lengthText);

    // Click line 3 and Home to the first column: Ln 3, Col 1, offset 8.
    await clickEditorLine(page, 2);
    await page.keyboard.press('Home');
    await sleep(300);
    const caretText = await statusField(page, 'notepadia.position');
    assert('caret shows Ln/Col/Pos',
        caretText === 'Ln : 3  Col : 1  Pos : 8', caretText);

    // Ctrl+A selects the whole document: 24 chars across 6 lines.
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await sleep(400);
    const selText = await statusField(page, 'notepadia.selection');
    assert('selection shows chars | lines',
        selText === 'Sel : 24 | 6', selText);

    // Reset the caret to 1,1 (Ctrl+Home collapses the selection).
    await page.keyboard.down('Control');
    await page.keyboard.press('Home');
    await page.keyboard.up('Control');
    await sleep(300);

    // Insert turns the INS element into OVR.
    await page.keyboard.press('Insert');
    await sleep(400);
    const modeOvr = await statusField(page, 'notepadia.mode');
    assert('Insert toggles INS to OVR', modeOvr === 'OVR', modeOvr);

    // Typing in OVR replaces the character under the caret ('o' -> 'x').
    await page.keyboard.type('x', { delay: 40 });
    await sleep(400);
    const linesOvr = await editorLines(page);
    assert('typing overwrites in OVR mode',
        linesOvr[0] === 'xne', JSON.stringify(linesOvr[0]));
    const caretOvr = await statusField(page, 'notepadia.position');
    assert('caret advances after overwrite',
        caretOvr === 'Ln : 1  Col : 2  Pos : 1', caretOvr);

    // Insert toggles back to INS and typing inserts again.
    await page.keyboard.press('Insert');
    await sleep(400);
    const modeIns = await statusField(page, 'notepadia.mode');
    assert('Insert toggles OVR back to INS', modeIns === 'INS', modeIns);
    await page.keyboard.type('y', { delay: 40 });
    await sleep(400);
    const linesIns = await editorLines(page);
    assert('typing inserts in INS mode',
        linesIns[0] === 'xyne', JSON.stringify(linesIns[0]));

    assert('no page errors', errors.length === 0, JSON.stringify(errors));
    await finish(browser);
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });