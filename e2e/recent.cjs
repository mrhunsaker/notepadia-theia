const { assert, finish, sleep, waitFor, launchPage, goto, openFile,
    closeMenus, openMenuBar, hoverByLabel, clickByLabel, subLabels } = require('./lib.js');

(async () => {
    const { browser, page, errors } = await launchPage();
    await goto(page);
    await page.evaluate(() => localStorage.removeItem('notepadia.recentFiles'));

    await openFile(page, 'recent-a.txt');
    await openFile(page, 'recent-b.txt');
    await openFile(page, 'recent-c.txt');
    await sleep(800);

    await closeMenus(page);
    const openedMenu = await openMenuBar(page, 'File');
    assert('File menu opens', openedMenu === true);
    const hovered = await hoverByLabel(page, 'Recent Files');
    await sleep(400);
    let labels = await subLabels(page);
    assert('recent files submenu opens', hovered === true, 'labels=' + JSON.stringify(labels));
    assert('lists all three recent files',
        ['recent-c.txt', 'recent-b.txt', 'recent-a.txt'].every(f => labels.includes(f)), JSON.stringify(labels));
    assert('most recent first',
        labels.indexOf('recent-c.txt') < labels.indexOf('recent-b.txt') && labels.indexOf('recent-b.txt') < labels.indexOf('recent-a.txt'),
        JSON.stringify(labels.filter(l => l && l !== 'Recent Files')));

    const clicked = await clickByLabel(page, 'recent-a.txt');
    await sleep(500);
    const active = await page.$$eval('.lm-TabBar .lm-TabBar-tab', els => els.map(t => (t.textContent || '').trim()));
    assert('recent click opens file', clicked && active.some(t => t.includes('recent-a.txt')), JSON.stringify(active));

    await closeMenus(page);
    await openMenuBar(page, 'File');
    await hoverByLabel(page, 'Recent Files');
    await sleep(400);
    const cleared = await clickByLabel(page, 'Clear Recent Files');
    await closeMenus(page);
    await openMenuBar(page, 'File');
    const gone = await subLabels(page).then(l => !l.includes('Recent Files'));
    assert('clear recent removes submenu', cleared && gone, JSON.stringify(await subLabels(page)));

    assert('no page errors', errors.length === 0, JSON.stringify(errors));
    await finish(browser);
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });