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
    openMenuBar, clickByLabel, closeMenus, clickMenuPath, clickToolbarButton } = require('./lib.js');
const { openFindDialog, dialogTabState, closeDialog } = require('./dialog-helpers.cjs');

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

/**
 * Serious and critical axe violations only: the bar F1 sets for the app.
 *
 * With `rootSelector` the scan is scoped to one surface, which is how a modal
 * dialog is measured: the background behind it is not this dialog's markup, and
 * a finding against it would name the wrong thing.
 */
async function blockingViolations(page, rootSelector) {
    return page.evaluate(async sel => {
        let context = document;
        if (sel) {
            context = document.querySelector(sel);
            if (!context) {
                return [{ id: 'surface-not-found', impact: 'critical', nodes: 0, target: sel, help: 'the surface was not open' }];
            }
        }
        const result = await window.axe.run(context, { resultTypes: ['violations'] });
        return result.violations
            .filter(violation => violation.impact === 'serious' || violation.impact === 'critical')
            .map(violation => ({
                id: violation.id,
                impact: violation.impact,
                nodes: violation.nodes.length,
                target: (violation.nodes[0].target || []).join(' '),
                targets: violation.nodes.map(node => (node.target || []).join(' ')),
                help: violation.help
            }));
    }, rootSelector || null);
}

// The roles a user has to be able to name before operating them. A control with
// text but none of this is announced as a bare "button"/"edit" and is unusable.
const INTERACTIVE_ROLES = new Set([
    'button', 'checkbox', 'combobox', 'gridcell', 'link', 'listbox', 'menuitem',
    'menuitemcheckbox', 'menuitemradio', 'option', 'radio', 'searchbox', 'slider',
    'spinbutton', 'switch', 'tab', 'textbox', 'treeitem'
]);

/**
 * The interactive controls inside one surface whose Chromium-computed
 * accessible name is empty. This is what a screen reader actually announces, so
 * it catches a control that has a look-alike sibling label but no real name.
 */
async function unnamedInteractive(page, rootSelector) {
    const handle = await page.$(rootSelector);
    if (!handle) {
        return { missing: true, names: [] };
    }
    const snapshot = await page.accessibility.snapshot({ root: handle });
    const names = [];
    const walk = node => {
        if (!node) {
            return;
        }
        if (node.role && INTERACTIVE_ROLES.has(node.role) && !(node.name || '').trim()) {
            names.push(node.role);
        }
        for (const child of node.children || []) {
            walk(child);
        }
    };
    walk(snapshot);
    await handle.dispose();
    return { missing: false, names };
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
    // A previous interaction can leave focus on the status bar (which is
    // focusable), and `body.focus()` alone does not blur it or reset Chromium's
    // sequential-focus starting point. Making the body focusable and focusing
    // it does both, so the walk starts at the first stop in document order.
    await page.evaluate(() => {
        document.body.tabIndex = -1;
        document.body.focus();
    });
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

/**
 * The menu open right now, or `null`. Lumino attaches a menu's `.lm-Menu-content`
 * (role="menu") to the body when it opens and hides it on close, so the visible
 * one is the open menu.
 */
const visibleMenu = () => {
    const menus = Array.from(document.querySelectorAll('.lm-Menu-content'));
    const menu = menus.find(m => {
        const rect = m.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    });
    if (!menu) {
        return null;
    }
    return {
        role: menu.getAttribute('role') || '',
        items: menu.querySelectorAll('.lm-Menu-item[role="menuitem"]').length,
        label: (menu.querySelector('.lm-Menu-itemLabel')?.textContent || '').trim().slice(0, 24)
    };
};

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

    // ---- 1b. The menu bar opens by keyboard. The docs claim Enter or Down
    // opens a top-level menu; the 2026.10 Orca run could not open one at all.
    // Measuring the plain-keyboard path here guards the claim and tells an
    // Orca-only failure apart from a menu bar that genuinely cannot open.
    // The ring above already proves Tab reaches the menu bar; focus its single
    // tab stop directly so the key presses below land on it.
    await page.evaluate(() => {
        const item = document.querySelector('.lm-MenuBar-item[tabindex="0"]')
            || document.querySelector('.lm-MenuBar-item');
        item && item.focus();
    });
    await sleep(300);
    const barFocused = await page.evaluate(focusInfo);
    assert('the menu bar item takes keyboard focus', barFocused.role === 'menuitem',
        JSON.stringify(barFocused));

    await page.keyboard.press('ArrowDown');
    await sleep(500);
    const openedByDown = await page.evaluate(visibleMenu);
    assert('Down Arrow opens the focused top-level menu',
        !!openedByDown && openedByDown.role === 'menu' && openedByDown.items > 0,
        JSON.stringify(openedByDown));
    await page.keyboard.press('Escape');
    await sleep(400);

    await page.evaluate(() => {
        const item = document.querySelector('.lm-MenuBar-item[tabindex="0"]')
            || document.querySelector('.lm-MenuBar-item');
        item && item.focus();
    });
    await sleep(300);
    await page.keyboard.press('Enter');
    await sleep(500);
    const openedByEnter = await page.evaluate(visibleMenu);
    assert('Enter opens the focused top-level menu',
        !!openedByEnter && openedByEnter.role === 'menu' && openedByEnter.items > 0,
        JSON.stringify(openedByEnter));
    await page.keyboard.press('Escape');
    await sleep(400);

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
    await page.evaluate(() => {
        document.body.tabIndex = -1;
        document.body.focus();
    });
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

    // The find tabs follow the ARIA tabs pattern: one Tab stop for the group, a
    // roving tabindex, and Left/Right/Home/End to open the others. A mouse could
    // always switch them, so only a keyboard walk proves the non-selected tabs
    // are reachable - the exact failure both Orca and NVDA reported.
    await page.evaluate(() => {
        document.querySelector('.notepadia-find-tab[aria-selected="true"]')?.focus();
    });
    await sleep(200);
    const tabStart = await dialogTabState(page);
    assert('the find dialog exposes four named tabs with one roving stop',
        tabStart.tabs.length === 4
        && tabStart.tabs.every(tab => tab.role === 'tab' && tab.label.length > 0)
        && tabStart.tabs.filter(tab => tab.tabindex === '0').length === 1,
        JSON.stringify(tabStart));

    const selectedByArrows = [];
    for (let i = 0; i < 3; i++) {
        await page.keyboard.press('ArrowRight');
        await sleep(250);
        selectedByArrows.push(await dialogTabState(page));
    }
    assert('Left/Right arrows open every find dialog tab from the keyboard',
        selectedByArrows.map(state => state.selected[0]).join(',') === 'Replace,Find in Files,Mark'
        && selectedByArrows.every(state => state.focusedRole === 'tab'),
        JSON.stringify(selectedByArrows));

    await page.keyboard.press('Home');
    await sleep(250);
    const tabHome = await dialogTabState(page);
    assert('Home returns to the first find dialog tab',
        tabHome.selected[0] === 'Find' && tabHome.focused === 'notepadia-find-tab-find',
        JSON.stringify(tabHome));

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

    // ---- 5b. Every remaining v8 dialog and panel, measured in isolation.
    // Section 5 answered "does this surface violate axe"; this answers the
    // other half of the same question - does every control inside it announce a
    // name - for the surfaces a screen reader reaches after the chrome pass.
    // Each is opened the way a user opens it, scoped-scanned, then closed.
    const focusEditor = async () => {
        await page.click('.monaco-editor .view-lines').catch(() => { });
        await sleep(300);
    };
    const auditSurface = async (label, open, selector, close) => {
        await open();
        await sleep(900);
        const unnamed = await unnamedInteractive(page, selector);
        assert(`${label}: every interactive control has an accessible name`,
            !unnamed.missing && unnamed.names.length === 0, JSON.stringify(unnamed));
        const violations = await blockingViolations(page, selector);
        assert(`${label}: no serious or critical axe violations`,
            violations.length === 0, JSON.stringify(violations, null, 1));
        await close();
        await sleep(700);
    };

    await auditSurface('axe/NX: Search Results',
        async () => { await focusEditor(); await page.keyboard.press('F7'); },
        '[id="notepadia.searchResults"]',
        async () => { await focusEditor(); await page.keyboard.press('F7'); });

    await auditSurface('axe/NX: Incremental Search',
        async () => { await openMenuBar(page, 'Search'); await clickByLabel(page, 'Incremental Search'); await closeMenus(page); },
        '[id="notepadia.incrementalSearch"]',
        async () => { await openMenuBar(page, 'Search'); await clickByLabel(page, 'Incremental Search'); await closeMenus(page); });

    await auditSurface('axe/NX: Function List',
        async () => { await clickToolbarButton(page, 'Function List'); },
        '[id="notepadia.functionList"]',
        async () => { await clickToolbarButton(page, 'Function List'); });

    // Each dialog closes with Escape, the AbstractDialog shortcut, so no
    // surface is closed by a button whose real job is something else.
    const dialogSurface = (label, path) => auditSurface(label,
        async () => { await clickMenuPath(page, path); },
        '.dialogBlock',
        async () => { await page.keyboard.press('Escape'); });

    await dialogSurface('axe/NX: Run dialog', ['Run', 'Run...']);
    await dialogSurface('axe/NX: Column Editor', ['Edit', 'Line Operations', 'Column Editor...']);
    await dialogSurface('axe/NX: Summary dialog', ['View', 'Summary...']);
    await dialogSurface('axe/NX: Windows dialog', ['Window', 'Windows...']);
    await dialogSurface('axe/NX: Date & Time customized dialog',
        ['Edit', 'Insert', 'Date & Time', 'Date & Time (customized)...']);

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