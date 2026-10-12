// Shared helpers for driving the Notepad++ tabbed Find dialog (B2) from the
// e2e suites. The dialog is a floating, modeless ReactWidget appended to
// <body>; the inline Monaco find widget must never surface while it is active.

const { sleep, waitFor } = require('./lib.js');

const PANEL = '.notepadia-find-panel';
const FIND_INPUT = '#notepadia-find-term';
const INLINE_WIDGET = '.monaco-editor .find-widget';

/**
 * Restores text focus to the editor the way a user does: by clicking the text
 * itself. A JS `.focus()` on the editor node is not enough once the dialog has
 * held focus - Monaco keeps its textarea unfocused, so keyboard commands such
 * as Ctrl+Z are swallowed.
 *
 * The click lands wherever the pointer is, so the caret is then parked with
 * Ctrl+Home to keep the starting position deterministic.
 */
async function focusEditor(page) {
    await page.click('.monaco-editor .view-lines');
    await sleep(250);
    await page.keyboard.down('Control');
    await page.keyboard.press('Home');
    await page.keyboard.up('Control');
    await sleep(300);
}

async function openFindDialog(page) {
    await focusEditor(page);
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyF');
    await page.keyboard.up('Control');
    await waitFor(page, PANEL, 10000, 'find dialog');
    await sleep(500);
}

/** The Monaco inline find widget must never surface while the dialog owns find. */
async function assertNoInlineWidget(page) {
    const visible = await page.evaluate(sel => {
        return Array.from(document.querySelectorAll(sel)).some(el => {
            const cs = getComputedStyle(el);
            return cs.display !== 'none' && cs.visibility !== 'hidden';
        });
    }, '.monaco-editor .find-widget');
    if (visible) throw new Error('Monaco inline find widget is visible despite the B2 override');
}

async function setFindText(page, text) {
    await page.click(FIND_INPUT);
    await sleep(150);
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await sleep(150);
    await page.keyboard.type(text, { delay: 25 });
    await sleep(400);
}

async function setReplaceText(page, text) {
    await page.click('#notepadia-find-replace');
    await sleep(150);
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await sleep(150);
    await page.keyboard.type(text, { delay: 25 });
    await sleep(400);
}

async function clickDialogTab(page, label) {
    const clicked = await page.evaluate(t => {
        const tab = Array.from(document.querySelectorAll('.notepadia-find-tab'))
            .find(el => (el.textContent || '').trim() === t);
        if (!tab) return false;
        tab.click();
        return true;
    }, label);
    if (!clicked) throw new Error('dialog tab not found: ' + label);
    await sleep(400);
}

async function clickDialogButton(page, label) {
    const clicked = await page.evaluate(t => {
        const btn = Array.from(document.querySelectorAll('.notepadia-find-buttons button'))
            .find(el => (el.textContent || '').trim() === t);
        if (!btn) return false;
        btn.click();
        return true;
    }, label);
    if (!clicked) throw new Error('dialog button not found: ' + label);
    await sleep(700);
}

async function setCheck(page, label, checked) {
    const ok = await page.evaluate(([lbl, want]) => {
        const lab = Array.from(document.querySelectorAll('.notepadia-find-check'))
            .find(el => (el.textContent || '').trim() === lbl);
        if (!lab) return false;
        const input = lab.querySelector('input');
        if (input && input.checked !== want) input.click();
        return true;
    }, [label, checked]);
    if (!ok) throw new Error('find option checkbox not found: ' + label);
    await sleep(250);
}

async function setMode(page, value) {
    const clicked = await page.evaluate(v => {
        const input = Array.from(document.querySelectorAll('input[name="notepadia-find-mode"]'))
            .find(el => el.value === v);
        if (!input) return false;
        if (!input.checked) input.click();
        return true;
    }, value);
    if (!clicked) throw new Error('search mode radio not found: ' + value);
    await sleep(300);
}

async function setStyleRadio(page, value) {
    const clicked = await page.evaluate(v => {
        const input = Array.from(document.querySelectorAll('input[name="notepadia-find-mark-style"]'))
            .find(el => el.value === String(v));
        if (!input) return false;
        if (!input.checked) input.click();
        return true;
    }, value);
    if (!clicked) throw new Error('mark style radio not found: ' + value);
    await sleep(250);
}

async function dialogStatus(page) {
    return page.evaluate(() =>
        (document.querySelector('.notepadia-find-status')?.textContent || '').trim());
}

async function closeDialog(page, focusEditorAfter = true) {
    await page.keyboard.press('Escape');
    await sleep(400);
    if (focusEditorAfter) {
        await focusEditor(page);
    }
}

/**
 * The find dialog tabs the ARIA tabs pattern says must be keyboard-reachable:
 * which tab is selected, which element holds DOM focus, and each tab's
 * accessible name. Used to guard the Left/Right/Home/End navigation that is the
 * only way to open a non-selected tab without a mouse.
 */
async function dialogTabState(page) {
    return page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('.notepadia-find-tab'));
        const focused = document.activeElement;
        return {
            selected: tabs.filter(el => el.getAttribute('aria-selected') === 'true')
                .map(el => (el.textContent || '').trim()),
            focused: focused instanceof HTMLElement ? focused.id : '',
            focusedRole: focused instanceof HTMLElement ? (focused.getAttribute('role') || '') : '',
            tabs: tabs.map(el => ({
                label: (el.textContent || '').trim(),
                role: el.getAttribute('role'),
                selected: el.getAttribute('aria-selected') === 'true',
                tabindex: el.getAttribute('tabindex')
            }))
        };
    });
}

async function markCount(page) {
    return page.evaluate(() =>
        Array.from(document.querySelectorAll('.monaco-editor'))
            .reduce((n, w) => n + w.querySelectorAll('.notepadia-mark-0, .notepadia-mark-1, .notepadia-mark-2, .notepadia-mark-3, .notepadia-mark-4').length, 0));
}

/** Count marks carrying one specific style slot (e.g. `.notepadia-mark-1`). */
async function markCountStyle(page, slot) {
    return page.evaluate(s => {
        const sel = `.monaco-editor .notepadia-mark-${s}`;
        return Array.from(document.querySelectorAll('.monaco-editor'))
            .reduce((n, w) => n + w.querySelectorAll(sel).length, 0);
    }, slot);
}

module.exports = {
    PANEL, FIND_INPUT, INLINE_WIDGET,
    focusEditor, openFindDialog, assertNoInlineWidget,
    setFindText, setReplaceText,
    clickDialogTab, clickDialogButton, setCheck, setMode, setStyleRadio,
    dialogStatus, dialogTabState, closeDialog, markCount, markCountStyle
};