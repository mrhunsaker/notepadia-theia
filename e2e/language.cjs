const { assert, finish, sleep, waitFor, launchPage, goto, openFile,
    statusLang, openMenuBar, clickByLabel, subLabels, closeMenus } = require('./lib.js');

(async () => {
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await goto(page);

    await openFile(page, 'sample.txt');
    const langBefore = await statusLang(page);
    assert('status language shows Plain Text for .txt', langBefore === 'Plain Text', JSON.stringify(langBefore));

    await openMenuBar(page, 'Language');
    const items = await subLabels(page);
    assert('Language menu structure', items[0] === 'Change Language Mode...' && items[1] === 'JavaScript'
        && items.includes('JSON') && items.includes('PowerShell')
        && items[items.length - 1] === 'Plain Text' && items.length === 22,
        'count=' + items.length + ' first=' + JSON.stringify(items.slice(0, 2)) + ' last=' + JSON.stringify(items.slice(-1)));
    await closeMenus(page);

    await openMenuBar(page, 'Language');
    await sleep(200);
    await clickByLabel(page, 'JavaScript');
    await sleep(400);
    const langJs = await statusLang(page);
    assert('status language switches to JavaScript via menu', langJs === 'JavaScript', JSON.stringify(langJs));

    await page.evaluate(() => document.querySelector('[id="status-bar-notepadia.language"]')
        .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
    await sleep(2000);
    const qpRows = await page.$$eval('#quick-input-container .monaco-list-row',
        els => els.map(r => (r.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean));
    assert('quick pick lists registered languages', qpRows.length > 4 || qpRows.join(',').includes('C++'),
        JSON.stringify(qpRows.slice(0, 8)));
    const qi = await page.$('#quick-input-container input');
    await qi.type('Python', { delay: 20 });
    await sleep(1000);
    const filtered = await page.$$eval('#quick-input-container .monaco-list-row',
        els => els.map(r => (r.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean));
    assert('quick pick filters to Python', filtered.some(r => r.includes('Python')), JSON.stringify(filtered.slice(0, 5)));
    await page.keyboard.press('Escape');
    await sleep(400);

    await openFile(page, 'app.js');
    await sleep(2000);
    const langJsFile = await statusLang(page);
    const mtk = await page.evaluate(() => Array.from(document.querySelectorAll('.view-line span[class*="mtk"]')).length);
    assert('app.js auto-detected as JavaScript', langJsFile === 'JavaScript', JSON.stringify(langJsFile));
    assert('javascript file tokenized (mtk spans)', mtk > 3, 'mtk=' + mtk);

    await openFile(page, 'config.json');
    await sleep(2000);
    const langJson = await statusLang(page);
    const mtkJson = await page.evaluate(() => Array.from(document.querySelectorAll('.view-line span[class*="mtk"]')).length);
    assert('config.json auto-detected as JSON', langJson === 'JSON', JSON.stringify(langJson));
    assert('json file tokenized (mtk spans)', mtkJson > 3, 'mtkJson=' + mtkJson);

    await openFile(page, 'script.ps1');
    await sleep(2000);
    const langPs = await statusLang(page);
    const mtkPs = await page.evaluate(() => Array.from(document.querySelectorAll('.view-line span[class*="mtk"]')).length);
    assert('script.ps1 auto-detected as PowerShell', langPs === 'PowerShell', JSON.stringify(langPs));
    assert('powershell file tokenized (mtk spans)', mtkPs > 5, 'mtkPs=' + mtkPs);

    assert('no page errors', errors.length === 0, JSON.stringify(errors));
    await finish(browser);
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });