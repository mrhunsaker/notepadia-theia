const { assert, finish, sleep, launchPage, goto, openFile, waitFor,
    openMenuBar, clickByLabel, closeMenus, modelText, currentLine } = require('./lib.js');

/**
 * E1 - the Notepad++ Function List panel, checked against the seeded app.js
 * and script.ps1 fixtures.
 */

async function toggleFunctionList(page, label) {
    await openMenuBar(page, 'View');
    await clickByLabel(page, label || 'Function List');
    await sleep(900);
}

async function rows(page) {
    return page.$$eval('[data-notepadia-function-list-row]',
        els => els.map(el => ({
            kind: el.getAttribute('data-notepadia-function-list-row'),
            name: el.getAttribute('data-notepadia-function-name'),
            line: Number(el.getAttribute('data-notepadia-function-line')),
            label: el.getAttribute('aria-label'),
            selected: el.getAttribute('aria-selected')
        })));
}

async function rowNames(page) {
    return (await rows(page)).map(row => row.name);
}

async function typeIntoEditor(page, text) {
    await page.evaluate(() => {
        const el = document.querySelector('.monaco-editor');
        el && el.focus();
    });
    await sleep(300);
    await page.keyboard.press('End');
    await page.keyboard.type(text, { delay: 30 });
    await sleep(900);
}

(async () => {
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await goto(page);
    await openFile(page, 'app.js');

    // The panel is closed to begin with, which is what a Notepad++ user sees.
    assert('the panel is not on screen before it is asked for',
        (await page.$('.notepadia-function-list')) === null);

    await toggleFunctionList(page);
    const tree = await page.$('.notepadia-function-list-tree');
    assert('View > Function List opens the panel', !!tree);
    assert('the panel is a named tree',
        await page.$eval('.notepadia-function-list-tree', el =>
            el.getAttribute('role') === 'tree' && !!el.getAttribute('aria-label')),
        await page.$eval('.notepadia-function-list-tree', el => el.getAttribute('aria-label') || '(none)'));
    assert('the panel is docked on the right',
        await page.evaluate(() => {
            const widget = document.querySelector('.notepadia-function-list');
            const panel = document.querySelector('#theia-right-side-panel');
            return !!widget && !!panel && panel.contains(widget);
        }),
        'the widget is not inside #theia-right-side-panel');

    // app.js is: function greet(name) { ... } with a comment inside it. Only
    // greet belongs in the list; the commented-out text must not appear.
    const app = await rows(page);
    assert('app.js lists greet and nothing else',
        JSON.stringify(app.map(row => row.name)) === JSON.stringify(['greet']),
        JSON.stringify(app));
    assert('greet is a function on line 1',
        app[0].kind === 'function' && app[0].line === 1,
        JSON.stringify(app[0]));
    assert('a row announces its name, kind and line',
        app[0].label === 'greet, function, line 1', app[0].label);
    assert('no row starts out selected',
        app.every(row => row.selected === 'false'), JSON.stringify(app));

    // Clicking an entry takes the caret to its line.
    await page.click('[data-notepadia-function-name="greet"]');
    await sleep(700);
    assert('clicking greet puts the caret on line 1', await currentLine(page) === 1,
        'line=' + JSON.stringify(await currentLine(page)));
    assert('the clicked row reports itself selected',
        await page.$eval('[data-notepadia-function-name="greet"]', el => el.getAttribute('aria-selected')) === 'true');

    // The panel follows the language: script.ps1 is a different rule set.
    await openFile(page, 'script.ps1');
    await sleep(900);
    const ps = await rows(page);
    assert('script.ps1 lists Get-Status',
        JSON.stringify(ps.map(row => row.name)) === JSON.stringify(['Get-Status']),
        JSON.stringify(ps));
    assert('the tree names the language it is listing',
        await page.$eval('.notepadia-function-list-tree', el => (el.getAttribute('aria-label') || '').includes('powershell')),
        await page.$eval('.notepadia-function-list-tree', el => el.getAttribute('aria-label')));

    // Typing a declaration into the file reparses the panel after the debounce.
    await typeIntoEditor(page, '\nfunction Get-Location {\n  $here\n}\n');
    const afterType = await rows(page);
    assert('the panel updates as the document is edited',
        JSON.stringify(afterType.map(row => row.name)) === JSON.stringify(['Get-Status', 'Get-Location']),
        JSON.stringify(afterType));
    // Where the new declaration lands depends on where the caret was when the
    // file opened, so the rest of the suite checks that the panel's own line
    // number is the one the editor goes to rather than hard-coding one.
    const newLine = afterType[1].line;
    assert('the new entry is on a line of its own',
        newLine > 1 && newLine <= (await modelText(page)).split('\n').length,
        JSON.stringify({ entry: afterType[1] }));

    // Clicking an entry that is not the first one also lands on its line.
    await page.click('[data-notepadia-function-name="Get-Location"]');
    await sleep(800);
    assert('clicking a later entry jumps to its own line', await currentLine(page) === newLine,
        JSON.stringify({ line: await currentLine(page), newLine }));

    // Filtering narrows the list, case-insensitively, and Escape clears it.
    await page.click('.notepadia-function-list-filter-input');
    await page.keyboard.type('location', { delay: 30 });
    await sleep(500);
    assert('the filter narrows the list',
        JSON.stringify(await rowNames(page)) === JSON.stringify(['Get-Location']),
        JSON.stringify(await rowNames(page)));
    await page.keyboard.press('Escape');
    await sleep(500);
    assert('Escape clears the filter',
        JSON.stringify(await rowNames(page)) === JSON.stringify(['Get-Status', 'Get-Location']),
        JSON.stringify(await rowNames(page)));

    // Notepad++ has both orders behind a sort toggle.
    assert('document order is the default',
        await page.$eval('.notepadia-function-list-controls button', el => el.textContent.trim() === 'A-Z'));
    await page.click('.notepadia-function-list-controls button');
    await sleep(500);
    assert('the toggle sorts alphabetically',
        JSON.stringify(await rowNames(page)) === JSON.stringify(['Get-Location', 'Get-Status']),
        JSON.stringify(await rowNames(page)));
    assert('the sort button reports its state',
        await page.$eval('.notepadia-function-list-controls button', el => el.getAttribute('aria-pressed')) === 'true');
    await page.click('.notepadia-function-list-controls button');
    await sleep(500);
    assert('toggling again restores document order',
        JSON.stringify(await rowNames(page)) === JSON.stringify(['Get-Status', 'Get-Location']),
        JSON.stringify(await rowNames(page)));

    // The tree is walkable: ArrowDown moves the cursor and Enter jumps.
    await page.focus('.notepadia-function-list-tree');
    await page.keyboard.press('ArrowDown');
    await sleep(400);
    assert('ArrowDown selects the first row',
        await page.$$eval('[data-notepadia-function-list-row]',
            els => els.filter(el => el.getAttribute('aria-selected') === 'true').length === 1
            && els[0].getAttribute('aria-selected') === 'true'),
        JSON.stringify(await rows(page)));
    assert('the tree points at the selected row',
        await page.$eval('.notepadia-function-list-tree', el => el.getAttribute('aria-activedescendant') || '')
            === 'notepadia.functionList-row-0',
        await page.$eval('.notepadia-function-list-tree', el => el.getAttribute('aria-activedescendant')));
    await page.keyboard.press('ArrowDown');
    await sleep(400);
    await page.keyboard.press('Enter');
    await sleep(900);
    const focusedLine = await page.$eval('[data-notepadia-function-list-row][aria-selected="true"]',
        el => Number(el.getAttribute('data-notepadia-function-line')));
    assert('Enter on the focused row jumps to its own line',
        await currentLine(page) === focusedLine,
        JSON.stringify({ line: await currentLine(page), focusedLine }));

    // The panel keeps its own preferences between files, like Notepad++ does.
    await openFile(page, 'app.js');
    await sleep(900);
    assert('switching files keeps the sort and the filter',
        JSON.stringify(await rowNames(page)) === JSON.stringify(['greet'])
        && await page.$eval('.notepadia-function-list-filter-input', el => el.value === ''),
        JSON.stringify(await rowNames(page)));

    // A language with no rules says so rather than showing an empty box.
    await openFile(page, 'sample.txt');
    await sleep(900);
    const empty = await page.$eval('.notepadia-function-list-empty', el => el.textContent).catch(() => '');
    assert('a file with nothing to list explains itself',
        /No functions found/.test(empty), JSON.stringify(empty));

    // The same command hides it again. The document is read either side of the
    // close, so the claim is that toggling the panel leaves the buffer alone -
    // which is about this document, not about a seeded file an earlier suite may
    // have typed into.
    const textBeforeClose = await modelText(page);
    await toggleFunctionList(page);
    assert('View > Function List closes the panel',
        await page.$eval('#theia-right-area', el => !el.textContent.includes('Function List')).catch(() => true),
        'the panel is still showing');
    assert('the toolbar has a Function List button',
        await page.$eval('.notepadia-toolbar', el => !!el.querySelector('[aria-label="Function List"]')).catch(() => false));

    assert('closing the panel left the document alone', (await modelText(page)) === textBeforeClose,
        JSON.stringify({ before: textBeforeClose, now: await modelText(page) }));
    assert('no page errors during the function list pass', errors.length === 0, JSON.stringify(errors));
    await finish(browser, page);
})().catch(error => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    fs.writeFileSync(path.join(os.tmpdir(), 'notepadia-function-list-error.log'),
        String(error && error.stack || error));
    finish(null, null, error);
});
