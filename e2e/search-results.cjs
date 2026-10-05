const fs = require('fs');
const path = require('path');
const { assert, finish, sleep, launchPage, goto, openFile,
    openMenuBar, subLabels, closeMenus, statusBar, clickEditorLine } = require('./lib.js');
const { openFindDialog, setFindText, clickDialogTab, clickDialogButton, closeDialog } = require('./dialog-helpers.cjs');

// search.txt is seeded as:
//   1: foo one foo
//   2: two foo
//   3: foo three
//   4: bar baz
// so 'foo' is four hits, two of them on line 1, which is why the assertions
// below compare columns and not only lines. 'foo' is three characters, and
// Monaco's status bar reports the caret at the end of a selection, so the caret
// sits on the character after the match.
const FOO_HITS = [
    { line: 1, column: 1 },
    { line: 1, column: 9 },
    { line: 2, column: 5 },
    { line: 3, column: 1 }
];
const MATCH_LENGTH = 3;
const caretOn = hit => ({ line: hit.line, column: hit.column + MATCH_LENGTH });

/** Whether the results window is on screen, as opposed to present but hidden. */
async function panelVisible(page) {
    return page.evaluate(() => {
        const host = document.querySelector('.notepadia-search-results-host');
        if (!host) {
            return false;
        }
        const rect = host.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    });
}

/**
 * The widget docked in the shell's bottom area, which is where Notepad++ keeps
 * this window. The `.theia-app-bottom` class is on the area's tab bar, not on
 * an ancestor of the widget, so the content panel is what identifies it.
 */
async function inBottomArea(page) {
    return page.evaluate(() => {
        const host = document.querySelector('.notepadia-search-results-host');
        return !!host && !!host.closest('#theia-bottom-content-panel');
    });
}

/** Clicks one of the three buttons in a search group's header. */
async function groupHeaderButton(page, index, label) {
    const clicked = await page.evaluate((i, text) => {
        const header = Array.from(document.querySelectorAll('[data-notepadia-search-row="group"]'))[i];
        if (!header) return false;
        const button = Array.from(header.querySelectorAll('button'))
            .find(b => (b.textContent || '').trim() === text);
        if (!button) return false;
        button.click();
        return true;
    }, index, label);
    if (!clicked) {
        throw new Error(`group ${index} has no ${label} button`);
    }
}

async function groupLabels(page) {
    return page.$$eval('[data-notepadia-search-row="group"] .notepadia-search-results-label',
        rows => rows.map(row => row.textContent.trim()));
}

async function hitRows(page) {
    return page.$$eval('[data-notepadia-search-row="hit"]', rows => rows.map(row => ({
        text: row.textContent.trim(),
        line: Number(row.dataset.line),
        column: Number(row.dataset.column)
    })));
}

/** The caret's Ln / Col readout from the status bar. */
async function caret(page) {
    const found = /Ln : (\d+),?\s*Col : (\d+)/.exec(await statusBar(page));
    return found ? { line: Number(found[1]), column: Number(found[2]) } : null;
}

/**
 * Runs Find All in Current Document for `term` and waits until the window holds
 * `groups` search groups.
 *
 * The term is always set explicitly: the dialog pre-fills it with the word
 * under the caret, which makes it depend on wherever the previous check left
 * the editor.
 */
async function findAll(page, term, groups) {
    await openFindDialog(page);
    await setFindText(page, term);
    await clickDialogButton(page, 'Find All in Current Document');
    await page.waitForFunction(
        expected => document.querySelectorAll('[data-notepadia-search-row="group"]').length === expected,
        { timeout: 10000 }, groups);
    await closeDialog(page);
}

(async () => {
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await goto(page);
    await openFile(page, 'search.txt');

    // The Search menu carries the window and its navigation, because that is
    // where someone who knows Notepad++ looks for F7 and F4.
    await openMenuBar(page, 'Search');
    const items = await subLabels(page);
    assert('Search menu offers the results window and F4/Shift+F4 navigation',
        ['Search Results Window', 'Next Search Result', 'Previous Search Result']
            .every(label => items.includes(label)),
        JSON.stringify(items));
    await closeMenus(page);

    // Find All fills the window with Notepad++'s exact header format.
    await findAll(page, 'foo', 1);
    const labels = await groupLabels(page);
    assert('group header is Search "foo" (4 hits in 1 file of 1 searched)',
        labels[0] === 'Search "foo" (4 hits in 1 file of 1 searched)',
        JSON.stringify(labels));
    assert('the window is docked in the shell bottom area', await inBottomArea(page));

    // Every hit is a "Line N:" row, in document order, with the match marked.
    const rows = await hitRows(page);
    assert('four hits, one per occurrence', rows.length === 4, JSON.stringify(rows));
    assert('rows carry the line number and the line text',
        rows[0].text.startsWith('Line 1: foo one foo')
        && rows[2].text.startsWith('Line 2: two foo')
        && rows[3].text.startsWith('Line 3: foo three'),
        JSON.stringify(rows.map(row => row.text)));
    assert('every hit points at the right line and column',
        rows.every((row, index) => row.line === FOO_HITS[index].line && row.column === FOO_HITS[index].column),
        JSON.stringify(rows));
    const marked = await page.$$eval('.notepadia-search-results-match', els => els.map(el => el.textContent));
    assert('the matched text is highlighted in each row',
        marked.length === 4 && marked.every(text => text === 'foo'),
        JSON.stringify(marked));

    // Clicking a row opens the file and reveals the line. The third row is the
    // 'two foo' hit on line 2.
    const third = await page.$$('[data-notepadia-search-row="hit"]');
    await third[2].click();
    await sleep(1200);
    assert('clicking the third row puts the caret on its match',
        JSON.stringify(await caret(page)) === JSON.stringify(caretOn(FOO_HITS[2])),
        JSON.stringify(await caret(page)));

    // F7 hides and shows the window without touching the editor.
    await page.keyboard.press('F7');
    await sleep(700);
    assert('F7 hides the results window', !(await panelVisible(page)));
    await page.keyboard.press('F7');
    await sleep(900);
    assert('F7 shows the results window again', await panelVisible(page));

    // F4 and Shift+F4 carry on from the row that was chosen. Two of the four
    // hits share line 1, so the column is what proves they are distinct.
    await page.keyboard.press('F4');
    await sleep(1100);
    assert('F4 carries on to the next hit',
        JSON.stringify(await caret(page)) === JSON.stringify(caretOn(FOO_HITS[3])),
        JSON.stringify(await caret(page)));
    await page.keyboard.press('F4');
    await sleep(1100);
    assert('F4 wraps past the last hit to the first',
        JSON.stringify(await caret(page)) === JSON.stringify(caretOn(FOO_HITS[0])),
        JSON.stringify(await caret(page)));
    await page.keyboard.down('Shift');
    await page.keyboard.press('F4');
    await page.keyboard.up('Shift');
    await sleep(1100);
    assert('Shift+F4 steps back',
        JSON.stringify(await caret(page)) === JSON.stringify(caretOn(FOO_HITS[3])),
        JSON.stringify(await caret(page)));
    await page.keyboard.press('F4');
    await sleep(1100);
    await page.keyboard.press('F4');
    await sleep(1100);
    assert('F4 reaches the hit after the last one it stepped from',
        JSON.stringify(await caret(page)) === JSON.stringify(caretOn(FOO_HITS[1])),
        JSON.stringify(await caret(page)));

    // A second search appends a group rather than replacing the first, which is
    // what Notepad++ does: the window is a stack of searches.
    await findAll(page, 'bar', 2);
    const stacked = await groupLabels(page);
    assert('a second search adds a group and keeps the first',
        stacked.length === 2
        && stacked[0] === 'Search "foo" (4 hits in 1 file of 1 searched)'
        && stacked[1] === 'Search "bar" (1 hit in 1 file of 1 searched)',
        JSON.stringify(stacked));
    assert('the second group brings its own hit', (await hitRows(page)).length === 5,
        JSON.stringify(await hitRows(page)));

    // Groups collapse, and a collapsed group takes its file and rows with it.
    const groupRows = await page.$$('[data-notepadia-search-row="group"]');
    await groupRows[0].click();
    await sleep(600);
    assert('a collapsed group hides its rows', (await hitRows(page)).length === 1,
        JSON.stringify(await hitRows(page)));
    assert('the collapsed group reports aria-expanded=false',
        await page.$eval('[data-notepadia-search-row="group"]',
            row => row.getAttribute('aria-expanded') === 'false'));
    await groupRows[0].click();
    await sleep(600);
    assert('expanding it brings the rows back', (await hitRows(page)).length === 5);

    // The buttons in a group header belong to that group: the toolbar's are
    // the window-wide ones.
    await groupHeaderButton(page, 0, 'Collapse All');
    await sleep(600);
    assert('a group header collapses its own group only', (await hitRows(page)).length === 1,
        JSON.stringify(await hitRows(page)));
    await groupHeaderButton(page, 1, 'Collapse All');
    await sleep(600);
    assert('collapsing the second group leaves nothing expanded twice over',
        (await groupLabels(page)).length === 2
        && await page.$$eval('[data-notepadia-search-row="group"]',
            rows => rows.every(row => row.getAttribute('aria-expanded') === 'false')),
        JSON.stringify(await groupLabels(page)));
    await groupHeaderButton(page, 0, 'Expand All');
    await sleep(600);
    assert('expanding one group leaves the other collapsed', (await hitRows(page)).length === 4
        && await page.$$eval('[data-notepadia-search-row="group"]',
            rows => rows.map(row => row.getAttribute('aria-expanded'))[1] === 'false'),
        JSON.stringify(await hitRows(page)));
    await groupHeaderButton(page, 1, 'Expand All');
    await sleep(600);
    assert('expanding the other group brings its row back', (await hitRows(page)).length === 5);

    // The window is a tree, so it is walkable and operable from the keyboard
    // alone: arrows move between rows and Enter reveals the one the cursor is
    // on. The row ids carry their own level, which is what the walk asserts.
    await page.focus('.notepadia-search-results-tree');
    await page.keyboard.press('Home');
    await sleep(300);
    await page.keyboard.press('ArrowDown');
    await sleep(300);
    await page.keyboard.press('ArrowDown');
    await sleep(300);
    assert('arrow keys move the tree cursor from the group to its first hit',
        /^g\d+::/.test(await page.$eval('.notepadia-search-results-tree',
            tree => tree.getAttribute('aria-activedescendant') || '')),
        await page.$eval('.notepadia-search-results-tree',
            tree => tree.getAttribute('aria-activedescendant')));
    assert('the tree is a tree with a name',
        await page.$eval('.notepadia-search-results-tree',
            tree => tree.getAttribute('role') === 'tree' && !!tree.getAttribute('aria-label')));
    await page.keyboard.press('Enter');
    await sleep(1200);
    assert('Enter on the focused row reveals its hit',
        JSON.stringify(await caret(page)) === JSON.stringify(caretOn(FOO_HITS[0])),
        JSON.stringify(await caret(page)));

    // A double click hands focus to the editor, where typing would go.
    const firstRow = await page.$$('[data-notepadia-search-row="hit"]');
    await firstRow[3].click({ clickCount: 2 });
    await sleep(1200);
    assert('double-clicking a row focuses the editor',
        await page.evaluate(() => {
            const active = document.activeElement;
            return !!active && (active.classList.contains('inputarea') || active.tagName === 'TEXTAREA');
        }),
        await page.evaluate(() => document.activeElement && document.activeElement.className));

    // Clear All empties the window.
    await page.click('.notepadia-search-results-toolbar button.theia-button:last-child');
    await sleep(600);
    assert('Clear All empties the window', (await groupLabels(page)).length === 0,
        JSON.stringify(await groupLabels(page)));

    // With no row chosen, stepping starts from the caret rather than the top of
    // the list: the caret sits on line 4, past every hit, so F4 wraps to the
    // first one.
    await findAll(page, 'foo', 1);
    await clickEditorLine(page, 3);
    await sleep(500);
    await page.keyboard.press('F4');
    await sleep(1100);
    assert('F4 steps from the caret, wrapping to the first hit',
        JSON.stringify(await caret(page)) === JSON.stringify(caretOn(FOO_HITS[0])),
        JSON.stringify(await caret(page)));

    // Find in Files writes into the same window. 'three' is a word several
    // seeded files have, so the assertion is about the shape and the counts
    // agreeing rather than about how many files the fixture happens to contain.
    await openFindDialog(page);
    await clickDialogTab(page, 'Find in Files');
    await setFindText(page, 'three');
    await clickDialogButton(page, 'Find All');
    await page.waitForFunction(
        () => Array.from(document.querySelectorAll('[data-notepadia-search-row="group"] .notepadia-search-results-label'))
            .some(label => label.textContent.includes('Search "three"')),
        { timeout: 30000 });
    await closeDialog(page);
    const fromFiles = await groupLabels(page);
    assert('Find in Files appends its own group and keeps the document search',
        fromFiles.length === 2
        && fromFiles[0] === 'Search "foo" (4 hits in 1 file of 1 searched)'
        && /^Search "three" \(\d+ hits? in \d+ files?\)$/.test(fromFiles[1]),
        JSON.stringify(fromFiles));
    // The workspace header has no "of N searched" tail: the search backend
    // never reports how many files it looked at, and printing a number that is
    // not known would be worse than leaving it out.
    assert('a workspace group omits the file count it cannot know',
        !fromFiles[1].includes('searched'), fromFiles[1]);
    const fileHits = await page.$$eval('[data-notepadia-search-row="group"]',
        groups => groups.map(group => Array.from(group.parentElement
            .querySelectorAll('[data-notepadia-search-row="hit"]'))
            .map(row => row.textContent.trim())));
    const declared = /(\d+) hits? in/.exec(fromFiles[1]);
    assert('the workspace header counts exactly the rows under its own group',
        declared && fileHits.length === 2
        && fileHits[1].length === Number(declared[1])
        && fileHits[1].every(text => /^Line \d+: /.test(text)),
        JSON.stringify({ label: fromFiles[1], rows: fileHits }));
    assert('a hit in search.txt is one of those rows',
        fileHits[1].some(text => text.startsWith('Line 3: foo three')),
        JSON.stringify(fileHits[1]));

    assert('no page errors during the search results pass', errors.length === 0, JSON.stringify(errors));
    await finish(browser, page);
})().catch(error => {
    // finish() exits 0 when nothing failed, so a thrown error would look like a
    // pass to the harness. Record it where the runner cannot swallow it.
    fs.writeFileSync(path.join(require('os').tmpdir(), 'notepadia-search-results-error.log'),
        String(error && error.stack || error));
    finish(null, null, error);
});