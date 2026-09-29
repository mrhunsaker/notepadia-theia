const fs = require('fs');
const { assert, finish, sleep, waitFor, launchPage, goto, openFile, save,
    modelText: rawModelText, WS } = require('./lib.js');

// Monaco paints spaces as U+00A0 in the rendered lines, so the view text has to
// be normalised before it can be compared with what was typed or stored.
const modelText = page => rawModelText(page).then(t => t.replace(/\u00a0/g, ' '));

// The backup store is the feature's own persistence layer, so the test reads it
// directly instead of inferring state from tab titles. That keeps "was a backup
// written" and "was it cleared" as separate, unambiguous facts.
async function readBackups(page) {
    return page.evaluate(() => new Promise(resolve => {
        const bail = value => resolve(value);
        setTimeout(() => bail('timeout'), 10000);
        const open = indexedDB.open('notepadia-backups');
        open.onerror = () => bail('open-error');
        open.onsuccess = () => {
            const db = open.result;
            if (!db.objectStoreNames.contains('buffers')) {
                db.close();
                return bail('no-store');
            }
            const request = db.transaction('buffers', 'readonly').objectStore('buffers').getAll();
            request.onsuccess = () => {
                const rows = request.result.map(r => ({ key: r.key, label: r.label, content: r.content }));
                db.close();
                bail(rows);
            };
            request.onerror = () => { db.close(); bail('read-error'); };
        };
    }));
}

function backupTexts(rows) {
    return Array.isArray(rows) ? rows.map(r => r.content) : [String(rows)];
}

async function editorTabs(page) {
    return page.evaluate(() => Array.from(document.querySelectorAll('li.lm-TabBar-tab'))
        .filter(t => t.getBoundingClientRect().width > 0 && t.getBoundingClientRect().height > 0)
        .map(t => (t.textContent || '').trim()));
}

async function dirtyTabs(page) {
    return page.evaluate(() => Array.from(document.querySelectorAll('li.lm-TabBar-tab'))
        .filter(t => t.classList.contains('notepadia-tab-dirty') || t.classList.contains('lm-mod-dirty'))
        .map(t => (t.textContent || '').trim()));
}

// The editor paints asynchronously after a tab opens, so a single sample right
// after a reload can read an empty model even though the text is on its way.
async function waitForText(page, needle, timeout = 20000) {
    const deadline = Date.now() + timeout;
    let text = '';
    while (Date.now() < deadline) {
        text = await modelText(page);
        if (text.includes(needle)) {
            return text;
        }
        await sleep(500);
    }
    return text;
}

// A dirty buffer raises Theia's own beforeunload prompt (verified in the
// menus-shortcuts suite), so a reload has to accept it.
async function reloadAcceptingPrompt(page) {
    const dialogs = [];
    const handler = async dialog => {
        dialogs.push(dialog.type());
        await dialog.accept().catch(() => { });
    };
    page.on('dialog', handler);
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => { });
    await sleep(1500);
    page.off('dialog', handler);
    return dialogs;
}

(async () => {
    const UNSAVED = 'RECOVERED UNSAVED TEXT';
    fs.writeFileSync(WS + '/backup.txt', 'on disk\n');

    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await goto(page);
    await waitFor(page, '#theia-app-shell', 60000);
    await sleep(2000);

    // --- an untitled buffer is captured once typing stops ---------------
    await page.keyboard.down('Control');
    await page.keyboard.down('Alt');
    await page.keyboard.press('KeyN');
    await page.keyboard.up('Alt');
    await page.keyboard.up('Control');
    await sleep(1500);
    await page.keyboard.type(UNSAVED);
    await sleep(1200);
    const early = await readBackups(page);
    assert('a backup is not written on every keystroke, only after the interval passes',
        !backupTexts(early).some(t => t.includes(UNSAVED)),
        JSON.stringify(backupTexts(early)));

    await sleep(7000);
    const captured = await readBackups(page);
    assert('an unsaved untitled buffer is copied into the backup store',
        backupTexts(captured).some(t => t === UNSAVED),
        JSON.stringify(backupTexts(captured)));
    assert('the capture waits for a pause in typing, so the stored text is whole',
        !backupTexts(captured).some(t => t.includes(UNSAVED) && t !== UNSAVED),
        JSON.stringify(backupTexts(captured)));

    // --- and comes back after a reload ---------------------------------
    const prompted = await reloadAcceptingPrompt(page);
    assert('Theia asks before discarding the dirty buffer on reload',
        prompted.includes('beforeunload'),
        JSON.stringify(prompted));
    await sleep(4000);
    const tabs = await editorTabs(page);
    assert('the unsaved tab is recovered after the reload',
        tabs.some(t => /new \d+/.test(t)),
        JSON.stringify(tabs));
    assert('the recovered tab is marked dirty, because the text is not on disk yet',
        (await dirtyTabs(page)).some(t => /new \d+/.test(t)),
        JSON.stringify(await dirtyTabs(page)));
    const recoveredText = await waitForText(page, UNSAVED);
    assert('the unsaved text is back in the editor',
        recoveredText.includes(UNSAVED),
        JSON.stringify(recoveredText));

    // A second crash before the user saves must not lose the text again, so a
    // recovered buffer stays protected rather than being cleared on restore.
    await sleep(3000);
    const afterRestore = await readBackups(page);
    assert('a recovered buffer stays backed up until it is saved',
        backupTexts(afterRestore).some(t => t === UNSAVED),
        JSON.stringify(backupTexts(afterRestore)));

    // --- saving clears the backup --------------------------------------
    await openFile(page, 'backup.txt');
    await sleep(800);
    await page.keyboard.type('FILE EDIT ');
    await sleep(7000);
    const fileDirty = await readBackups(page);
    assert('an unsaved file buffer is copied into the backup store',
        backupTexts(fileDirty).some(t => t.includes('FILE EDIT')),
        JSON.stringify(backupTexts(fileDirty)));

    await save(page);
    await sleep(2000);
    const afterSave = await readBackups(page);
    assert('saving removes that file from the backup store',
        !backupTexts(afterSave).some(t => t.includes('FILE EDIT')),
        JSON.stringify(backupTexts(afterSave)));
    assert('saving leaves the still-unsaved buffer alone',
        backupTexts(afterSave).some(t => t === UNSAVED),
        JSON.stringify(backupTexts(afterSave)));
    assert('the saved file on disk really has the edited text',
        fs.readFileSync(WS + '/backup.txt', 'utf8').includes('FILE EDIT'),
        JSON.stringify(fs.readFileSync(WS + '/backup.txt', 'utf8')));
    assert('the saved tab is no longer dirty',
        !(await dirtyTabs(page)).some(t => t.includes('backup.txt')),
        JSON.stringify(await dirtyTabs(page)));

    // --- and a saved buffer is not recovered ---------------------------
    // The still-unsaved untitled buffer is what raises the prompt this time;
    // what matters here is that the saved file is never offered back.
    await reloadAcceptingPrompt(page);
    await sleep(4000);
    const finalBackups = await readBackups(page);
    assert('the saved file is not offered for recovery',
        !backupTexts(finalBackups).some(t => t.includes('FILE EDIT')),
        JSON.stringify(backupTexts(finalBackups)));
    const finalTabs = await editorTabs(page);
    const finalText = await waitForText(page, UNSAVED);

    assert('a second crash still recovers the buffer that was never saved',
        finalTabs.some(t => /new \d+/.test(t)) && finalText.includes(UNSAVED),
        JSON.stringify(finalTabs) + ' ' + JSON.stringify(finalText));
    assert('recovery did not resurrect the saved file as an unsaved tab',
        !finalTabs.some(t => t.includes('backup.txt') && t.includes('*')),
        JSON.stringify(finalTabs));

    await finish(browser);
})();
