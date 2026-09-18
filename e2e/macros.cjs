const { assert, finish, sleep, launchPage, goto, openFile, waitFor,
    openMenuBar, hoverByLabel, clickByLabel, subLabels, closeMenus, modelText, statusBar } = require('./lib.js');

async function focusEditor(page) {
    await page.evaluate(() => {
        const el = document.querySelector('.monaco-editor .inputarea, .monaco-editor textarea');
        el && el.focus();
    });
    await sleep(300);
}

async function runMacroOp(page, label) {
    await openMenuBar(page, 'Macros');
    await sleep(400);
    await clickByLabel(page, label);
    await sleep(1200);
}

(async () => {
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await goto(page);
    await openFile(page, 'sample.txt');

    // Macros top-level menu lists record/stop/run/clear entries
    await openMenuBar(page, 'Macros');
    await sleep(400);
    const macroItems = await subLabels(page);
    assert('Macros menu has record, stop, run and clear entries',
        ['Record Macro...', 'Stop Recording', 'Discard Recording', 'Run Macro', 'Clear Macro']
            .every(l => macroItems.includes(l)),
        JSON.stringify(macroItems));
    await closeMenus(page);

    // Record "AB", Backspace, "C"; the recorded steps must be type(AB), delete(1), type(C)
    await runMacroOp(page, 'Record Macro...');
    const recording = await statusBar(page);
    assert('status bar shows REC while recording', recording.includes('REC'),
        JSON.stringify(recording));
    await focusEditor(page);
    await page.keyboard.type('AB', { delay: 40 });
    await sleep(200);
    await page.keyboard.press('Backspace');
    await sleep(200);
    await page.keyboard.type('C', { delay: 40 });
    await sleep(300);
    await runMacroOp(page, 'Stop Recording');
    const stopped = await statusBar(page);
    assert('status bar hides REC after stop', !stopped.includes('REC'),
        JSON.stringify(stopped));

    // Clear the document, then replay the macro from the start
    await focusEditor(page);
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await sleep(300);
    await page.keyboard.press('Backspace');
    await sleep(400);
    assert('document cleared before replay', await modelText(page) === '',
        JSON.stringify(await modelText(page)));

    await runMacroOp(page, 'Run Macro');
    assert('macro replay types AB, deletes B and types C',
        await modelText(page) === 'AC',
        JSON.stringify(await modelText(page)));

    await runMacroOp(page, 'Run Macro');
    assert('macro replay runs again from the cursor',
        await modelText(page) === 'ACAC',
        JSON.stringify(await modelText(page)));

    await runMacroOp(page, 'Clear Macro');
    await runMacroOp(page, 'Run Macro');
    assert('cleared macro does not run', await modelText(page) === 'ACAC',
        JSON.stringify(await modelText(page)));

    assert('no page errors', errors.length === 0, JSON.stringify(errors));
    await finish(browser);
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });