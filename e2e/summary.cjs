// C3 - `View > Summary...`.
//
// The counting rules are unit tested in document-stats.test.cjs; this asserts
// that the menu opens a dialog showing those figures and that closing it leaves
// no dialog behind. sample.txt is 'alpha\nbeta\ngamma\n', so the figures are
// known exactly.
const { assert, finish, sleep, launchPage, goto, openFile,
    clickMenuItem, clickDialogButton } = require('./lib.js');

function summaryRows(page) {
    return page.evaluate(() => {
        const box = Array.from(document.querySelectorAll('.notepadia-summary'))
            .find(b => b.getBoundingClientRect().width > 0);
        if (!box) return null;
        const rows = {};
        for (const row of Array.from(box.querySelectorAll('.notepadia-summary-row'))) {
            const label = row.querySelector('.notepadia-summary-label')?.textContent.trim();
            const value = row.querySelector('.notepadia-summary-value')?.textContent.trim();
            if (label) rows[label] = value;
        }
        return rows;
    });
}

function dialogTitle(page) {
    return page.evaluate(() => {
        const title = document.querySelector('.dialogTitle');
        if (!title) return null;
        const box = title.getBoundingClientRect();
        return box.width > 0 && box.height > 0 ? title.textContent.trim() : null;
    });
}

(async () => {
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await goto(page);
    await openFile(page, 'sample.txt');

    await clickMenuItem(page, 'View', 'Summary...');
    await sleep(1200);

    assert('Summary... opens a dialog titled Summary', await dialogTitle(page) === 'Summary',
        'title=' + await dialogTitle(page));

    const rows = await summaryRows(page);
    assert('Summary shows Characters, Words, Document and Selection',
        rows !== null && ['Characters', 'Words', 'Document', 'Selection'].every(k => k in rows),
        JSON.stringify(rows));
    assert('Characters counts the whole document', rows && rows.Characters === '17',
        'Characters=' + (rows && rows.Characters));
    assert('Words counts the three words', rows && rows.Words === '3',
        'Words=' + (rows && rows.Words));
    assert('Document reports the line count', rows && /lines\s*:\s*4/.test(rows.Document || ''),
        'Document=' + (rows && rows.Document));

    const closed = await clickDialogButton(page, 'Close');
    assert('the Close button closes the dialog', closed);
    await sleep(600);
    assert('no summary dialog is left open', await dialogTitle(page) === null);

    // A selection narrows the figures to the selected text.
    await page.evaluate(() => {
        const ed = Array.from(document.querySelectorAll('.monaco-editor')).find(e => e.getBoundingClientRect().width > 0);
        const src = ed && ed.querySelector('textarea, .inputarea');
        if (src) src.focus();
    });
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await sleep(500);
    await clickMenuItem(page, 'View', 'Summary...');
    await sleep(1200);
    const selectedRows = await summaryRows(page);
    assert('Summary reports a selection', selectedRows && /Sel\s*:/.test(selectedRows.Selection || ''),
        'Selection=' + (selectedRows && selectedRows.Selection));
    assert('a selected document still reports all characters',
        selectedRows && selectedRows.Characters === '17',
        'Characters=' + (selectedRows && selectedRows.Characters));
    await clickDialogButton(page, 'Close');
    await sleep(500);

    assert('no page errors', errors.length === 0, JSON.stringify(errors));
    await finish(browser);
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });