// C3 - `View > Fold All` / `Unfold All` / `Fold Level N` and their Alt chords.
//
// A fold is asserted by the editor actually hiding lines, not by the command
// firing: Monaco shows `.codicon-folding-collapsed` in the gutter for a folded
// region and drops the hidden lines out of the `.view-line` list. foldable.txt
// is ten lines with three nested levels, so Fold All, Fold Level and Unfold All
// all have something to act on.
const { assert, finish, sleep, launchPage, goto, openFile,
    clickMenuItem, openMenuBar, hoverByLabel, clickByLabel, closeMenus, modelText } = require('./lib.js');

function foldState(page) {
    return page.evaluate(() => {
        const ed = Array.from(document.querySelectorAll('.monaco-editor'))
            .find(e => e.getBoundingClientRect().width > 0);
        if (!ed) return null;
        return {
            viewLines: ed.querySelectorAll('.view-line').length,
            collapsed: ed.querySelectorAll('.codicon-folding-collapsed').length,
            expanded: ed.querySelectorAll('.codicon-folding-expanded').length,
            text: Array.from(ed.querySelectorAll('.view-line')).map(l => l.textContent).join('\n')
        };
    });
}

const UNFOLDED_LINES = 10;

async function unfoldAll(page) {
    await clickMenuItem(page, 'View', 'Unfold All');
    await sleep(700);
}

async function focusEditor(page) {
    await page.evaluate(() => {
        const ed = Array.from(document.querySelectorAll('.monaco-editor'))
            .find(e => e.getBoundingClientRect().width > 0);
        if (ed) {
            const src = ed.querySelector('textarea, .inputarea');
            if (src) src.focus();
        }
    });
    await sleep(300);
}

(async () => {
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await goto(page);
    await openFile(page, 'foldable.txt');

    const start = await foldState(page);
    assert('fixture starts unfolded with every line visible',
        start.viewLines === UNFOLDED_LINES && start.collapsed === 0,
        JSON.stringify(start));

    await clickMenuItem(page, 'View', 'Fold All');
    const folded = await foldState(page);
    assert('Fold All marks a collapsed region', folded.collapsed > 0,
        'collapsed=' + folded.collapsed);
    assert('Fold All hides lines', folded.viewLines < UNFOLDED_LINES,
        `viewLines=${folded.viewLines}`);

    await unfoldAll(page);
    const unfolded = await foldState(page);
    assert('Unfold All restores every line',
        unfolded.viewLines === UNFOLDED_LINES && unfolded.collapsed === 0,
        JSON.stringify(unfolded));

    // Fold Level 2 folds from the second nesting level, which leaves more of
    // the document on screen than Fold All did.
    await openMenuBar(page, 'View');
    await hoverByLabel(page, 'Fold Level');
    await sleep(700);
    await clickByLabel(page, 'Fold Level 2');
    await closeMenus(page);
    await sleep(700);
    const level2 = await foldState(page);
    assert('Fold Level 2 folds a region', level2.collapsed > 0, 'collapsed=' + level2.collapsed);
    assert('Fold Level 2 hides some lines', level2.viewLines < UNFOLDED_LINES,
        `viewLines=${level2.viewLines}`);

    await unfoldAll(page);

    // The Notepad++ chords: Alt+0 folds everything, Alt+Shift+0 unfolds it.
    await focusEditor(page);
    await page.keyboard.down('Alt');
    await page.keyboard.press('Digit0');
    await page.keyboard.up('Alt');
    await sleep(900);
    const afterAlt0 = await foldState(page);
    assert('Alt+0 folds everything', afterAlt0.collapsed > 0 && afterAlt0.viewLines < UNFOLDED_LINES,
        JSON.stringify(afterAlt0));

    await page.keyboard.down('Alt');
    await page.keyboard.down('Shift');
    await page.keyboard.press('Digit0');
    await page.keyboard.up('Shift');
    await page.keyboard.up('Alt');
    await sleep(900);
    const afterAltShift0 = await foldState(page);
    assert('Alt+Shift+0 unfolds everything',
        afterAltShift0.collapsed === 0 && afterAltShift0.viewLines === UNFOLDED_LINES,
        JSON.stringify(afterAltShift0));

    // Folding is a view of the document, never an edit of it. Monaco renders
    // view lines with non-breaking spaces, so normalise before matching.
    const text = (await modelText(page)).replace(/\u00a0/g, ' ');
    const hasOuter = text.includes('function outer');
    const hasInner = text.includes('function inner');
    assert('folding leaves the document text intact', hasOuter && hasInner,
        `outer=${hasOuter} inner=${hasInner} text=${JSON.stringify(text.slice(0, 120))}`);

    assert('no page errors', errors.length === 0, JSON.stringify(errors));
    await finish(browser);
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });