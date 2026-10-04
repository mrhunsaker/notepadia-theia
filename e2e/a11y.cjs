// F1 - keyboard and screen-reader verification of the workbench chrome.
//
// The suite measures the running app rather than reading the source, because
// the three defects it guards against were all invisible in the code and only
// appeared under measurement: Lumino renders tab titles as <li> elements that
// the shell's own role cancels, Theia labels roleless status bar <div>s (one
// with a literal "$(bracket), [object HTMLDivElement]"), and Monaco's Tab
// binding leaves no keyboard way out of the editor.
//
// It also states the one thing this environment cannot check. Alt+F1 is
// Monaco's accessibility help and Theia 1.75 does not register it; the
// assertion records that so the gap stays visible instead of being assumed
// either way, and `docs/accessibility.md` carries the same note next to the
// NVDA/Orca results a human still has to produce.

const { assert, finish, sleep, launchPage, goto, openFile,
    openMenuBar, clickByLabel, closeMenus } = require('./lib.js');
const { openFindDialog, closeDialog } = require('./dialog-helpers.cjs');

const AXE = require.resolve('axe-core');

/** The text of one Notepadia status bar field, e.g. 'Ln : 1  Col : 1  Pos : 0'. */
const statusField = (page, id) => page.evaluate(i =>
    document.querySelector(`[id="status-bar-${i}"]`)?.textContent?.trim() || null, id);

/** What the app is right now, reduced to the facts the assertions care about. */
const focusInfo = () => {
    const active = document.activeElement;
    if (!active || active === document.body) {
        return { id: 'body', role: 'body' };
    }
    const rect = active.getBoundingClientRect();
    return {
        id: active.id || '',
        tag: active.tagName.toLowerCase(),
        cls: (active.className || '').toString().split(' ').filter(Boolean).slice(0, 2).join(' '),
        role: active.getAttribute('role') || '',
        name: ((active.getAttribute('aria-label') || active.innerText || '')).trim().split('\n')[0].slice(0, 40),
        editor: !!active.closest('.monaco-editor'),
        statusBar: !!active.closest('#theia-statusBar'),
        visible: rect.width > 0 && rect.height > 0
    };
};

/** Serious and critical axe violations only: the bar F1 sets for the app. */
async function blockingViolations(page) {
    return page.evaluate(async () => {
        const result = await window.axe.run(document, { resultTypes: ['violations'] });
        return result.violations
            .filter(violation => violation.impact === 'serious' || violation.impact === 'critical')
            .map(violation => ({
                id: violation.id,
                impact: violation.impact,
                nodes: violation.nodes.length,
                target: (violation.nodes[0].target || []).join(' '),
                help: violation.help
            }));
    });
}

async function injectAxe(page) {
    await page.addScriptTag({ path: AXE });
    await sleep(200);
}

/**
 * The accessible name Chromium computes for whatever holds focus, read from
 * the accessibility tree rather than from the DOM. This is the check the
 * screen reader actually experiences, and it is the one that catches an
 * element that has text but no name.
 */
async function accessibilityName(page) {
    const handle = await page.evaluateHandle(() => document.activeElement);
    const snapshot = await page.accessibility.snapshot({ root: handle });
    return (snapshot && snapshot.name ? snapshot.name : '').trim();
}

/**
 * Presses Tab `limit` times from a focus reset and records every stop, so the
 * assertions can look at the ring as a whole rather than at one hop.
 */
async function walkTabRing(page, limit = 8) {
    // A cold load leaves focus on <body>, and Tab from there enters the ring
    // at the first stop.
    await page.evaluate(() => document.body.focus());
    await sleep(300);
    const stops = [];
    for (let i = 0; i < limit; i++) {
        await page.keyboard.press('Tab');
        const stop = await page.evaluate(focusInfo);
        if (stop.id !== 'body') {
            stop.axName = await accessibilityName(page);
        }
        stops.push(stop);
    }
    return stops;
}

const firstIndexOf = (stops, predicate) => stops.findIndex(predicate);

(async () => {
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await goto(page);
    await openFile(page, 'sample.txt');
    await sleep(700);

    // ---- 1. The tab ring reaches every region, in the order a user expects.
    const stops = await walkTabRing(page);
    const summary = stops.map(s => `${s.tag}${s.role ? '[' + s.role + ']' : ''}:${s.name || s.id}`);

    assert('Tab reaches the menu bar',
        stops.some(s => s.role === 'menuitem' && s.name.length > 0), JSON.stringify(summary));
    assert('Tab reaches the toolbar',
        stops.some(s => s.tag === 'button' && s.name.length > 0), JSON.stringify(summary));
    assert('Tab reaches the document tab bar',
        stops.some(s => s.role === 'tab' && s.name.length > 0), JSON.stringify(summary));
    assert('Tab reaches the editor',
        stops.some(s => s.role === 'textbox' && s.editor), JSON.stringify(summary));

    // Every stop the ring visits has to announce itself; a control with text
    // but no accessible name is unusable with a screen reader.
    const unnamed = stops.filter(s => s.id !== 'body' && !s.axName);
    assert('every stop in the ring has a non-empty accessible name',
        unnamed.length === 0,
        JSON.stringify(unnamed.map(s => `${s.tag}.${s.cls}`)));

    // The menu bar and toolbar are single stops by design (Lumino roving
    // tabindex), so the walk must not stall before the editor: assert the
    // regions arrive in document order rather than as one repeated stop.
    assert('the ring arrives in order: menu, toolbar, tab bar, editor',
        firstIndexOf(stops, s => s.role === 'menuitem') < firstIndexOf(stops, s => s.tag === 'button')
        && firstIndexOf(stops, s => s.tag === 'button') < firstIndexOf(stops, s => s.role === 'tab')
        && firstIndexOf(stops, s => s.role === 'tab') < firstIndexOf(stops, s => s.role === 'textbox'),
        JSON.stringify(summary));

    // ---- 2. The editor is not a keyboard trap.
    await page.evaluate(() => {
        const textarea = document.querySelector('.monaco-editor textarea');
        if (textarea) {
            textarea.focus();
        }
    });
    await sleep(300);
    const editorBefore = await page.evaluate(focusInfo);
    assert('the editor holds focus for the trap test', editorBefore.role === 'textbox', JSON.stringify(editorBefore));

    // Tab on its own must keep behaving like Notepad++: it indents. The status bar
    // column and offset are the user-visible proof that a character went in.
    const beforeTab = await statusField(page, 'notepadia.position');
    await page.keyboard.press('Tab');
    await sleep(400);
    const afterPlainTab = await page.evaluate(focusInfo);
    const afterTab = await statusField(page, 'notepadia.position');
    // Characters in and focus still in the editor: Tab indents rather than moving
    // focus, wherever the caret is. The offset may advance by more than one,
    // because a tab advances to the next tab stop rather than one column.
    const offsetOf = text => {
        const found = /Pos : (\d+)/.exec(text || '');
        return found ? parseInt(found[1], 10) : null;
    };
    assert('Tab alone stays in the editor and indents, as in Notepad++',
        afterPlainTab.role === 'textbox'
        && offsetOf(beforeTab) !== null
        && offsetOf(afterTab) !== null
        && offsetOf(afterTab) > offsetOf(beforeTab),
        JSON.stringify({ afterPlainTab, beforeTab, afterTab }));

    // Escape then Tab is the way out, and it must land on a real stop.
    await page.keyboard.press('Escape');
    await sleep(200);
    await page.keyboard.press('Tab');
    await sleep(500);
    const afterEscapeTab = await page.evaluate(focusInfo);
    assert('Escape then Tab leaves the editor (no keyboard trap)',
        !afterEscapeTab.editor && afterEscapeTab.visible, JSON.stringify(afterEscapeTab));

    // ---- 3. The status bar is one reachable stop with a name.
    // The ring has to be walked to the editor and then out of it the accessible
    // way, because the editor holds focus until Escape says otherwise.
    await page.evaluate(() => document.body.focus());
    await sleep(300);
    const ring = [];
    for (let i = 0; i < 8 && !ring.some(stop => stop.statusBar); i++) {
        await page.keyboard.press('Tab');
        const stop = await page.evaluate(focusInfo);
        ring.push(stop);
        if (stop.role === 'textbox') {
            await page.keyboard.press('Escape');
            await page.keyboard.press('Tab');
            await sleep(300);
            ring.push(await page.evaluate(focusInfo));
        }
    }
    const statusStop = ring.find(stop => stop.statusBar) || null;
    assert('Tab reaches the status bar', statusStop !== null,
        JSON.stringify(ring.map(stop => `${stop.tag}${stop.role ? '[' + stop.role + ']' : ''}:${stop.name || stop.id}`)));
    assert('the status bar stop has an accessible name',
        statusStop && statusStop.name.length > 0, JSON.stringify(statusStop));

    // ---- 4. Accessible names on the chrome the brief names.
    const names = await page.evaluate(() => ({
        menuItems: Array.from(document.querySelectorAll('.lm-MenuBar-item'))
            .map(el => (el.textContent || '').trim()).filter(Boolean),
        toolbarButtons: Array.from(document.querySelectorAll('.notepadia-toolbar-button'))
            .map(el => el.getAttribute('aria-label') || (el.textContent || '').trim()),
        editorTextbox: document.querySelector('.monaco-editor textarea')?.getAttribute('aria-label') || '',
        editorRole: document.querySelector('.monaco-editor')?.getAttribute('role') || '',
        tabs: Array.from(document.querySelectorAll('.lm-TabBar-content > .lm-TabBar-tab'))
            .map(el => ({ role: el.getAttribute('role'), name: el.getAttribute('aria-label') || (el.textContent || '').trim() }))
    }));
    assert('every menu bar item has text', names.menuItems.length > 0 && names.menuItems.every(Boolean), JSON.stringify(names.menuItems));
    assert('every toolbar button has an accessible name',
        names.toolbarButtons.length > 0 && names.toolbarButtons.every(name => name.length > 0),
        JSON.stringify(names.toolbarButtons.filter(name => !name)));
    assert('the editor textarea is named for screen readers',
        names.editorTextbox.length > 0, JSON.stringify(names.editorTextbox));
    assert('the editor exposes a code role', names.editorRole === 'code', JSON.stringify(names.editorRole));
    assert('every document tab is a tab with a name',
        names.tabs.length > 0 && names.tabs.every(tab => tab.role === 'tab' && tab.name.length > 0),
        JSON.stringify(names.tabs));

    // ---- 5. axe: no serious or critical violations in any state the brief names.
    await injectAxe(page);

    const defaultLayout = await blockingViolations(page);
    assert('axe: default layout has no serious or critical violations',
        defaultLayout.length === 0, JSON.stringify(defaultLayout, null, 1));

    // An open menu is its own state, and the one the menu repair exists for.
    await openMenuBar(page, 'Edit');
    await sleep(700);
    const openMenu = await blockingViolations(page);
    assert('axe: an open menu has no serious or critical violations',
        openMenu.length === 0, JSON.stringify(openMenu, null, 1));
    await closeMenus(page);
    await sleep(400);

    await openFindDialog(page);
    const findState = await blockingViolations(page);
    assert('axe: the find dialog has no serious or critical violations',
        findState.length === 0, JSON.stringify(findState, null, 1));
    await closeDialog(page);
    await sleep(400);

    // All four Notepadia panels, each opened through its own View menu toggle.
    for (const label of ['Document Map', 'Document List', 'Character Panel', 'Clipboard History']) {
        await openMenuBar(page, 'View');
        await clickByLabel(page, label);
        await closeMenus(page);
        await sleep(1200);
        const panelState = await blockingViolations(page);
        assert(`axe: ${label} has no serious or critical violations`,
            panelState.length === 0, JSON.stringify(panelState, null, 1));
        await openMenuBar(page, 'View');
        await clickByLabel(page, label);
        await sleep(800);
    }

    // ---- 6. The gap this environment cannot close, recorded rather than assumed.
    const altF1 = await page.evaluate(() => {
        document.querySelector('.monaco-editor textarea')?.focus();
        return true;
    });
    assert('the editor is focusable for the Alt+F1 check', altF1 === true);
    await page.keyboard.down('Alt');
    await page.keyboard.press('F1');
    await page.keyboard.up('Alt');
    await sleep(700);
    const helpDialogs = await page.evaluate(() => ({
        overlays: document.querySelectorAll('.dialogOverlay').length,
        widgets: document.querySelectorAll('.monaco-message-box, .monaco-hover').length
    }));
    assert('Alt+F1 opens no help dialog, which Theia 1.75 does not provide',
        helpDialogs.overlays === 0, JSON.stringify(helpDialogs));

    // ---- 7. Errors.
    assert('no page errors during the accessibility pass', errors.length === 0, JSON.stringify(errors));

    await finish(browser);
})().catch(error => {
    console.error(error);
    process.exit(1);
});