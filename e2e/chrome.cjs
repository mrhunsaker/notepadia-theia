const { assert, finish, sleep, launchPage, goto, openMenuBar, clickByLabel, waitFor } = require('./lib.js');

/**
 * The shell chrome suite (A2, E3).
 *
 * A2 reduces the Theia window to Notepad++'s surfaces: no activity bar strips,
 * no breadcrumbs, and the Folder as Workspace panel collapsed until it is asked
 * for. E3 then presents that panel the way Notepad++ does - the Notepad++ title
 * and a Folder as Workspace context menu rather than VS Code's Explorer menu.
 */

/** Rendered size of the first element matching each selector, or null. */
async function sizes(page, selectors) {
    return page.evaluate(sels => {
        const out = {};
        for (const sel of sels) {
            const el = document.querySelector(sel);
            out[sel] = el ? { w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height } : null;
        }
        return out;
    }, selectors);
}

(async () => {
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await goto(page);
    await sleep(800);

    const before = await sizes(page, [
        '.theia-app-left.theia-app-sides',
        '.theia-app-right.theia-app-sides',
        '.theia-breadcrumbs',
        '.theia-Files'
    ]);
    // A hidden strip is either display:none (width 0) or not in the DOM at all.
    const width = sel => (before[sel] ? before[sel].w : 0);
    assert('activity bar strips render at zero width (A2)',
        width('.theia-app-left.theia-app-sides') === 0 && width('.theia-app-right.theia-app-sides') === 0,
        JSON.stringify(before));
    assert('breadcrumbs are hidden (A2)',
        width('.theia-breadcrumbs') === 0, JSON.stringify(before));
    assert('Folder as Workspace starts collapsed (A2/E3)',
        width('.theia-Files') === 0, JSON.stringify(before));

    await openMenuBar(page, 'View');
    const toggled = await clickByLabel(page, 'Folder as Workspace');
    assert('View > Folder as Workspace toggles the panel (E3)', toggled === true);
    await waitFor(page, '.theia-Files', 10000, 'file navigator');
    await page.waitForFunction(() => {
        const el = document.querySelector('.theia-Files');
        return el && el.getBoundingClientRect().width > 0;
    }, { timeout: 10000 }).catch(() => { });
    await sleep(1200);

    const after = await sizes(page, ['.theia-Files']);
    assert('the panel expands with content (E3)', after['.theia-Files'].w > 0, JSON.stringify(after));

    const header = await page.evaluate(() =>
        (document.querySelector('.theia-sidepanel-toolbar.theia-left-side-panel')?.textContent || '').trim());
    assert("left panel header reads 'Folder as Workspace' (E3)", header === 'Folder as Workspace', header);

    const rowHeight = await page.evaluate(() => {
        const node = Array.from(document.querySelectorAll('.theia-Files .theia-TreeNode'))
            .find(el => el.getBoundingClientRect().height > 0);
        return node ? node.getBoundingClientRect().height : 0;
    });
    assert('tree rows use the tighter 20px height (E3)', rowHeight === 20, String(rowHeight));

    const node = await page.evaluateHandle(() =>
        Array.from(document.querySelectorAll('.theia-Files .theia-TreeNode'))
            .find(el => el.getBoundingClientRect().height > 0) || null);
    const element = node.asElement();
    assert('a tree node is available to right-click (E3)', !!element);
    let labels = [];
    if (element) {
        const box = await element.boundingBox();
        await element.click();
        await sleep(300);
        await page.mouse.move(box.x + Math.min(60, box.width / 2), box.y + box.height / 2);
        // Lumino's context menu is bound to real mouse events; a synthetic
        // right click does not open it, so the press/release are replayed.
        await page.mouse.down({ button: 'right' });
        await sleep(120);
        await page.mouse.up({ button: 'right' });
        await sleep(1200);
        labels = await page.$$eval('.lm-Menu .lm-Menu-item .lm-Menu-itemLabel',
            els => els.map(e => (e.textContent || '').trim()).filter(Boolean));
    }
    const kept = ['New File...', 'New Folder...', 'Find in Files...', 'Copy Path', 'Rename'];
    assert('context menu keeps the Notepad++ entries (E3)',
        kept.every(label => labels.includes(label)), JSON.stringify(labels));
    const dropped = ['Open With...', 'Find in Folder...', 'Compare Selected', 'Collapse All', 'Upload Files...', 'Copy Relative File Path'];
    assert('context menu drops the VS Code entries (E3)',
        dropped.every(label => !labels.includes(label)), JSON.stringify(labels));

    const unexpected = errors.filter(e => !e.startsWith('Failed to load resource'));
    assert('no page errors', unexpected.length === 0, JSON.stringify(unexpected));
    await finish(browser);
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });
