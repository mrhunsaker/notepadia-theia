// Regex and Extended replacement on the Find in Files tab. The dialog used to
// hand replacement to Theia's search widget, which inserts its replace field
// literally (while its preview expanded `$1`), so these checks verify that
// each hit's capture groups are used and that Extended escapes are decoded.
const fs = require('fs');
const path = require('path');
const { WS, assert, finish, sleep, launchPage, goto, openFile } = require('./lib.js');
const { openFindDialog, clickDialogTab, clickDialogButton, setFindText,
    setReplaceText, setMode, setField, dialogStatus, closeDialog } = require('./dialog-helpers.cjs');

async function confirmReplace(page) {
    const confirmed = await page.evaluate(() => {
        const button = document.querySelector('.dialogControl button.main');
        if (!button) {
            return false;
        }
        button.click();
        return true;
    });
    await sleep(200);
    return confirmed;
}

(async () => {
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await goto(page);
    await openFile(page, 'search.txt');
    await openFindDialog(page);
    await clickDialogTab(page, 'Find in Files');
    await setMode(page, 'regex');
    await setFindText(page, '(\\w+)@(\\w+)');
    await setReplaceText(page, '$2-$1');
    await setField(page, 'notepadia-find-directory', 'files-replace');
    await clickDialogButton(page, 'Replace All');
    assert('Replace All shows a confirmation', await confirmReplace(page));
    await sleep(1800);

    const one = fs.readFileSync(path.join(WS, 'files-replace/one.txt'), 'utf8');
    const two = fs.readFileSync(path.join(WS, 'files-replace/two.txt'), 'utf8');
    assert('Find in Files Replace All expands capture groups in both files',
        one === 'example-alice.com\ntest-bob.org\n' && two === 'example-carol.net\n' &&
        !one.includes('$') && !two.includes('$'),
        JSON.stringify({ one, two }));

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
    const status = await dialogStatus(page);
    assert('Find in Files decodes Extended-mode escapes in the search term',
        status === 'Found 2 occurrences in 1 file', status);

    assert('no page errors', errors.length === 0, JSON.stringify(errors));
    await finish(browser);
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });
