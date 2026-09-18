const { assert, finish, sleep, launchPage, goto, openFile, waitFor,
    openMenuBar, hoverByLabel, clickByLabel, subLabels, closeMenus } = require('./lib.js');

const FIND_INPUT = '.monaco-editor .find-widget textarea[aria-label="Find"]';

async function focusEditor(page) {
    await page.evaluate(() => {
        const el = document.querySelector('.monaco-editor');
        el && el.focus();
    });
    await sleep(300);
}

async function setSearchTerm(page, text) {
    await focusEditor(page);
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyF');
    await page.keyboard.up('Control');
    await waitFor(page, FIND_INPUT, 10000, 'find input');
    await sleep(500);
    await page.click(FIND_INPUT);
    await sleep(200);
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await sleep(200);
    await page.keyboard.type(text, { delay: 40 });
    await sleep(700);
}

async function runMarkOp(page, label, escape = true) {
    await openMenuBar(page, 'Search');
    await hoverByLabel(page, 'Mark');
    await sleep(1000);
    await clickByLabel(page, label);
    await sleep(1200);
    if (escape) {
        await closeMenus(page);
    }
}

const markCount = page => page.evaluate(() =>
    Array.from(document.querySelectorAll('.monaco-editor'))
        .reduce((n, w) => n + w.querySelectorAll('.notepadia-mark-0, .notepadia-mark-1, .notepadia-mark-2, .notepadia-mark-3, .notepadia-mark-4').length, 0));

const selCount = page => page.evaluate(() =>
    document.querySelectorAll('.monaco-editor .selected-text').length);

(async () => {
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await goto(page);
    await openFile(page, 'search.txt');

    // Search > Mark submenu exists with all four entries
    await openMenuBar(page, 'Search');
    await hoverByLabel(page, 'Mark');
    await sleep(1000);
    const markItems = await subLabels(page);
    assert('Mark submenu lists Mark, Mark All, Clear Marks and Select and Find Next',
        ['Mark', 'Mark All', 'Clear Marks', 'Select and Find Next'].every(l => markItems.includes(l)),
        JSON.stringify(markItems));
    await closeMenus(page);

    // Mark All colors every occurrence of the search term
    await setSearchTerm(page, 'foo');
    const findWidgetOpen = await page.evaluate(sel => !!document.querySelector(sel), FIND_INPUT);
    assert('find widget opened', findWidgetOpen, 'no find input');
    await page.keyboard.press('Escape');
    await sleep(400);
    await runMarkOp(page, 'Mark All');
    assert('Mark All colors all four occurrences', await markCount(page) === 4,
        'marks=' + await markCount(page));

    // Clear Marks removes them
    await runMarkOp(page, 'Clear Marks');
    assert('Clear Marks removes all marks', await markCount(page) === 0,
        'marks=' + await markCount(page));

    // Select and Find Next selects the next occurrence and extends the selection
    await setSearchTerm(page, 'foo');
    await page.keyboard.press('Escape');
    await sleep(400);
    await runMarkOp(page, 'Select and Find Next', false);
    const first = await selCount(page);
    assert('Select and Find Next selects an occurrence', first >= 1,
        'selections=' + first);
    await runMarkOp(page, 'Select and Find Next', false);
    const second = await selCount(page);
    assert('Select and Find Next selects a further occurrence', second >= 2,
        'selections=' + second);
    await page.keyboard.press('Escape');
    await sleep(400);

    assert('no page errors', errors.length === 0, JSON.stringify(errors));
    await finish(browser);
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });