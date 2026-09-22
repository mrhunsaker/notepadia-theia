/*
 * A3 - Notepad++ toolbar.
 *
 * Covers the acceptance criteria: the toolbar is present on load below the menu
 * bar, its buttons execute the same commands as the menus and track their
 * enabled/toggled state, it is fully reachable by keyboard, and View > Toolbar
 * survives a reload.
 */
const { assert, finish, sleep, launchPage, goto, openFile, waitFor,
    clickMenuItem, editorLines, closeMenus } = require('./lib.js');

const TOOLBAR = '.notepadia-toolbar [role="toolbar"]';

const toolbarButtons = page => page.$$eval('.notepadia-toolbar-button', els => els.map(el => ({
    id: el.dataset.toolbarId,
    commandId: el.dataset.commandId,
    label: el.getAttribute('aria-label'),
    title: el.getAttribute('title'),
    disabled: el.getAttribute('aria-disabled') === 'true',
    pressed: el.getAttribute('aria-pressed'),
    tabIndex: el.tabIndex
})));

const buttonById = async (page, id) => (await toolbarButtons(page)).find(b => b.id === id);

const clickToolbar = async (page, id) => {
    const handle = await page.$(`[data-toolbar-id="${id}"]`);
    if (!handle) throw new Error('no toolbar button: ' + id);
    await handle.click();
    await sleep(900);
};

const toolbarVisible = page => page.evaluate(() => {
    const el = document.querySelector('.notepadia-toolbar');
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
});

const focusedToolbarId = page => page.evaluate(() =>
    document.activeElement && document.activeElement.dataset
        ? document.activeElement.dataset.toolbarId || null
        : null);

async function main() {
    const { browser, page, errors } = await launchPage({ viewport: { width: 1280, height: 900 } });
    try {
        await goto(page);
        await waitFor(page, '.notepadia-toolbar', 30000, 'toolbar widget');

        // --- presence and placement -------------------------------------
        assert('toolbar is visible on load', await toolbarVisible(page));

        const geometry = await page.evaluate(() => {
            const bar = document.querySelector('.lm-MenuBar');
            const tb = document.querySelector('.notepadia-toolbar');
            const editor = document.querySelector('#theia-main-content-panel');
            if (!bar || !tb) return null;
            const b = bar.getBoundingClientRect();
            const t = tb.getBoundingClientRect();
            return {
                menuBottom: b.bottom,
                toolbarTop: t.top,
                toolbarHeight: t.height,
                editorTop: editor ? editor.getBoundingClientRect().top : null
            };
        });
        assert('toolbar sits below the menu bar', geometry && geometry.toolbarTop >= geometry.menuBottom - 1,
            JSON.stringify(geometry));
        assert('toolbar is the Notepad++ 26px strip', geometry && Math.abs(geometry.toolbarHeight - 26) <= 1,
            JSON.stringify(geometry));
        assert('toolbar sits above the editor area',
            geometry && geometry.editorTop !== null && geometry.toolbarTop < geometry.editorTop,
            JSON.stringify(geometry));

        // --- structure and a11y wiring ----------------------------------
        await waitFor(page, TOOLBAR, 5000, 'role=toolbar container');
        const ariaLabel = await page.$eval(TOOLBAR, el => el.getAttribute('aria-label'));
        assert('toolbar container is a labelled role=toolbar', !!ariaLabel, String(ariaLabel));

        const buttons = await toolbarButtons(page);
        assert('toolbar renders the Notepad++ button set', buttons.length >= 20, 'count=' + buttons.length);
        assert('every button carries a command id', buttons.every(b => !!b.commandId),
            JSON.stringify(buttons.filter(b => !b.commandId)));
        assert('every button has an accessible name', buttons.every(b => !!b.label),
            JSON.stringify(buttons.filter(b => !b.label)));

        const svgHidden = await page.$$eval('.notepadia-toolbar-icon',
            els => els.every(e => e.getAttribute('aria-hidden') === 'true'));
        assert('icons are hidden from assistive tech', svgHidden);

        // Exactly one tab stop is what makes a toolbar one stop in the tab order.
        const tabStops = buttons.filter(b => b.tabIndex === 0);
        assert('toolbar exposes a single tab stop', tabStops.length === 1, 'stops=' + tabStops.length);

        // Non-toggle buttons must not claim a pressed state.
        const strayPressed = buttons.filter(b =>
            b.pressed !== null && !['word-wrap', 'whitespace', 'document-map', 'folder-as-workspace', 'macro-record'].includes(b.id));
        assert('aria-pressed only on real toggles', strayPressed.length === 0, JSON.stringify(strayPressed));

        // --- tooltips carry the keybinding ------------------------------
        const save = await buttonById(page, 'save');
        assert('save tooltip shows its shortcut', !!save && /Ctrl\+S/i.test(save.title || ''), JSON.stringify(save));

        // --- enabled state tracks the editor ----------------------------
        const beforeOpen = await buttonById(page, 'find-next');
        assert('editor commands start disabled with no editor', !!beforeOpen && beforeOpen.disabled,
            JSON.stringify(beforeOpen));

        await openFile(page, 'sample.txt');
        await sleep(1200);
        const afterOpen = await buttonById(page, 'find-next');
        assert('editor commands enable once a file is open', !!afterOpen && !afterOpen.disabled,
            JSON.stringify(afterOpen));

        // --- a button runs the same command as its menu entry -----------
        await page.click('.monaco-editor');
        await sleep(300);
        const before = await editorLines(page);
        await clickToolbar(page, 'undo');
        await sleep(400);
        // Undo on a pristine file is a no-op; the real check is that clicking
        // did not raise, and that a mutating command round-trips.
        await clickMenuItem(page, 'Edit', 'Duplicate Current Line');
        await sleep(700);
        const duplicated = await editorLines(page);
        assert('menu command changed the document', duplicated.length > before.length,
            JSON.stringify({ before: before.length, duplicated: duplicated.length }));

        await clickToolbar(page, 'undo');
        await sleep(700);
        const undone = await editorLines(page);
        assert('toolbar Undo reverses the menu command', undone.length === before.length,
            JSON.stringify({ before: before.length, undone: undone.length }));

        // --- toggled state round-trips ----------------------------------
        // Word wrap cycles 'off' -> 'on' -> 'wordWrapColumn' -> 'bounded',
        // and a previous session (or the user's settings file) may have left
        // it anywhere in that cycle. Normalise to 'off' first so the assertion
        // below observes a real false -> true transition.
        for (let i = 0; i < 4; i++) {
            const current = await buttonById(page, 'word-wrap');
            if (current && current.pressed !== 'false') {
                await clickToolbar(page, 'word-wrap');
            } else {
                break;
            }
        }
        const wrapBefore = await buttonById(page, 'word-wrap');
        await clickToolbar(page, 'word-wrap');
        await sleep(700);
        const wrapAfter = await buttonById(page, 'word-wrap');
        assert('word wrap button reports a toggled state',
            !!wrapBefore && !!wrapAfter && wrapBefore.pressed === 'false' && wrapAfter.pressed === 'true',
            JSON.stringify({ before: wrapBefore, after: wrapAfter }));
        await clickToolbar(page, 'word-wrap');
        await sleep(500);

        // --- keyboard reachability --------------------------------------
        await page.evaluate(() => {
            const first = document.querySelector('.notepadia-toolbar-button');
            if (first) first.focus();
        });
        await sleep(300);
        const firstFocused = await focusedToolbarId(page);
        assert('a toolbar button can take focus', !!firstFocused, String(firstFocused));

        await page.keyboard.press('ArrowRight');
        await sleep(300);
        const afterRight = await focusedToolbarId(page);
        assert('ArrowRight moves along the toolbar', afterRight && afterRight !== firstFocused,
            JSON.stringify({ firstFocused, afterRight }));

        await page.keyboard.press('ArrowLeft');
        await sleep(300);
        const afterLeft = await focusedToolbarId(page);
        assert('ArrowLeft moves back', afterLeft === firstFocused, JSON.stringify({ firstFocused, afterLeft }));

        await page.keyboard.press('End');
        await sleep(300);
        const atEnd = await focusedToolbarId(page);
        await page.keyboard.press('Home');
        await sleep(300);
        const atHome = await focusedToolbarId(page);
        assert('End jumps to the last button', atEnd && atEnd !== firstFocused, String(atEnd));
        assert('Home jumps to the first button', atHome === firstFocused, String(atHome));

        // Disabled buttons stay reachable: aria-disabled, not the disabled
        // attribute, so keyboard users can still discover them.
        const nativeDisabled = await page.$$eval('.notepadia-toolbar-button', els => els.filter(e => e.disabled).length);
        assert('no button is removed from the tab ring by `disabled`', nativeDisabled === 0, 'count=' + nativeDisabled);

        // --- Enter/Space activate ---------------------------------------
        await page.evaluate(() => {
            const zoom = document.querySelector('[data-toolbar-id="zoom-in"]');
            if (zoom) zoom.focus();
        });
        await sleep(200);
        const fontBefore = await page.evaluate(() => {
            const el = document.querySelector('.monaco-editor .view-lines .view-line');
            return el ? getComputedStyle(el).fontSize : null;
        });
        await page.keyboard.press('Enter');
        await sleep(900);
        const fontAfter = await page.evaluate(() => {
            const el = document.querySelector('.monaco-editor .view-lines .view-line');
            return el ? getComputedStyle(el).fontSize : null;
        });
        assert('Enter activates the focused button', fontBefore !== fontAfter,
            JSON.stringify({ fontBefore, fontAfter }));
        await clickToolbar(page, 'zoom-reset');

        // --- View > Toolbar persists across reload ----------------------
        await closeMenus(page);
        await clickMenuItem(page, 'View', 'Toolbar');
        await sleep(1200);
        assert('View > Toolbar hides the toolbar', !(await toolbarVisible(page)));

        await page.reload({ waitUntil: 'networkidle2' });
        await waitFor(page, '#theia-app-shell', 60000);
        await sleep(4000);
        assert('toolbar stays hidden after reload', !(await toolbarVisible(page)));

        await clickMenuItem(page, 'View', 'Toolbar');
        await sleep(1200);
        assert('View > Toolbar brings it back', await toolbarVisible(page));

        await page.reload({ waitUntil: 'networkidle2' });
        await waitFor(page, '#theia-app-shell', 60000);
        await sleep(4000);
        assert('toolbar stays visible after reload', await toolbarVisible(page));

        // --- narrow viewport --------------------------------------------
        await page.setViewport({ width: 800, height: 700 });
        await sleep(1200);
        const narrow = await page.evaluate(() => {
            const tb = document.querySelector('.notepadia-toolbar');
            const container = document.querySelector('.notepadia-toolbar [role="toolbar"]');
            if (!tb || !container) return null;
            return {
                height: tb.getBoundingClientRect().height,
                bodyOverflows: document.body.scrollWidth > document.body.clientWidth + 1,
                scrollable: container.scrollWidth > container.clientWidth
            };
        });
        assert('toolbar keeps its height at 800px wide', narrow && Math.abs(narrow.height - 26) <= 1,
            JSON.stringify(narrow));
        assert('toolbar does not push the page sideways at 800px', narrow && !narrow.bodyOverflows,
            JSON.stringify(narrow));

        assert('no console errors during the toolbar suite', errors.length === 0, errors.slice(0, 5).join(' | '));
    } catch (e) {
        assert('toolbar suite ran to completion', false, e.message);
    }
    await finish(browser);
}

main();
