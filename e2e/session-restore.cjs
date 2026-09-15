const { assert, finish, sleep, waitFor, launchPage, openFile,
    currentLine, modelText, closeMenus } = require('./lib.js');

const URL = process.env.E2E_URL || 'http://127.0.0.1:3000/';

async function tabLabels(page) {
    return page.evaluate(() => Array.from(document.querySelectorAll('li.lm-TabBar-tab'))
        .filter(t => t.getBoundingClientRect().width > 0 && t.getBoundingClientRect().height > 0)
        .map(t => (t.textContent || '').trim())
        .filter(t => t.includes('.txt') || t.includes('.js')));
}

async function activeTabLabel(page) {
    return page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('li.lm-TabBar-tab'))
            .filter(t => t.getBoundingClientRect().width > 0 && t.getBoundingClientRect().height > 0);
        const active = tabs.find(t => t.classList.contains('lm-mod-current'));
        return active ? (active.textContent || '').trim() : null;
    });
}

(async () => {
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(URL, { waitUntil: 'networkidle2' });
    await waitFor(page, '#theia-app-shell', 60000);
    await waitFor(page, '.lm-MenuBar', 30000);
    await sleep(2500);

    await openFile(page, 'sample.txt');
    let labels = await tabLabels(page);
    assert('one editor tab open', labels.includes('sample.txt'), JSON.stringify(labels));

    await openFile(page, 'recent-a.txt');
    labels = await tabLabels(page);
    assert('second editor tab open', labels.includes('sample.txt') && labels.includes('recent-a.txt'),
        JSON.stringify(labels));

    // Scroll the sample.txt editor away from the cursor-default position and
    // move the cursor down so restore can be observed meaningfully.
    await page.evaluate(() => document.querySelector('.monaco-editor').focus());
    await sleep(300);
    await page.keyboard.press('ArrowDown');
    await sleep(300);
    await page.keyboard.press('ArrowDown');
    await sleep(300);
    const lineBefore = await currentLine(page);

    // Reload the same page: Theia stores the shell layout on unload and
    // restores it from localStorage on startup.
    await page.reload({ waitUntil: 'networkidle2' });
    await waitFor(page, '#theia-app-shell', 60000);
    await waitFor(page, '.lm-MenuBar', 30000);
    await sleep(3000);

    labels = await tabLabels(page);
    assert('editors restored after reload', labels.includes('sample.txt') && labels.includes('recent-a.txt'),
        JSON.stringify(labels));
    const active = await activeTabLabel(page);
    assert('last active editor restored and focused', active !== null, JSON.stringify(active));

    const lines = await page.evaluate(() => Array.from(document.querySelectorAll('.view-line')).map(e => e.innerText));
    assert('restored sample.txt has content', lines.length > 0 && lines[0] === 'alpha', JSON.stringify(lines.slice(0, 3)));

    const lineAfter = await currentLine(page);
    assert('restored cursor position matches', lineAfter === lineBefore, 'before=' + lineBefore + ' after=' + lineAfter);

    const text = await modelText(page);
    assert('active editor is writable after restore', typeof text === 'string' && text.length > 0, JSON.stringify(text));
    await closeMenus(page);

    assert('no page errors', errors.length === 0, JSON.stringify(errors));
    await finish(browser);
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });