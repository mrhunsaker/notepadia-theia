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
    await page.keyboard.press('Escape');
    await sleep(400);
}

async function openMarkSubmenu(page) {
    await openMenuBar(page, 'Search');
    await hoverByLabel(page, 'Mark');
    await sleep(1000);
}

async function markAll(page) {
    await openMarkSubmenu(page);
    await clickByLabel(page, 'Mark All');
    await closeMenus(page);
    await sleep(500);
}

async function clearMarks(page) {
    await openMarkSubmenu(page);
    await clickByLabel(page, 'Clear Marks');
    await closeMenus(page);
    await sleep(500);
}

const markCount = page => page.evaluate(() =>
    Array.from(document.querySelectorAll('.monaco-editor'))
        .reduce((n, w) => n + w.querySelectorAll('.notepadia-mark-0, .notepadia-mark-1, .notepadia-mark-2, .notepadia-mark-3, .notepadia-mark-4').length, 0));

(async () => {
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await goto(page);
    await openFile(page, 'escape.txt');

    // The extended-mode toggle lives in the Mark submenu
    await openMarkSubmenu(page);
    const labels = await subLabels(page);
    assert('Mark submenu offers Use Extended Search Mode',
        labels.includes('Use Extended Search Mode'), JSON.stringify(labels));
    await clickByLabel(page, 'Use Extended Search Mode');
    await closeMenus(page);

    // \t in the find box matches a real tab character once extended mode is on
    // (escape.txt has exactly two tab characters)
    await setSearchTerm(page, '\\t');
    await markAll(page);
    assert('extended \\t matches both real tabs', await markCount(page) === 2,
        'marks=' + await markCount(page));

    // \\ matches a literal backslash (exactly one in escape.txt)
    await clearMarks(page);
    await setSearchTerm(page, '\\\\');
    await markAll(page);
    assert('extended \\\\ matches the literal backslash', await markCount(page) === 1,
        'marks=' + await markCount(page));

    // Regex metacharacters are matched literally
    await clearMarks(page);
    await setSearchTerm(page, '(');
    await markAll(page);
    assert('extended "(" matches literally (no regex explosion)', await markCount(page) === 1,
        'marks=' + await markCount(page));

    // \n matches every line break (escape.txt has five in the open model:
    // four interior line breaks plus a trailing one). Monaco paints a
    // decoration that spans a line break on BOTH adjacent lines, so assert at
    // least the interior breaks, not an exact DOM element count.
    await clearMarks(page);
    await setSearchTerm(page, '\\n');
    await markAll(page);
    assert('extended \\n marks the line breaks', await markCount(page) >= 5,
        'marks=' + await markCount(page));

    // Clearing still works after an extended search
    await clearMarks(page);
    assert('Clear Marks clears extended marks', await markCount(page) === 0,
        'marks=' + await markCount(page));

    assert('no page errors', errors.length === 0, JSON.stringify(errors));
    await finish(browser);
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });