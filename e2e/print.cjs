const fs = require('fs');
const path = require('path');
const { assert, finish, sleep, launchPage, goto, openFile, waitFor,
    openMenuBar, clickByLabel, closeMenus, WS } = require('./lib.js');

async function openPrint(page, label, popupPromise) {
    await openMenuBar(page, 'File');
    await clickByLabel(page, label);
    const popup = await popupPromise;
    await sleep(1200);
    return popup;
}

async function visibleFileMenuEntry(page, label) {
    await openMenuBar(page, 'File');
    const found = await page.evaluate(l => {
        const labels = Array.from(document.querySelectorAll('.lm-Menu-item .lm-Menu-itemLabel'));
        return labels.some(e => (e.textContent || '').trim() === l);
    }, label);
    await closeMenus(page);
    return found;
}

function popupPromise(page) {
    return new Promise(resolve => {
        const timer = setTimeout(() => resolve(null), 12000);
        page.once('popup', p => {
            clearTimeout(timer);
            resolve(p);
        });
    });
}

(async () => {
    // Earlier suites can leave dirty buffers saved over sample.txt (Theia
    // persists dirty editors on shutdown), so restore the fixture first.
    fs.writeFileSync(path.join(WS, 'sample.txt'), 'alpha\nbeta\ngamma\n');
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await goto(page);
    await openFile(page, 'sample.txt');

    assert('File menu offers Print', await visibleFileMenuEntry(page, 'Print'), 'no Print entry');

    // Print Preview opens a popup rendering the document with the file name header
    const previewPromise = popupPromise(page);
    const preview = await openPrint(page, 'Print Preview...', previewPromise);
    assert('Print Preview opens a print window', !!preview && !preview.isClosed(), 'no popup');
    if (preview && !preview.isClosed()) {
        await preview.waitForSelector('h1', { timeout: 10000 });
        const content = await preview.content();
        assert('print window renders the file name', content.includes('sample.txt'),
            'no <h1>sample.txt</h1>');
        assert('print window renders the document text',
            content.includes('alpha') && content.includes('gamma'),
            'document text missing');
        assert('print window numbers the lines', /<td class="ln">1<\/td>/.test(content),
            'no line numbers');
        await preview.close();
    }

    // Print opens the same window and triggers window.print() (no-op in headless)
    const printPromise = popupPromise(page);
    const printed = await openPrint(page, 'Print', printPromise);
    assert('Print opens a print window', !!printed && !printed.isClosed(), 'no popup');
    if (printed && !printed.isClosed()) {
        await printed.waitForSelector('h1', { timeout: 10000 });
        await printed.close();
    }

    assert('no page errors', errors.length === 0, JSON.stringify(errors));
    await finish(browser);
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });