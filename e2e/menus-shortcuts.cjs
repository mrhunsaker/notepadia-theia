const { assert, finish, sleep, launchPage, goto, openFile, save,
    openMenuBar, subLabels, closeMenus, modelText } = require('./lib.js');

async function press(page, mods, key) {
    for (const m of mods) await page.keyboard.down(m);
    await page.keyboard.press(key);
    for (const m of mods) await page.keyboard.up(m);
    await sleep(700);
}

/** Editor tabs only - the left/right panels keep tabs of their own. */
async function editorTabs(page) {
    return page.$$eval('#theia-main-content-panel .lm-TabBar-tab',
        els => els.map(e => (e.textContent || '').trim()));
}

async function focusEditor(page) {
    await page.evaluate(() => {
        const el = document.querySelector('.monaco-editor .inputarea, .monaco-editor textarea');
        if (el) {
            el.focus();
            return true;
        }
        return false;
    });
    await sleep(250);
}

(async () => {
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await goto(page);
    await openFile(page, 'sample.txt');

    // File menu matches Notepad++ order (no Theia/workspace clutter, no duplicates)
    await openMenuBar(page, 'File');
    const fileItems = await subLabels(page);
    assert('File menu is Notepad++ order',
        JSON.stringify(fileItems) === JSON.stringify(
            ['New', 'Open...',
                // D1: the user's own disk, grouped next to the workspace Open...
                'Open From This Computer...', 'Upload to Workspace...',
                // C1: the only route to choosing a folder as the workspace root,
                // named and placed the way Notepad++ puts it.
                'Open Folder as Workspace...',
                'Recent Files',
                'Save', 'Save As...', 'Save To This Computer...', 'Save a Copy As...', 'Save All',
                'Close', 'Close All', 'Close All But Active',
                'Save Session...', 'Load Session...',
                'Print', 'Print Preview...',
                // C1: the four file commands, after the session and print groups.
                'Reload from Disk', 'Rename...', 'Delete from Disk']),
        JSON.stringify(fileItems));
    await closeMenus(page);

    // Edit menu keeps Find out (Notepad++ puts it under Search only)
    await openMenuBar(page, 'Edit');
    const editItems = await subLabels(page);
    assert('Edit menu has no Find/Replace',
        !editItems.some(i => /find|replace/i.test(i)),
        JSON.stringify(editItems));
    assert('Edit menu keeps line operations',
        editItems.includes('Duplicate Current Line') && editItems.includes('Delete Current Line') &&
        editItems.includes('Line Operations') && editItems.includes('Convert Case'),
        JSON.stringify(editItems));
    await closeMenus(page);

    // Search menu still owns Find/Replace/Find in Files
    await openMenuBar(page, 'Search');
    const searchItems = await subLabels(page);
    assert('Search menu has Find/Replace/Find in Files',
        searchItems.includes('Find...') && searchItems.includes('Replace...') &&
        searchItems.includes('Find in Files') && searchItems.includes('Go To Line...'),
        JSON.stringify(searchItems));
    await closeMenus(page);

    // Ctrl+Shift+U uppercases the selection, Ctrl+U lowercases it
    const base = await modelText(page);
    await focusEditor(page);
    await press(page, ['Control'], 'KeyA');
    await press(page, ['Control', 'Shift'], 'KeyU');
    const upper = await modelText(page);
    assert('Ctrl+Shift+U uppercases the document', upper === base.toUpperCase(),
        'base=' + JSON.stringify(base) + ' upper=' + JSON.stringify(upper));
    await press(page, ['Control'], 'KeyU');
    const lower = await modelText(page);
    assert('Ctrl+U lowercases the document (overrides Monaco cursor undo)', lower === base,
        'base=' + JSON.stringify(base) + ' lower=' + JSON.stringify(lower));
    // ...which leaves the buffer dirty, and a dirty document makes Close All ask
    // before it closes anything. Save so the shortcuts below are only measuring
    // the shortcuts.
    await save(page);

    // D2 - Settings exposes the shortcut editor, which is the only way a user
    // can rebind a chord the browser took away.
    await openMenuBar(page, 'Settings');
    const settingsItems = await subLabels(page);
    await closeMenus(page);
    assert('Settings has a Shortcut Mapper', settingsItems.includes('Shortcut Mapper'),
        JSON.stringify(settingsItems));

    // D2 - every chord the browser reserves has a working alternate. Puppeteer
    // can deliver the alternates precisely because the browser does not
    // reserve them, which is also why they are the ones a real user can press.
    const oneTab = await editorTabs(page);
    await focusEditor(page);
    await press(page, ['Control', 'Alt'], 'KeyN');
    const twoTabs = await editorTabs(page);
    assert('Ctrl+Alt+N opens a new document (alternate for browser-reserved Ctrl+N)',
        twoTabs.length === oneTab.length + 1,
        'before=' + JSON.stringify(oneTab) + ' after=' + JSON.stringify(twoTabs));

    await press(page, ['Control'], 'F4');
    const afterClose = await editorTabs(page);
    assert('Ctrl+F4 closes the current document (Notepad++\'s own alternate for Ctrl+W)',
        afterClose.length === twoTabs.length - 1,
        'before=' + JSON.stringify(twoTabs) + ' after=' + JSON.stringify(afterClose));

    await openFile(page, 'app.js');
    await openFile(page, 'config.json');
    const threeTabs = await editorTabs(page);
    assert('three documents are open before Close All', threeTabs.length === 3,
        JSON.stringify(threeTabs));
    await press(page, ['Control', 'Alt', 'Shift'], 'KeyW');
    const afterCloseAll = await editorTabs(page);
    assert('Ctrl+Alt+Shift+W closes every document (alternate for browser-reserved Ctrl+Shift+W)',
        afterCloseAll.length === 0, JSON.stringify(afterCloseAll));

    // D2 - Ctrl+Alt+O reaches Open From This Computer..., whose Notepad++
    // chord (Ctrl+O) the browser claims. The chooser is cancelled: e2e cannot
    // drive a native file dialog, only prove the command runs.
    const chooser = page.waitForFileChooser({ timeout: 8000 }).catch(() => null);
    await press(page, ['Control', 'Alt'], 'KeyO');
    const opened = await chooser;
    assert('Ctrl+Alt+O opens the local file picker (alternate for browser-reserved Ctrl+O)',
        opened !== null);
    if (opened) {
        await opened.cancel().catch(() => { });
        await sleep(600);
    }

    // D2 - the editor's zoom chords stay on the editor while it has focus:
    // the text grows and the page does not.
    await openFile(page, 'sample.txt');
    // Which keys count as a zoom chord, and which of them the guard claims, is
    // covered by test/zoom-chords.test.cjs against the pure helper. It cannot
    // be observed from here: Theia calls preventDefault() on the same node in
    // the same phase for every chord it handles, and stops propagation before
    // any listener a test could add gets to look, so `defaultPrevented` would
    // report Theia either way. What is observable - and what the user cares
    // about - is the outcome.
    await focusEditor(page);
    const fontBefore = await page.evaluate(() => {
        const el = document.querySelector('.monaco-editor .view-lines');
        return el ? parseFloat(getComputedStyle(el).fontSize) : null;
    });
    const ratioBefore = await page.evaluate(() => window.devicePixelRatio);
    await press(page, ['Control'], 'Equal');
    const fontAfter = await page.evaluate(() => {
        const el = document.querySelector('.monaco-editor .view-lines');
        return el ? parseFloat(getComputedStyle(el).fontSize) : null;
    });
    const ratioAfter = await page.evaluate(() => window.devicePixelRatio);
    assert('Ctrl+= grows the editor text', fontBefore !== null && fontAfter !== null && fontAfter > fontBefore,
        `${fontBefore} -> ${fontAfter}`);
    assert('Ctrl+= with the editor focused does not zoom the page', ratioAfter === ratioBefore,
        `${ratioBefore} -> ${ratioAfter}`);
    await press(page, ['Control'], '0');
    const fontReset = await page.evaluate(() => {
        const el = document.querySelector('.monaco-editor .view-lines');
        return el ? parseFloat(getComputedStyle(el).fontSize) : null;
    });
    assert('Ctrl+0 puts the editor text back', fontReset === fontBefore,
        `${fontAfter} -> ${fontReset}`);

    assert('no page errors', errors.length === 0, JSON.stringify(errors));
    await finish(browser);
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });
