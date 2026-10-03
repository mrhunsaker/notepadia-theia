// C3 - `View > Post-It` and `View > Full Screen`.
//
// Post-It is a body class driven by a preference, so it is asserted by the
// class appearing and disappearing. Full Screen is asserted through
// `document.fullscreenElement`, which headless Chromium does set.
const { assert, finish, sleep, launchPage, goto, openFile,
    clickMenuItem } = require('./lib.js');

const POSTIT = 'notepadia-postit';

function hasPostIt(page) {
    return page.evaluate(cls => document.body.classList.contains(cls), POSTIT);
}

function isFullScreen(page) {
    return page.evaluate(() => !!document.fullscreenElement);
}

(async () => {
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await goto(page);
    await openFile(page, 'sample.txt');

    assert('Post-It is off on a cold profile', await hasPostIt(page) === false);

    await page.keyboard.press('F12');
    await sleep(800);
    assert('F12 turns Post-It on', await hasPostIt(page) === true);

    await page.keyboard.press('F12');
    await sleep(800);
    assert('F12 turns Post-It back off', await hasPostIt(page) === false);

    await clickMenuItem(page, 'View', 'Post-It');
    await sleep(800);
    assert('View > Post-It turns it on', await hasPostIt(page) === true);

    await clickMenuItem(page, 'View', 'Post-It');
    await sleep(800);
    assert('View > Post-It turns it back off', await hasPostIt(page) === false);

    assert('the page starts out of full screen', await isFullScreen(page) === false);

    await clickMenuItem(page, 'View', 'Full Screen');
    await sleep(1000);
    assert('View > Full Screen enters full screen', await isFullScreen(page) === true);

    await clickMenuItem(page, 'View', 'Full Screen');
    await sleep(1000);
    assert('View > Full Screen leaves full screen', await isFullScreen(page) === false);

    // Ctrl+Shift+F11 is the browser-safe alternate for the browser-reserved F11.
    await page.keyboard.down('Control');
    await page.keyboard.down('Shift');
    await page.keyboard.press('F11');
    await page.keyboard.up('Shift');
    await page.keyboard.up('Control');
    await sleep(1000);
    assert('Ctrl+Shift+F11 enters full screen', await isFullScreen(page) === true);

    await page.keyboard.press('Escape');
    await sleep(1000);

    assert('no page errors', errors.length === 0, JSON.stringify(errors));
    await finish(browser);
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });