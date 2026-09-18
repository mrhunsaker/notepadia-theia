const fs = require('fs');
const os = require('os');
const path = require('path');
const { assert, finish, sleep, launchPage, goto, openFile,
    openMenuBar, hoverByLabel, clickByLabel, subLabels, closeMenus, save } = require('./lib.js');

const WS = process.env.E2E_WS || path.join(os.tmpdir(), 'notepadia-e2e-ws');
const read = name => fs.readFileSync(path.join(WS, name), 'utf8');

async function setTabSize(page, size) {
    await openMenuBar(page, 'View');
    await hoverByLabel(page, 'Tab Size');
    await sleep(900);
    await clickByLabel(page, String(size));
    await sleep(700);
    await closeMenus(page);
}

async function runMenuOp(page, file, submenu, label, tabSize) {
    await openFile(page, file);
    if (tabSize) {
        await setTabSize(page, tabSize);
    }
    await openMenuBar(page, 'Edit');
    await hoverByLabel(page, submenu);
    await sleep(1000);
    await clickByLabel(page, label);
    await sleep(1200);
    await closeMenus(page);
    await save(page);
}

(async () => {
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await goto(page);
    await openFile(page, 'blank-tab.txt');

    // Blank Operations submenu is present with the six Notepad++ entries
    await openMenuBar(page, 'Edit');
    await hoverByLabel(page, 'Blank Operations');
    await sleep(1000);
    const blankItems = await subLabels(page);
    assert('Blank Operations submenu lists all six operations',
        ['TAB to Space', 'Space to TAB', 'Trim leading and trailing space', 'Trim trailing space',
            'EOL to space', 'Remove unnecessary EOL and trailing spaces'].every(l => blankItems.includes(l)),
        JSON.stringify(blankItems));
    await closeMenus(page);

    await runMenuOp(page, 'blank-tab.txt', 'Blank Operations', 'TAB to Space', 4);
    assert('TAB to Space converts every tab to spaces',
        read('blank-tab.txt') === '    alpha\n    beta\n',
        JSON.stringify(read('blank-tab.txt')));

    await runMenuOp(page, 'blank-space-tab.txt', 'Blank Operations', 'Space to TAB', 4);
    assert('Space to TAB converts leading space blocks to tabs',
        read('blank-space-tab.txt') === '\talpha\n  beta\n',
        JSON.stringify(read('blank-space-tab.txt')));

    await runMenuOp(page, 'blank-trim.txt', 'Blank Operations', 'Trim leading and trailing space');
    assert('Trim leading and trailing space trims both ends',
        read('blank-trim.txt') === 'pad\nkeep\n',
        JSON.stringify(read('blank-trim.txt')));

    await runMenuOp(page, 'blank-trim-trailing.txt', 'Blank Operations', 'Trim trailing space');
    assert('Trim trailing space trims the line ends only',
        read('blank-trim-trailing.txt') === '  pad\nkeep\n',
        JSON.stringify(read('blank-trim-trailing.txt')));

    await runMenuOp(page, 'blank-eol.txt', 'Blank Operations', 'EOL to space');
    assert('EOL to space joins the document on one line',
        read('blank-eol.txt') === 'one two three',
        JSON.stringify(read('blank-eol.txt')));

    await runMenuOp(page, 'blank-unnecessary.txt', 'Blank Operations', 'Remove unnecessary EOL and trailing spaces');
    assert('Remove unnecessary EOL trims trailing space and collapses empty lines',
        read('blank-unnecessary.txt') === 'a\n\nb\n',
        JSON.stringify(read('blank-unnecessary.txt')));

    await runMenuOp(page, 'dup.txt', 'Line Operations', 'Remove Consecutive Duplicate Lines');
    assert('Remove Consecutive Duplicate Lines keeps run starts only',
        read('dup.txt') === 'x\na\nb\nc\n',
        JSON.stringify(read('dup.txt')));

    await runMenuOp(page, 'split.txt', 'Line Operations', 'Split Lines');
    const wrapped = read('split.txt').split('\n');
    const body = wrapped.filter(l => l !== '');
    const words = body.join(' ').split(' ');
    const originalWords = 'the quick brown fox jumps over the lazy dog while the sun sets above the river and the stars begin to appear in the dark sky'.split(' ');
    assert('Split Lines wraps to multiple lines', body.length >= 2, JSON.stringify(body));
    assert('Split Lines keeps every line within 80 columns',
        body.every(l => l.length <= 80),
        JSON.stringify(body.map(l => l.length)));
    assert('Split Lines preserves the words', JSON.stringify(words) === JSON.stringify(originalWords),
        JSON.stringify(words));

    assert('no page errors', errors.length === 0, JSON.stringify(errors));
    await finish(browser);
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });