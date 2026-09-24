const { assert, finish, sleep, waitFor, launchPage, goto, openFile,
    currentLine, openMenuBar, hoverByLabel, clickByLabel, subLabels, closeMenus } = require('./lib.js');

const URL = process.env.E2E_URL || 'http://127.0.0.1:3000/';

async function findSubmenuItems(page) {
    return subLabels(page);
}

// Width of the minimap in the *visible* monaco editor; 0 (or null) means the
// Document Map is hidden.
async function minimapWidth(page) {
    return page.evaluate(() => {
        const visible = Array.from(document.querySelectorAll('.monaco-editor'))
            .find(e => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0);
        if (!visible) return null;
        const m = visible.querySelector('.minimap');
        return m ? m.getBoundingClientRect().width : 0;
    });
}

async function pageReload(page) {
    await page.reload({ waitUntil: 'networkidle2' });
    await waitFor(page, '#theia-app-shell', 60000);
    await waitFor(page, '.lm-MenuBar', 30000);
    await sleep(2500);
}

(async () => {
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await goto(page);
    await openFile(page, 'sample.txt');

    // View menu structure
    await openMenuBar(page, 'View');
    const viewTop = await findSubmenuItems(page);
    assert('View menu has Zoom submenu', viewTop.includes('Zoom'), JSON.stringify(viewTop.filter(t => t && t !== 'View')));
    assert('View menu has Tab Size submenu', viewTop.includes('Tab Size'), JSON.stringify(viewTop));
    assert('View menu has Show All Characters', viewTop.includes('Show All Characters'), JSON.stringify(viewTop));
    assert('View menu has Document Map', viewTop.includes('Document Map'), JSON.stringify(viewTop));
    await hoverByLabel(page, 'Zoom');
    await sleep(600);
    const zoomItems = await findSubmenuItems(page);
    assert('Zoom submenu has In/Out/Reset',
        zoomItems.includes('Zoom In') && zoomItems.includes('Zoom Out') && zoomItems.includes('Reset Zoom'),
        JSON.stringify(zoomItems));
    await closeMenus(page);

    await openMenuBar(page, 'View');
    await hoverByLabel(page, 'Tab Size');
    await sleep(600);
    const tabItems = await findSubmenuItems(page);
    assert('Tab Size submenu has 2/4/8', tabItems.includes('2') && tabItems.includes('4') && tabItems.includes('8'),
        JSON.stringify(tabItems));
    assert('Tab Size submenu has Insert Spaces and Use Tabs',
        tabItems.includes('Insert Spaces') && tabItems.includes('Use Tabs'),
        JSON.stringify(tabItems));
    await closeMenus(page);

    // Search menu has Go To Line
    await openMenuBar(page, 'Search');
    const searchItems = await findSubmenuItems(page);
    assert('Search menu has Go To Line...', searchItems.includes('Go To Line...'), JSON.stringify(searchItems));
    await closeMenus(page);

    // Ctrl+G go-to-line works with the editor focused
    await page.evaluate(() => document.querySelector('.monaco-editor').focus());
    await sleep(300);
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyG');
    await page.keyboard.up('Control');
    await sleep(1500);
    const input = await page.$('#quick-input-container input');
    assert('Ctrl+G opens go-to-line quick input', !!input);
    if (input) {
        await input.type('3', { delay: 60 });
        await sleep(600);
        await page.keyboard.press('Enter');
        await sleep(900);
        assert('go-to-line jumps cursor to line 3', await currentLine(page) === 3, 'line=' + await currentLine(page));
    }
    await sleep(400);

    // Zoom In via menu increases the glyph/line size
    const lineHeightBefore = await page.evaluate(() => {
        const el = document.querySelector('.monaco-editor .view-line');
        return el ? el.getBoundingClientRect().height : null;
    });
    await closeMenus(page);
    await openMenuBar(page, 'View');
    await hoverByLabel(page, 'Zoom');
    await sleep(600);
    await clickByLabel(page, 'Zoom In');
    await sleep(800);
    const lineHeightAfter = await page.evaluate(() => {
        const el = document.querySelector('.monaco-editor .view-line');
        return el ? el.getBoundingClientRect().height : null;
    });
    assert('Zoom In grows line height', lineHeightAfter !== null && lineHeightAfter > lineHeightBefore,
        'before=' + lineHeightBefore + ' after=' + lineHeightAfter);

    // A6: View > Document Map toggles a preference that applies to every
    // open editor and survives tab switching and a page reload.
    await closeMenus(page);
    const docMapHiddenBefore = await minimapWidth(page);
    assert('Document Map hidden on cold profile', docMapHiddenBefore !== null && docMapHiddenBefore === 0,
        'minimap width=' + docMapHiddenBefore);

    await openMenuBar(page, 'View');
    await clickByLabel(page, 'Document Map');
    await sleep(1200);
    const docMapOn1 = await minimapWidth(page);
    assert('Document Map can be toggled on', docMapOn1 !== null && docMapOn1 > 0,
        'minimap width=' + docMapOn1);

    await openFile(page, 'app.js');
    await sleep(600);
    const docMapOn2 = await minimapWidth(page);
    assert('Document Map persists to a second editor tab', docMapOn2 !== null && docMapOn2 > 0,
        'minimap width=' + docMapOn2);

    await pageReload(page);
    await openFile(page, 'sample.txt');
    await sleep(1200);
    const docMapAfterReload = await minimapWidth(page);
    assert('Document Map survives a page reload', docMapAfterReload !== null && docMapAfterReload > 0,
        'minimap width=' + docMapAfterReload);

    await openMenuBar(page, 'View');
    await clickByLabel(page, 'Document Map');
    await sleep(1200);
    const docMapOff = await minimapWidth(page);
    assert('Document Map can be toggled off', docMapOff !== null && docMapOff === 0,
        'minimap width=' + docMapOff);
    await closeMenus(page);

    assert('no page errors', errors.length === 0, JSON.stringify(errors));
    await finish(browser);
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });