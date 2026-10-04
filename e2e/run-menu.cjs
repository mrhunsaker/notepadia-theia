const { assert, finish, sleep, launchPage, goto, openFile, waitFor,
    openMenuBar, clickByLabel, subLabels, closeMenus, clickDialogButton, dialogPrimaryLabel } = require('./lib.js');

/**
 * C5: the Run menu.
 *
 * The browser is the shipping target and cannot start a process, so these
 * checks pin down what it *does* do instead: it is present in Notepad++'s
 * position in the menu bar, it expands Notepad++ variables, an http(s) command
 * opens a new tab, any other command explains that it needs the desktop build,
 * and a named command is listed in the menu until it is deleted.
 *
 * `window.open` is replaced with a recorder before anything runs, so the URL
 * path can be asserted without actually navigating anywhere.
 */

const COMMAND_INPUT = '#notepadia-run-command';
const NAME_INPUT = '#notepadia-run-name';

async function menuBarNames(page) {
    return page.$$eval('.lm-MenuBar-item', els => els.map(e => e.innerText.trim()));
}

async function setInput(page, selector, value) {
    return page.evaluate((sel, text) => {
        const el = document.querySelector(sel);
        if (!el) {
            return false;
        }
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, text);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
    }, selector, value);
}

async function openedUrls(page) {
    return page.evaluate(() => window.__notepadiaOpened || []);
}

async function dialogText(page) {
    return page.evaluate(() => {
        const el = document.querySelector('.dialogContent');
        return el ? el.innerText.replace(/\s+/g, ' ').trim() : '';
    });
}

async function notifications(page) {
    return page.evaluate(() => Array.from(document.querySelectorAll('.theia-notification-message'))
        .map(e => (e.textContent || '').trim()));
}

/** Saving is asynchronous; poll rather than sleep a fixed amount and hope. */
async function waitForMenuLabel(page, label, present) {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
        await openMenuBar(page, 'Run');
        const labels = await subLabels(page);
        await closeMenus(page);
        if (labels.includes(label) === present) {
            return true;
        }
        await sleep(400);
    }
    return false;
}

async function waitForNotification(page, needle) {
    const deadline = Date.now() + 10000;
    let seen = '';
    while (Date.now() < deadline) {
        seen = (await notifications(page)).join(' | ');
        if (seen.includes(needle)) {
            return true;
        }
        await sleep(400);
    }
    return false;
}

async function openRunDialog(page) {
    await openMenuBar(page, 'Run');
    await sleep(300);
    await clickByLabel(page, 'Run...');
    await waitFor(page, COMMAND_INPUT);
}

(async () => {
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await goto(page);
    await openFile(page, 'sample.txt');

    // A Run menu that cannot do anything is not registered at all, so its
    // presence is itself a capability check.
    await page.evaluate(() => {
        window.__notepadiaOpened = [];
        window.open = url => {
            window.__notepadiaOpened.push(String(url));
            return { closed: false };
        };
    });

    const bar = await menuBarNames(page);
    const runIdx = bar.findIndex(n => n === 'Run');
    const macrosIdx = bar.findIndex(n => n === 'Macros');
    const windowIdx = bar.findIndex(n => n === 'Window');
    assert('Run menu sits between Macros and Window',
        runIdx > -1 && runIdx > macrosIdx && runIdx > -1 && runIdx < windowIdx,
        JSON.stringify(bar));

    await openMenuBar(page, 'Run');
    await sleep(400);
    const runItems = await subLabels(page);
    assert('Run menu offers Run... and the saved-command dialog',
        runItems.includes('Run...') && runItems.includes('Modify Shortcut/Delete Command...'),
        JSON.stringify(runItems));
    await closeMenus(page);

    // The dialog: command box, optional saved name, Run / Save / Cancel.
    await openRunDialog(page);
    assert('Run dialog is titled Run',
        (await page.evaluate(() => document.querySelector('.dialogTitle')?.innerText.trim())) === 'Run');
    assert('Run dialog primary button is Run', (await dialogPrimaryLabel(page)) === 'Run');
    assert('Run dialog has a command box and a saved-name box',
        await page.evaluate(() =>
            !!document.querySelector('#notepadia-run-command') &&
            !!document.querySelector('#notepadia-run-name')));
    const dialogButtons = await page.$$eval('.dialogControl button', els => els.map(e => e.innerText.trim()));
    assert('Run dialog has Run, Save and Cancel',
        ['Run', 'Save', 'Cancel'].every(l => dialogButtons.includes(l)),
        JSON.stringify(dialogButtons));

    // A command the browser cannot run must say so instead of failing silently.
    await setInput(page, COMMAND_INPUT, 'echo hello');
    await clickDialogButton(page, 'Run');
    assert('a non-URL command does not open a tab',
        (await openedUrls(page)).length === 0, JSON.stringify(await openedUrls(page)));
    assert('a non-URL command explains the browser limitation',
        await waitForNotification(page, 'cannot launch a program'),
        (await notifications(page)).join(' | '));
    assert('the Run dialog closed after Run',
        (await page.$('#notepadia-run-command')) === null);

    // http(s) opens a tab, with Notepad++ variables expanded first.
    await openRunDialog(page);
    await setInput(page, COMMAND_INPUT, 'https://notepadia.example/$(FILE_NAME)?dir=$(NAME_PART)');
    await setInput(page, NAME_INPUT, 'Sample URL');
    await clickDialogButton(page, 'Run');
    assert('an https command opens a new tab',
        await waitForNotification(page, 'Saved the Run command "Sample URL"'),
        (await notifications(page)).join(' | '));
    const urls = await openedUrls(page);
    assert('the URL has $(FILE_NAME) and $(NAME_PART) expanded',
        urls.length === 1 && urls[0] === 'https://notepadia.example/sample.txt?dir=sample',
        JSON.stringify(urls));

    // Enter in the command box runs once. The overlay already routes Enter to
    // the dialog, so an extra handler on the input would open two tabs.
    await openRunDialog(page);
    await setInput(page, COMMAND_INPUT, 'https://notepadia.example/enter.txt');
    await page.focus(COMMAND_INPUT);
    await page.keyboard.press('Enter');
    await sleep(1500);
    const afterEnter = await openedUrls(page);
    assert('Enter runs the command exactly once',
        afterEnter.length === 2 && afterEnter[1] === 'https://notepadia.example/enter.txt',
        JSON.stringify(afterEnter));

    // The saved command is listed in the Run menu and runs from there.
    assert('the saved command is listed in the Run menu',
        await waitForMenuLabel(page, 'Sample URL', true));
    await openMenuBar(page, 'Run');
    await sleep(300);
    await clickByLabel(page, 'Sample URL');
    await sleep(1200);
    const afterMenu = await openedUrls(page);
    assert('the saved command opens its tab from the menu',
        afterMenu.length === 3 && afterMenu[2] === 'https://notepadia.example/sample.txt?dir=sample',
        JSON.stringify(afterMenu));

    // Delete it again, which also removes the menu entry.
    await openMenuBar(page, 'Run');
    await sleep(300);
    await clickByLabel(page, 'Modify Shortcut/Delete Command...');
    await waitFor(page, '.notepadia-run-list');
    const rows = await page.$$eval('.notepadia-run-row', els => els.map(e => e.innerText.replace(/\s+/g, ' ').trim()));
    assert('the saved command is listed with its command',
        rows.length === 1 && rows[0].includes('Sample URL') &&
        rows[0].includes('https://notepadia.example/$(FILE_NAME)?dir=$(NAME_PART)'),
        JSON.stringify(rows));
    await clickDialogButton(page, 'Delete');
    await sleep(600);
    assert('the saved command is gone from the Run menu',
        await waitForMenuLabel(page, 'Sample URL', false));
    const openDialogs = await page.evaluate(() => document.querySelectorAll('.dialogOverlay').length);
    assert('the saved-command dialog closed after Delete', openDialogs === 0, String(openDialogs));
    assert('the dialog lists no commands once none are saved', (await dialogText(page)) === '');

    assert('no page errors', errors.length === 0, JSON.stringify(errors));
    await finish(browser);
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });