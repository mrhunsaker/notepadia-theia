// B4 - Notepad++'s Incremental Search bar.
//
// Covers the Ctrl+Alt+I bar: it opens docked at the bottom of the editor area
// with focus in its field, typing jumps live to the next occurrence of the
// whole term (wrapping), a no-match term turns the field red and announces it
// through the polite live region, Enter / Shift+Enter step by one occurrence,
// Escape closes the bar and restores the pre-search caret when nothing was
// accepted (and keeps the jump when it was), and the Match case / Highlight
// all options behave and clean up after themselves.
const { assert, finish, sleep, launchPage, goto, openFile, waitFor,
    currentLine, clickEditorLine, openMenuBar, subLabels, closeMenus } = require('./lib.js');

/**
 * The text covered by the editor's selection, read from geometry: Monaco draws
 * the selection as an overlaid rectangle (`.selected-text`) and never puts the
 * text inside it, so the character range is derived from its position within
 * the containing `.view-line` and sliced out of the line's own text.
 */
/**
 * The text covered by the editor's selection, read from geometry and sliced to
 * `len` characters. Monaco draws the selection as an overlaid rectangle
 * (`.selected-text`) and never puts the text inside it, so the start column is
 * derived from its position within the containing `.view-line`; the caller
 * supplies the expected length rather than trusting pixel rounding.
 */
async function selectedText(page, len) {
    return page.evaluate((n) => {
        const sel = document.querySelector('.monaco-editor .selected-text');
        const lines = Array.from(document.querySelectorAll('.monaco-editor .view-lines .view-line'));
        if (!sel || !lines.length) {
            return '';
        }
        const sr = sel.getBoundingClientRect();
        const line = lines.find(l => {
            const r = l.getBoundingClientRect();
            return r.top <= sr.top && sr.bottom <= r.bottom;
        });
        if (!line) {
            return '';
        }
        // Monaco is monospace here, so a probe span in the character spans'
        // font gives a reliable advance for the start column.
        const probe = document.createElement('span');
        probe.textContent = 'mmmmmmmmmm';
        probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:' +
            getComputedStyle(line.querySelector('span') || line).font + ';';
        document.body.appendChild(probe);
        const cw = probe.getBoundingClientRect().width / 10;
        probe.remove();
        if (!(cw > 0)) {
            return '';
        }
        const lr = line.getBoundingClientRect();
        const text = line.textContent || '';
        const start = Math.round((sr.left - lr.left) / cw) + 1;
        return text.slice(Math.max(0, start - 1), Math.max(0, start - 1) + n);
    }, len);
}

async function barState(page) {
    return page.evaluate(() => {
        const input = document.querySelector('#notepadia-incremental-term');
        // The class lands on the lumino wrapper as well as the inner React
        // container, so read the nearest ancestor of the field itself - the
        // container that actually carries the `no-match` marker.
        const bar = input ? input.closest('.notepadia-incremental-search') : null;
        const live = document.querySelector('.notepadia-incremental-search-live');
        return {
            present: !!bar && !!input,
            focused: !!input && document.activeElement === input,
            noMatch: !!bar && bar.classList.contains('no-match'),
            live: live ? live.textContent.trim() : '',
            highlightCount: Array.from(document.querySelectorAll('.notepadia-incremental-highlight')).length
        };
    });
}

async function ctrlAltI(page) {
    await page.keyboard.down('Control');
    await page.keyboard.down('Alt');
    await page.keyboard.press('KeyI');
    await page.keyboard.up('Alt');
    await page.keyboard.up('Control');
    await waitFor(page, '#notepadia-incremental-term');
    // The shell reveals the bottom dock asynchronously; typing only lands in
    // the bar once its field has focus, so wait for that rather than racing.
    await page.waitForFunction(() => {
        const input = document.querySelector('#notepadia-incremental-term');
        return input && document.activeElement === input;
    }, { timeout: 15000 }).catch(() => { });
    await sleep(300);
}

async function clickBarCheckbox(page, label) {
    const box = await page.evaluate(text => {
        const option = Array.from(document.querySelectorAll('.notepadia-incremental-search-option'))
            .find(l => (l.textContent || '').trim().includes(text));
        if (!option) {
            return null;
        }
        const r = option.querySelector('input[type="checkbox"]').getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, label);
    if (!box) {
        return false;
    }
    await page.mouse.click(box.x, box.y);
    await sleep(600);
    return true;
}

(async () => {
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await goto(page);
    await openFile(page, 'search.txt');

    // Discoverable from the Search menu as well as the chord.
    await openMenuBar(page, 'Search');
    const items = await subLabels(page);
    assert('Search menu lists Incremental Search', items.includes('Incremental Search'), JSON.stringify(items));
    await closeMenus(page);

    // Live search with wrap: from the last line the term wraps to the first
    // occurrence. The caret is placed before the bar opens, because clicking
    // the editor while the bar is open would steal the bar's focus.
    await clickEditorLine(page, 3);
    await page.keyboard.press('Home');
    await sleep(300);
    assert('caret sits on line 4 before searching', await currentLine(page) === 4, 'line=' + await currentLine(page));

    // Ctrl+Alt+I opens the bar docked at the bottom of the editor, focused.
    await ctrlAltI(page);
    let state = await barState(page);
    assert('Ctrl+Alt+I opens the incremental search bar', state.present, JSON.stringify(state));
    assert('the bar focuses its term field on open', state.focused, JSON.stringify(state));

    await page.keyboard.type('foo');
    await sleep(700);
    state = await barState(page);
    assert('typing jumps live to the match, wrapping to line 1', await currentLine(page) === 1,
        'line=' + await currentLine(page));
    assert('the live jump selects the match text', (await selectedText(page, 3)) === 'foo',
        'sel=' + JSON.stringify(await selectedText(page, 3)));
    assert('the bar reports the full occurrence count', state.live === '4 matches', JSON.stringify(state));

    await page.keyboard.press('Escape');
    await sleep(800);
    assert('Escape closes the bar', !(await page.evaluate(() => !!document.querySelector('#notepadia-incremental-term'))));
    assert('Escape with nothing accepted restores the caret (line 4)',
        await currentLine(page) === 4, 'line=' + await currentLine(page));

    // Enter / Shift+Enter step by one occurrence; once a match is accepted,
    // Escape keeps the jump instead of restoring the anchor.
    await ctrlAltI(page);
    await page.keyboard.type('foo');
    await sleep(700);
    assert('first occurrence is line 1', await currentLine(page) === 1, 'line=' + await currentLine(page));
    await page.keyboard.press('Enter');
    await sleep(500);
    assert('Enter steps to the next occurrence (line 1 second foo)', await currentLine(page) === 1,
        'line=' + await currentLine(page));
    await page.keyboard.press('Enter');
    await sleep(500);
    assert('Enter steps to the line-2 occurrence', await currentLine(page) === 2, 'line=' + await currentLine(page));
    await page.keyboard.down('Shift');
    await page.keyboard.press('Enter');
    await page.keyboard.up('Shift');
    await sleep(500);
    assert('Shift+Enter steps back to the previous occurrence', await currentLine(page) === 1,
        'line=' + await currentLine(page));
    await page.keyboard.press('Escape');
    await sleep(800);
    assert('Escape after an accepted step keeps the jump', await currentLine(page) === 1,
        'line=' + await currentLine(page));
    assert('step-cleared bar has no live region', (await barState(page)).present === false);

    // Highlight all colors every occurrence and cleans up on close.
    await ctrlAltI(page);
    await page.keyboard.type('foo');
    await sleep(700);
    await clickBarCheckbox(page, 'Highlight all');
    state = await barState(page);
    assert('Highlight all colors all four occurrences', state.highlightCount === 4,
        'count=' + state.highlightCount);
    await clickBarCheckbox(page, 'Highlight all');
    state = await barState(page);
    assert('unchecking Highlight all removes the decorations', state.highlightCount === 0,
        'count=' + state.highlightCount);
    await page.keyboard.press('Escape');
    await sleep(800);
    state = await barState(page);
    assert('closing the bar leaves no decorations behind', state.highlightCount === 0,
        'count=' + state.highlightCount);
    assert('closing the bar removes it from the shell', state.present === false, JSON.stringify(state));

    // Match case: lowercase-only fixture counts four with case off and "no
    // match" with it on, which is signalled by the red field and the status.
    await ctrlAltI(page);
    await page.keyboard.type('Foo');
    await sleep(700);
    state = await barState(page);
    assert('Match case off matches four (case-insensitive)', state.live === '4 matches', JSON.stringify(state));
    assert('Match case off keeps the field normal', state.noMatch === false, JSON.stringify(state));
    await clickBarCheckbox(page, 'Match case');
    state = await barState(page);
    assert('Match case on reports no match', state.noMatch === true && state.live === 'no match', JSON.stringify(state));
    await page.keyboard.press('Escape');
    await sleep(800);
    state = await barState(page);
    assert('Escape removes the bar after the match-case session', state.present === false, JSON.stringify(state));

    assert('no page errors', errors.length === 0, JSON.stringify(errors));
    await finish(browser);
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });