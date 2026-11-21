// Find in Files replacement parity. The dialog used to hand replacement to
// Theia's search widget, which inserts its replace field literally (while its
// preview expanded `$1`). These checks verify each replacement syntax, the
// LongPreview column handling, result publication and dirty-editor safety.
const fs = require('fs');
const path = require('path');
const { WS, assert, finish, sleep, launchPage, goto, openFile, waitFor } = require('./lib.js');
const { openFindDialog, clickDialogTab, clickDialogButton, setFindText,
    setReplaceText, setMode, setField, dialogStatus, closeDialog } = require('./dialog-helpers.cjs');

async function confirmReplace(page) {
    // Theia puts the buttons in `.dialogControl`; the title lives in a sibling
    // element, so looking for "Replace All" inside the control finds nothing.
    await waitFor(page, '.dialogControl button.main', 15000, 'Replace All confirmation');
    const confirmed = await page.evaluate(() => {
        const button = document.querySelector('.dialogControl button.main');
        if (!button) {
            return false;
        }
        button.click();
        return true;
    });
    if (!confirmed) {
        throw new Error('Replace All confirmation dialog not found');
    }
    // The status is the completion signal: it is set only after every file was
    // saved, so no fixed sleep is needed before reading the files from disk.
    await page.waitForFunction(() => {
        const text = (document.querySelector('.notepadia-find-status')?.textContent || '').trim();
        return !!text && !text.startsWith('Replacing in files') && /replacement|skipped|failed|No results/.test(text);
    }, { timeout: 30000 });
    return dialogStatus(page);
}

async function runFileReplace(page, { mode, find, replace, filter }) {
    await closeDialog(page, false);
    await openFindDialog(page);
    await clickDialogTab(page, 'Find in Files');
    await setMode(page, mode);
    await setFindText(page, find);
    await setReplaceText(page, replace);
    await setField(page, 'notepadia-find-directory', 'files-replace');
    await setField(page, 'notepadia-find-filters', filter);
    await clickDialogButton(page, 'Replace All');
    return confirmReplace(page);
}

const read = name => fs.readFileSync(path.join(WS, 'files-replace', name), 'utf8');
async function editorLines(page) {
    return page.evaluate(() => Array.from(document.querySelectorAll('.monaco-editor .view-lines .view-line'))
        .map(line => line.textContent.replace(/\u00a0/g, ' ')));
}

(async () => {
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await goto(page);
    await openFile(page, 'search.txt');

    // 1. Numbered backreferences, plus publication of the hits to F7.
    await runFileReplace(page, {
        mode: 'regex', find: '(\\w+)@(\\w+)', replace: '$2-$1', filter: 'one.txt,two.txt'
    });
    const one = read('one.txt');
    const two = read('two.txt');
    assert('Find in Files Replace All expands capture groups in both files',
        one === 'example-alice.com\ntest-bob.org\n' && two === 'example-carol.net\n' &&
        !one.includes('$') && !two.includes('$'),
        JSON.stringify({ one, two }));
    // Publishing a search reveals the results window, so no F7 is needed to
    // open it here; pressing F7 once would hide it again.
    await waitFor(page, '[data-notepadia-search-row="hit"]', 10000, 'replace results');
    const groups = await page.$$eval('[data-notepadia-search-row="group"] .notepadia-search-results-label',
        labels => labels.map(label => label.textContent.trim()));
    assert('Find in Files Replace All publishes its hits to Search Results',
        groups.some(label => label.includes('Search "(\\w+)@(\\w+)"') && label.includes('3 hits')),
        JSON.stringify(groups));
    await page.keyboard.press('F7');

    // 2. Named groups recovered from the backend line.
    await runFileReplace(page, {
        mode: 'regex', find: '(?<user>\\w+)@(?<host>\\w+)', replace: '$<user>-$<host>', filter: 'named.txt'
    });
    assert('named groups expand in Find in Files replacement',
        read('named.txt') === 'alice-example.com\n', JSON.stringify(read('named.txt')));

    // 2b. ripgrep's Rust-style (?P<name>...) spelling is translated before the
    //     recovery regex is built, so its named groups survive as well.
    await runFileReplace(page, {
        mode: 'regex', find: '(?P<user>\\w+)@(?P<host>\\w+)', replace: '$<user>-$<host>', filter: 'rust-named.txt'
    });
    assert('Rust-style named groups expand in Find in Files replacement',
        read('rust-named.txt') === 'alice-example.com\n', JSON.stringify(read('rust-named.txt')));

    // 3. Braced numeric groups.
    await runFileReplace(page, {
        mode: 'regex', find: '(\\w+)@(\\w+)', replace: '${2}/${1}', filter: 'braces.txt'
    });
    // `\w+` stops before the dot, so the unchanged `.com` stays in the line.
    assert('braced numeric groups expand in Find in Files replacement',
        read('braces.txt') === 'example/alice.com\n', JSON.stringify(read('braces.txt')));

    // 3b. `$$` is one literal dollar, and a group that did not participate
    //     expands to nothing instead of throwing or leaking the pattern.
    await runFileReplace(page, {
        mode: 'regex', find: 'foo', replace: '$$2', filter: 'dollars.txt'
    });
    assert('$$ expands to a literal dollar in regex replacement',
        read('dollars.txt') === '$2=123\n', JSON.stringify(read('dollars.txt')));
    await runFileReplace(page, {
        mode: 'regex', find: '(alice)(bob)?', replace: '$2-$1', filter: 'optional.txt'
    });
    assert('a non-participating group expands to an empty string',
        read('optional.txt') === '-alice\n', JSON.stringify(read('optional.txt')));

    // 4. Normal mode stays verbatim even when the replacement looks like \1.
    await runFileReplace(page, {
        mode: 'normal', find: 'foo', replace: '\\1', filter: 'literal.txt'
    });
    assert('Normal mode inserts a backslash reference literally',
        read('literal.txt') === '\\1=123\n', JSON.stringify(read('literal.txt')));

    // 5. Extended replacement escapes.
    await runFileReplace(page, {
        mode: 'extended', find: 'alpha', replace: 'X\\tY', filter: 'ext-replace.txt'
    });
    assert('Extended mode decodes replacement escapes',
        read('ext-replace.txt') === 'X\tY beta\n', JSON.stringify(read('ext-replace.txt')));

    // 6. A match past the backend's 300-char LinePreview threshold still gets
    //    its groups instead of empty strings.
    const prefix = 'x'.repeat(320);
    await runFileReplace(page, {
        mode: 'regex', find: '(\\w+)@(\\w+)', replace: '$2-$1', filter: 'longline.txt'
    });
    assert('long-line previews keep their capture groups',
        read('longline.txt') === prefix + ' example-alice.com tail\n', JSON.stringify(read('longline.txt').slice(-40)));

    // 7. A dirty open editor must not be edited with disk-derived ranges, and
    //    must not be saved with unrelated unsaved work.
    await closeDialog(page, false);
    await openFile(page, 'files-replace/dirty.txt');
    await page.click('.monaco-editor .view-lines');
    await sleep(200);
    await page.keyboard.type('XX');
    await sleep(500);
    const status = await runFileReplace(page, {
        mode: 'normal', find: 'one', replace: 'TWO', filter: 'dirty.txt'
    });
    assert('Replace All skips dirty editors instead of saving their buffers',
        /skipped/.test(status), status);
    assert('a skipped dirty editor is left untouched on disk and in memory',
        read('dirty.txt') === 'dirty one\n' && (await editorLines(page)).some(line => line.includes('XX')),
        JSON.stringify({ file: read('dirty.txt'), lines: await editorLines(page) }));

    // A backend error must surface as a failure, not as an empty success.
    await closeDialog(page, false);
    await openFindDialog(page);
    await clickDialogTab(page, 'Find in Files');
    await setMode(page, 'regex');
    await setFindText(page, '(');
    await setField(page, 'notepadia-find-filters', 'one.txt');
    await clickDialogButton(page, 'Find All');
    await page.waitForFunction(() => {
        const text = (document.querySelector('.notepadia-find-status')?.textContent || '').trim();
        return text.startsWith('Search failed') || /^Found \d+/.test(text) || text === 'No results';
    }, { timeout: 30000 });
    const failureStatus = await dialogStatus(page);
    assert('a failed backend search is reported instead of looking like no hits',
        failureStatus.startsWith('Search failed'), failureStatus);

    // Extended mode must decode the search term before handing it to the
    // backend; `\t` used to be searched as the two characters backslash + t.
    await closeDialog(page, false);
    await openFindDialog(page);
    await clickDialogTab(page, 'Find in Files');
    await setMode(page, 'extended');
    await setFindText(page, '\\t');
    await setField(page, 'notepadia-find-directory', '');
    await setField(page, 'notepadia-find-filters', 'escape.txt');
    await clickDialogButton(page, 'Find All');
    await page.waitForFunction(() => {
        const text = (document.querySelector('.notepadia-find-status')?.textContent || '').trim();
        return /^Found \d+ occurrences? in \d+ files?$|^No results$/.test(text);
    }, { timeout: 30000 });
    const searchStatus = await dialogStatus(page);
    assert('Find in Files decodes Extended-mode escapes in the search term',
        searchStatus === 'Found 2 occurrences in 1 file', searchStatus);

    assert('no page errors', errors.length === 0, JSON.stringify(errors));
    await finish(browser);
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });
