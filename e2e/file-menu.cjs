const fs = require('fs');
const path = require('path');
const { assert, finish, sleep, launchPage, goto, waitFor, openFile, openMenuBar,
    clickMenuItem, closeMenus, modelText, save, clickEditorLine, WS,
    dialogPrimaryLabel, clickDialogButton, setDialogInput } = require('./lib.js');

// C1 - the File menu entries that act on a real file: Open Folder as
// Workspace..., Save a Copy As..., Reload from Disk, Rename... and Delete from
// Disk. Each one is checked against the disk and not just against the menu,
// because a file command that reports success while the file is untouched is
// worse than a missing menu entry.

const NOTES = 'alpha\nbeta\ngamma\n';

const ws = name => path.join(WS, name);
const read = name => fs.readFileSync(ws(name), 'utf8');
const exists = name => fs.existsSync(ws(name));

function write(name, text) {
    fs.rmSync(ws(name), { force: true });
    fs.writeFileSync(ws(name), text);
}

function clean(...names) {
    for (const name of names) {
        fs.rmSync(ws(name), { force: true });
    }
}

async function tabTitles(page) {
    return page.$$eval('.lm-TabBar .lm-TabBar-tabLabel', els => els.map(e => (e.textContent || '').trim()));
}

async function fileMenuEntries(page) {
    await openMenuBar(page, 'File');
    const entries = await page.$$eval('.lm-Menu-item .lm-Menu-itemLabel',
        els => els.map(e => (e.textContent || '').trim()).filter(Boolean));
    await closeMenus(page);
    return entries;
}

(async () => {
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    try {
        await goto(page);

        // --- the menu itself ---------------------------------------------------
        const entries = await fileMenuEntries(page);
        for (const label of ['Open Folder as Workspace...', 'Save a Copy As...',
            'Reload from Disk', 'Rename...', 'Delete from Disk']) {
            assert(`File menu offers ${label}`, entries.includes(label), JSON.stringify(entries));
        }
        assert('Open Folder as Workspace... appears exactly once',
            entries.filter(e => e === 'Open Folder as Workspace...').length === 1,
            JSON.stringify(entries));
        const at = label => entries.indexOf(label);
        assert('Save a Copy As... follows Save As...', at('Save a Copy As...') > at('Save As...'));
        assert('Reload from Disk comes after Save All', at('Reload from Disk') > at('Save All'));
        assert('Rename... follows Reload from Disk', at('Rename...') > at('Reload from Disk'));
        assert('Delete from Disk closes the three file commands',
            at('Delete from Disk') > at('Rename...'));

        // --- Save a Copy As ----------------------------------------------------
        clean('menu-notes.txt', 'menu-notes-copy.txt');
        write('menu-notes.txt', NOTES);
        await openFile(page, 'menu-notes.txt');
        await page.keyboard.type('EDIT ');
        await sleep(1200);

        await clickMenuItem(page, 'File', 'Save a Copy As...');
        await waitFor(page, '.dialogContent input', 20000, 'save dialog');
        assert('Save a Copy As... opens a save dialog', true);
        const defaultCopyName = await page.evaluate(() => document.querySelector('.dialogContent input[type="text"]').value);
        assert('the save dialog defaults to the source file name',
            defaultCopyName === 'menu-notes.txt', defaultCopyName);
        await setDialogInput(page, 'menu-notes-copy.txt');
        assert('Save a Copy As... confirms with a Save button',
            (await dialogPrimaryLabel(page)) === 'Save', 'label=' + await dialogPrimaryLabel(page));
        await clickDialogButton(page, 'Save');
        await sleep(3500);
        await closeMenus(page);

        assert('Save a Copy As... wrote a file', exists('menu-notes-copy.txt'));
        if (exists('menu-notes-copy.txt')) {
            assert('the copy carries the buffer, including the unsaved edit',
                read('menu-notes-copy.txt') === `EDIT ${NOTES}`,
                JSON.stringify(read('menu-notes-copy.txt')));
        }
        assert('Save a Copy As... left the original file untouched',
            read('menu-notes.txt') === NOTES, JSON.stringify(read('menu-notes.txt')));
        let titles = await tabTitles(page);
        assert('the tab is still the original file after a copy',
            titles.includes('menu-notes.txt') && !titles.includes('menu-notes-copy.txt'),
            titles.join(', '));
        // Monaco renders a space as a non-breaking space in the DOM, so the
        // word is checked without one.
        const afterCopy = await modelText(page);
        assert('the buffer still holds the unsaved edit after a copy',
            afterCopy.startsWith('EDIT'), JSON.stringify(afterCopy));

        // --- Reload from Disk --------------------------------------------------
        await clickMenuItem(page, 'File', 'Reload from Disk');
        await sleep(1200);
        assert('Reload from Disk asks before losing the edit',
            (await dialogPrimaryLabel(page)) === 'Reload', 'label=' + await dialogPrimaryLabel(page));
        assert('the reload prompt can be confirmed', await clickDialogButton(page, 'Reload'));
        await sleep(2500);
        await closeMenus(page);
        const reloaded = await modelText(page);
        assert('Reload from Disk brings the file back', reloaded === NOTES, JSON.stringify(reloaded));
        assert('Reload from Disk does not write to the file', read('menu-notes.txt') === NOTES);
        titles = await tabTitles(page);
        assert('Reload from Disk leaves the tab open', titles.includes('menu-notes.txt'), titles.join(', '));

        // --- Rename --------------------------------------------------------------
        clean('menu-renamed.txt');
        await clickMenuItem(page, 'File', 'Rename...');
        await waitFor(page, '.dialogContent input', 15000, 'rename dialog');
        assert('the rename dialog starts on the current file name',
            await page.evaluate(() => document.querySelector('.dialogContent input[type="text"]').value) === 'menu-notes.txt');
        await setDialogInput(page, 'menu-renamed.txt');
        assert('the rename dialog has a Rename button',
            (await dialogPrimaryLabel(page)) === 'Rename', 'label=' + await dialogPrimaryLabel(page));
        await clickDialogButton(page, 'Rename');
        await sleep(3500);
        await closeMenus(page);

        assert('Rename... moves the file', !exists('menu-notes.txt') && exists('menu-renamed.txt'),
            JSON.stringify(fs.readdirSync(WS).filter(f => f.startsWith('menu-'))));
        if (exists('menu-renamed.txt')) {
            assert('the renamed file keeps its contents', read('menu-renamed.txt') === NOTES);
        }
        titles = await tabTitles(page);
        assert('the tab follows the rename',
            titles.includes('menu-renamed.txt') && !titles.includes('menu-notes.txt'), titles.join(', '));

        // The rename replaces the tab, so focus has to be put back on the
        // editor before typing - otherwise the keystrokes go nowhere.
        await clickEditorLine(page, 0);
        await page.keyboard.type('MORE ');
        await sleep(600);
        await save(page);
        await sleep(1500);
        assert('saving after a rename does not recreate the old file', !exists('menu-notes.txt'));
        if (exists('menu-renamed.txt')) {
            const renamed = read('menu-renamed.txt');
            assert('saving after a rename writes the edit to the new file',
                renamed.includes('MORE') && renamed !== NOTES, JSON.stringify(renamed));
        }
        titles = await tabTitles(page);
        assert('the tab is still the new file after saving', titles.includes('menu-renamed.txt'), titles.join(', '));

        // --- Delete from Disk ------------------------------------------------------
        await clickMenuItem(page, 'File', 'Delete from Disk');
        await sleep(1200);
        assert('Delete from Disk asks first',
            (await dialogPrimaryLabel(page)) === 'Delete', 'label=' + await dialogPrimaryLabel(page));
        assert('the delete prompt can be confirmed', await clickDialogButton(page, 'Delete'));
        await sleep(3000);
        await closeMenus(page);
        assert('Delete from Disk removes the file', !exists('menu-renamed.txt'));
        titles = await tabTitles(page);
        assert('Delete from Disk closes the tab', !titles.includes('menu-renamed.txt'), titles.join(', '));

        // --- Save a Copy As on an untitled document -------------------------------
        // This is the one case where a copy is the only way to get the text out
        // of the browser, so it must not depend on there being a file behind the
        // tab.
        clean('menu-untitled-copy.txt');
        await clickMenuItem(page, 'File', 'New');
        await sleep(1500);
        await closeMenus(page);
        await clickEditorLine(page, 0);
        await page.keyboard.type('unsaved scratch text');
        await sleep(1000);
        await clickMenuItem(page, 'File', 'Save a Copy As...');
        await waitFor(page, '.dialogContent input', 20000, 'untitled save dialog');
        const untitledDefault = await page.evaluate(() =>
            document.querySelector('.dialogContent input[type="text"]').value);
        assert('an untitled copy is given a .txt name', /\.txt$/.test(untitledDefault), untitledDefault);
        await setDialogInput(page, 'menu-untitled-copy.txt');
        await clickDialogButton(page, 'Save');
        await sleep(3000);
        await closeMenus(page);
        assert('Save a Copy As... works on an untitled document', exists('menu-untitled-copy.txt'));
        if (exists('menu-untitled-copy.txt')) {
            assert('the untitled copy carries the scratch text',
                read('menu-untitled-copy.txt').includes('unsaved scratch text'),
                JSON.stringify(read('menu-untitled-copy.txt')));
        }
        titles = await tabTitles(page);
        assert('copying an untitled document does not turn the tab into a file',
            titles.some(t => t.startsWith('new ')), titles.join(', '));

        clean('menu-notes.txt', 'menu-notes-copy.txt', 'menu-untitled-copy.txt');
        assert('no page errors', errors.length === 0, JSON.stringify(errors.slice(0, 3)));
    } catch (e) {
        console.log('FAIL file-menu suite -- ' + e.message);
        process.exitCode = 1;
    } finally {
        await finish(browser);
    }
})();
