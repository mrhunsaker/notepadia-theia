// C3 - split view and synchronised scrolling.
//
// `Clone to Other View` has to produce a second pane, `Move to Other View` has
// to leave exactly one, and the two synchronise toggles have to make scrolling
// one pane move the other - and stop doing so when switched off. long.txt is
// tall enough to scroll vertically; split.txt is one very wide line, which is
// what horizontal scrolling needs.
const { assert, finish, sleep, launchPage, goto, openFile,
    clickMenuItem, openMenuBar, hoverByLabel, clickByLabel, closeMenus } = require('./lib.js');

/** The visible editor panes, in DOM order. */
const VISIBLE_PANES = `Array.from(document.querySelectorAll('.monaco-editor')).filter(e => e.getBoundingClientRect().width > 0)`;

function paneCount(page) {
    return page.evaluate(`(() => ${VISIBLE_PANES}.length)()`);
}

/** The first visible line of each pane; a vertical scroll changes these. */
function firstLines(page) {
    return page.evaluate(`(() => ${VISIBLE_PANES}.map(e => { const l = e.querySelector('.view-line'); return l ? l.textContent.replace(/\\u00a0/g, ' ') : ''; }))()`);
}

/** Each pane's horizontal scrollbar thumb position, in pixels. */
function horizontalThumbs(page) {
    return page.evaluate(`(() => ${VISIBLE_PANES}.map(e => { const s = e.querySelector('.monaco-scrollable-element.editor-scrollable .scrollbar.horizontal .slider'); return s ? parseFloat(s.style.left || '0') : -1; }))()`);
}

/** Scroll a pane horizontally with a trackpad-style wheel gesture. */
async function wheelHorizontallyOverPane(page, paneIndex, deltaX) {
    const box = await page.evaluate(i => {
        const panes = Array.from(document.querySelectorAll('.monaco-editor')).filter(e => e.getBoundingClientRect().width > 0);
        const e = panes[i];
        if (!e) return null;
        const b = e.getBoundingClientRect();
        return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    }, paneIndex);
    if (!box) return false;
    await wheelAt(page, box.x, box.y, { deltaX });
    return true;
}

/**
 * Monaco replaces a pane's DOM while a split is settling, and a wheel event
 * aimed at the old node fails with a detached frame. The gesture is about the
 * position, not the node, so it is simply aimed again.
 */
async function wheelAt(page, x, y, options) {
    for (let attempt = 0; ; attempt++) {
        try {
            await page.mouse.move(x, y);
            await page.mouse.wheel(options);
            await sleep(1200);
            return;
        } catch (error) {
            if (attempt >= 2 || !/detached Frame|Execution context/i.test(String(error && error.message))) {
                throw error;
            }
            await sleep(800);
        }
    }
}

async function wheelOverPane(page, paneIndex, deltaY) {
    const box = await page.evaluate(i => {
        const panes = Array.from(document.querySelectorAll('.monaco-editor')).filter(e => e.getBoundingClientRect().width > 0);
        const e = panes[i];
        if (!e) return null;
        const b = e.getBoundingClientRect();
        return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    }, paneIndex);
    if (!box) return false;
    await wheelAt(page, box.x, box.y, { deltaY });
    return true;
}

/** Bookmark glyphs in each visible pane (a split pair shares one model). */
function bookmarkGlyphs(page) {
    return page.evaluate(`(() => ${VISIBLE_PANES}.map(e => e.querySelectorAll('.notepadia-bookmark-glyph').length))()`);
}

/** Click a line in a particular pane so its Monaco control owns the caret. */
async function clickPaneLine(page, paneIndex, lineIndex) {
    const box = await page.evaluate(([pane, line]) => {
        const panes = Array.from(document.querySelectorAll('.monaco-editor')).filter(e => e.getBoundingClientRect().width > 0);
        const el = panes[pane];
        const lineEl = el && el.querySelectorAll('.view-lines .view-line')[line];
        if (!lineEl) return null;
        const r = lineEl.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, [paneIndex, lineIndex]);
    if (!box) return false;
    await page.mouse.click(box.x, box.y);
    await sleep(500);
    return true;
}

async function toggleSync(page, label) {
    await openMenuBar(page, 'View');
    await hoverByLabel(page, 'Synchronize Scrolling');
    await sleep(700);
    await clickByLabel(page, label);
    await closeMenus(page);
    await sleep(600);
}

(async () => {
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await goto(page);
    await openFile(page, 'long.txt');
    assert('a single editor is one pane', await paneCount(page) === 1, 'panes=' + await paneCount(page));

    await clickMenuItem(page, 'View', 'Clone to Other View');
    await sleep(1500);
    assert('Clone to Other View opens a second pane', await paneCount(page) === 2,
        'panes=' + await paneCount(page));

    await toggleSync(page, 'Synchronize Vertical Scrolling');
    await wheelOverPane(page, 0, 4000);
    const syncedLines = await firstLines(page);
    assert('vertical sync moves the other pane to the same line',
        syncedLines.length === 2 && syncedLines[0] === syncedLines[1] && syncedLines[0].includes('line '),
        JSON.stringify(syncedLines));
    assert('vertical sync actually scrolled away from the top',
        !syncedLines[0].includes('line 1 of'), syncedLines[0]);

    // Switched off, the second pane must be left where it is.
    await toggleSync(page, 'Synchronize Vertical Scrolling');
    const parkedLine = syncedLines[1];
    await wheelOverPane(page, 0, 4000);
    const afterOff = await firstLines(page);
    assert('with vertical sync off the other pane does not follow',
        afterOff[1] === parkedLine, JSON.stringify({ parkedLine, afterOff }));
    assert('with vertical sync off the scrolled pane still moved',
        afterOff[0] !== syncedLines[0], JSON.stringify({ before: syncedLines[0], after: afterOff[0] }));

    // Back to one pane with Move to Other View.
    await clickMenuItem(page, 'View', 'Move to Other View');
    await sleep(1500);
    assert('Move to Other View leaves a single pane', await paneCount(page) === 1,
        'panes=' + await paneCount(page));

    // Horizontal scrolling, on the single very wide line.
    await openFile(page, 'split.txt');
    await clickMenuItem(page, 'View', 'Clone to Other View');
    await sleep(1500);
    assert('the wide fixture is cloned into two panes', await paneCount(page) === 2,
        'panes=' + await paneCount(page));

    await toggleSync(page, 'Synchronize Horizontal Scrolling');
    await wheelHorizontallyOverPane(page, 0, 1000);
    const thumbsOn = await horizontalThumbs(page);
    assert('horizontal sync moves the other pane',
        thumbsOn.length === 2 && thumbsOn[0] > 0 && Math.abs(thumbsOn[1] - thumbsOn[0]) <= 2,
        JSON.stringify(thumbsOn));

    await toggleSync(page, 'Synchronize Horizontal Scrolling');
    const beforeOff = await horizontalThumbs(page);
    await wheelHorizontallyOverPane(page, 0, 1000);
    const afterOffThumbs = await horizontalThumbs(page);
    assert('with horizontal sync off the other pane stays put',
        afterOffThumbs[1] === beforeOff[1], JSON.stringify({ beforeOff, afterOffThumbs }));

    // Bookmarks are stored per model, but each split pane has its own Monaco
    // control: toggling from either side must paint both, and removing one
    // must clear it in both without leaving stale collections behind. Collapse
    // the horizontal split first so cloning the fixture leaves exactly two.
    await clickMenuItem(page, 'View', 'Move to Other View');
    await sleep(1500);
    assert('the editor is back to one pane before the bookmark check', await paneCount(page) === 1,
        'panes=' + await paneCount(page));
    await openFile(page, 'bookmarks.txt');
    await clickMenuItem(page, 'View', 'Clone to Other View');
    await sleep(1500);
    assert('the bookmark fixture is cloned into two panes', await paneCount(page) === 2,
        'panes=' + await paneCount(page));
    assert('a cloned bookmark fixture starts undecorated',
        (await bookmarkGlyphs(page)).every(n => n === 0), JSON.stringify(await bookmarkGlyphs(page)));

    assert('clicked line 2 in the first pane', await clickPaneLine(page, 0, 1));
    await page.keyboard.down('Control');
    await page.keyboard.press('F2');
    await page.keyboard.up('Control');
    await sleep(600);
    let glyphs = await bookmarkGlyphs(page);
    assert('a bookmark in one split pane is shown in both',
        glyphs.length === 2 && glyphs[0] === 1 && glyphs[1] === 1, JSON.stringify(glyphs));

    assert('clicked line 3 in the second pane', await clickPaneLine(page, 1, 2));
    await page.keyboard.down('Control');
    await page.keyboard.press('F2');
    await page.keyboard.up('Control');
    await sleep(600);
    glyphs = await bookmarkGlyphs(page);
    assert('toggling from the second pane updates both',
        glyphs.length === 2 && glyphs[0] === 2 && glyphs[1] === 2, JSON.stringify(glyphs));

    assert('clicked line 2 in the second pane again', await clickPaneLine(page, 1, 1));
    await page.keyboard.down('Control');
    await page.keyboard.press('F2');
    await page.keyboard.up('Control');
    await sleep(600);
    glyphs = await bookmarkGlyphs(page);
    assert('removing a bookmark from one pane clears it in both',
        glyphs.length === 2 && glyphs[0] === 1 && glyphs[1] === 1, JSON.stringify(glyphs));

    assert('no page errors', errors.length === 0, JSON.stringify(errors));
    await finish(browser);
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });