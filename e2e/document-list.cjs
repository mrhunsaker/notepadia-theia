const { assert, finish, sleep, waitFor, launchPage, goto, openFile,
    openMenuBar, clickByLabel, subLabels, closeMenus, clickDialogButton } = require('./lib.js');

function viewLabels(page) {
    return subLabels(page);
}

async function entryLabels(page) {
    return page.$$eval('#notepadia\\.documentList .notepadia-document-list-file-label',
        els => els.map(e => (e.textContent || '').trim()).filter(Boolean));
}

async function entryCount(page) {
    return page.$$eval('#notepadia\\.documentList .notepadia-document-list-entry', els => els.length);
}

async function clickEntry(page, label) {
    const boxes = await page.$$eval('#notepadia\\.documentList .notepadia-document-list-entry', (els, l) => {
        const el = els.find(e =>
            (e.querySelector('.notepadia-document-list-file-label')?.textContent || '').trim() === l);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, label);
    if (!boxes) return false;
    await page.mouse.move(boxes.x, boxes.y);
    await page.mouse.click(boxes.x, boxes.y);
    await sleep(2000);
    return true;
}

const modelText = page => page.evaluate(() => {
    const w = Array.from(document.querySelectorAll('.monaco-editor'))
        .find(e => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0);
    const lines = w ? Array.from(w.querySelectorAll('.view-line')).map(e => e.innerText) : [];
    return lines.join('\n').replace(/\u00a0/g, ' ');
});

async function windowDialogRows(page) {
    return page.evaluate(() => Array.from(document.querySelectorAll('.notepadia-windows-row')).map(r => ({
        name: (r.querySelector('.notepadia-windows-name')?.textContent || '').trim(),
        path: (r.querySelector('.notepadia-windows-path')?.textContent || '').trim(),
        type: (r.querySelector('.notepadia-windows-type')?.textContent || '').trim(),
        selected: r.getAttribute('aria-selected') === 'true'
    })));
}

async function clickWindowRow(page, index, control) {
    const box = await page.evaluate(i => {
        const rows = document.querySelectorAll('.notepadia-windows-row');
        if (!rows[i]) return null;
        const r = rows[i].getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, index);
    if (!box) return false;
    await page.mouse.move(box.x, box.y);
    if (control) {
        await page.keyboard.down('Control');
        await page.mouse.click(box.x, box.y);
        await page.keyboard.up('Control');
    } else {
        await page.mouse.click(box.x, box.y);
    }
    await sleep(300);
    return true;
}

(async () => {
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await goto(page);
    await openFile(page, 'sample.txt');
    await openFile(page, 'app.js');
    await openFile(page, 'config.json');

    await openMenuBar(page, 'View');
    const viewItems = await viewLabels(page);
    assert('View menu has Document List', viewItems.includes('Document List'), JSON.stringify(viewItems));
    await closeMenus(page);

    await openMenuBar(page, 'View');
    await clickByLabel(page, 'Document List');
    await waitFor(page, '#notepadia\\.documentList', 15000);

    const allEntries = await entryLabels(page);
    assert('Document List shows all open files',
        allEntries.includes('sample.txt') && allEntries.includes('app.js') && allEntries.includes('config.json'),
        JSON.stringify(allEntries));

    const input = await page.$('#notepadia\\.documentList input');
    await input.click();
    await input.type('config', { delay: 40 });
    await sleep(600);
    const filteredEntries = await entryLabels(page);
    assert('filter narrows list to matching file', filteredEntries.length === 1 && filteredEntries[0] === 'config.json',
        JSON.stringify(filteredEntries));

    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await sleep(200);
    await page.keyboard.type('app', { delay: 40 });
    await sleep(600);
    const appVisible = await clickEntry(page, 'app.js');
    const clickedText = await modelText(page);
    assert('clicking entry focuses the document', appVisible && clickedText.includes('function greet'),
        'clicked=' + appVisible + ' text=' + JSON.stringify(clickedText.split('\n')[0]));

    await sleep(300);
    assert('document list has matching active entry', await page.$$eval(
        '#notepadia\\.documentList .notepadia-document-list-entry', els =>
            els.some(e => e.classList.contains('active'))), 'no active entry');

    await openMenuBar(page, 'View');
    await clickByLabel(page, 'Document List');
    await sleep(1000);
    const stillVisible = await page.evaluate(() => {
        const el = document.querySelector('#notepadia\\.documentList');
        if (!el) return false;
        const cs = getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getBoundingClientRect().height > 0;
    });
    assert('Document List toggle hides the panel', !stillVisible, 'panel still visible');

    await openMenuBar(page, 'Window');
    const windowItems = await subLabels(page);
    assert('Window menu offers the Windows... dialog', windowItems.includes('Windows...'),
        JSON.stringify(windowItems));
    const appLabel = windowItems.find(l => /^\d+ app\.js$/.test(l));
    assert('Window menu numbers app.js', !!appLabel, JSON.stringify(windowItems));
    const numbered = windowItems.filter(l => /^\d+ /.test(l));
    assert('Window menu lists every open document', numbered.length === 3, JSON.stringify(windowItems));

    await clickByLabel(page, appLabel);
    await sleep(1500);
    const windowActivated = await modelText(page);
    assert('clicking a Window entry activates the document', windowActivated.includes('function greet'),
        JSON.stringify(windowActivated.split('\n')[0]));

    await openMenuBar(page, 'Window');
    await clickByLabel(page, 'Windows...');
    await waitFor(page, '.notepadia-windows-row', 15000);
    const rows = await windowDialogRows(page);
    assert('Windows... dialog lists Name, Path and Type',
        rows.length === 3
        && rows.some(r => r.name === 'app.js' && r.type === 'js' && r.path.endsWith('app.js'))
        && rows.some(r => r.name === 'config.json' && r.type === 'json')
        && rows.some(r => r.name === 'sample.txt' && r.type === 'txt'),
        JSON.stringify(rows));

    await clickWindowRow(page, 0, false);
    await clickWindowRow(page, 1, true);
    const selectedRows = (await windowDialogRows(page)).filter(r => r.selected);
    assert('Windows... dialog multi-selects rows', selectedRows.length === 2, JSON.stringify(selectedRows));

    await clickDialogButton(page, 'Close');
    const dialogGone = await page.evaluate(() => {
        const el = document.querySelector('.notepadia-windows-list');
        if (!el) return true;
        const cs = getComputedStyle(el);
        return cs.display === 'none' || cs.visibility === 'hidden' || el.getBoundingClientRect().height === 0;
    });
    assert('Windows... Close closes the selected documents', dialogGone,
        'dialog still present');

    await openMenuBar(page, 'Window');
    const afterClose = await subLabels(page);
    const remaining = afterClose.filter(l => /^\d+ /.test(l));
    assert('Window menu rebuilds after closing documents', remaining.length === 1, JSON.stringify(afterClose));
    await closeMenus(page);

    assert('no page errors', errors.length === 0, JSON.stringify(errors));
    await finish(browser);
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });