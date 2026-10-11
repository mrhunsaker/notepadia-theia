const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { assert, finish, sleep, launchPage, goto, waitFor,
    openMenuBar, clickMenuItem, closeMenus, editorLines, WS } = require('./lib.js');

// Puppeteer cannot drive the native File System Access API, so this suite
// exercises the Firefox / Safari route the spec asks for: a hidden
// `<input type="file">` for reading and a Blob download for writing. The picker
// entry points are stubbed away first, so the same fallback is exercised on
// Chromium and the assertions never depend on whether headless Chrome happens
// to expose the API.
const SRC_DIR = path.join(os.tmpdir(), 'notepadia-e2e-local-src');
const DOWNLOAD_DIR = path.join(os.tmpdir(), 'notepadia-e2e-downloads');
const LOCAL_FIXTURE = path.join(SRC_DIR, 'local-notes.txt');
const LOCAL_TEXT = 'alpha from my laptop\nbeta from my laptop\ngamma from my laptop\n';

async function stubFileSystemAccess(page) {
    return page.evaluate(() => {
        delete window.showOpenFilePicker;
        delete window.showSaveFilePicker;
        return typeof window.showOpenFilePicker === 'undefined'
            && typeof window.showSaveFilePicker === 'undefined';
    });
}

async function allowDownloads(page) {
    fs.rmSync(DOWNLOAD_DIR, { recursive: true, force: true });
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    const client = await page.createCDPSession();
    await client.send('Page.enable');
    await client.send('Browser.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: DOWNLOAD_DIR,
        eventsEnabled: true
    });
    const started = [];
    // Chromium reports the download on the Page domain; `eventsEnabled` also
    // raises it on the Browser domain. Accept either so the check is not tied
    // to one protocol version.
    client.on('Page.downloadWillBegin', e => started.push(e.suggestedFilename));
    client.on('Browser.downloadWillBegin', e => started.push(e.suggestedFilename));
    return { client, started };
}

async function tabTitles(page) {
    return page.$$eval('.lm-TabBar .lm-TabBar-tabLabel', els => els.map(e => (e.textContent || '').trim()));
}

async function activateTab(page, title) {
    const labels = await page.$$('.lm-TabBar .lm-TabBar-tabLabel');
    for (const label of labels) {
        if (((await label.evaluate(e => e.textContent)) || '').trim() === title) {
            await label.click();
            await sleep(1200);
            return true;
        }
    }
    return false;
}

async function fileMenuEntries(page) {
    await openMenuBar(page, 'File');
    const labels = await page.$$eval('.lm-Menu-item .lm-Menu-itemLabel',
        els => els.map(e => (e.textContent || '').trim()).filter(Boolean));
    await closeMenus(page);
    return labels;
}

/**
 * Drives the hidden `<input type="file" multiple>` route.
 *
 * Puppeteer auto-dismisses a file chooser that nothing is listening for, which
 * makes the input emit `cancel` and the contribution clean itself up before a
 * test can reach it. Waiting for the chooser and accepting a file is the same
 * interaction a user performs on the hidden input, just without the race, so
 * this is what asserts the fallback actually works.
 */
async function pickViaHiddenInput(page, trigger, file) {
    const [chooser] = await Promise.all([
        page.waitForFileChooser({ timeout: 30000 }),
        trigger()
    ]);
    await chooser.accept([file]);
}

/**
 * The folder a Theia file dialog is currently showing, read from its location
 * breadcrumb. Empty string when no dialog is open.
 */
async function dialogLocation(page) {
    const select = await page.$('.theia-LocationListPanel select.theia-LocationList');
    if (!select) {
        return '';
    }
    return page.$eval('.theia-LocationListPanel select.theia-LocationList', el => el.value);
}

/**
 * I1: with the native route forced on, run `trigger` and assert the Theia
 * dialog it opens roots itself at `homeUri` rather than at the workspace or
 * the current selection. Always closes the dialog before returning.
 */
async function nativeDialogStartsAtHome(page, homeUri, trigger) {
    await trigger();
    const deadline = Date.now() + 15000;
    let location = '';
    while (Date.now() < deadline) {
        location = await dialogLocation(page);
        if (location) {
            break;
        }
        await sleep(200);
    }
    await page.keyboard.press('Escape');
    await sleep(800);
    const normalize = value => value.replace(/\/+$/, '');
    return Boolean(location) && normalize(location) === normalize(homeUri);
}

/** Replaces the File System Access pickers with recorders that capture options. */
async function installPickerRecorder(page) {
    return page.evaluate(() => {
        window.__pickerCalls = [];
        window.showOpenFilePicker = async options => {
            window.__pickerCalls.push({ kind: 'open', options });
            return [{
                name: 'resumed.txt',
                getFile: async () => new File(['resumed\n'], 'resumed.txt', { type: 'text/plain' })
            }];
        };
        window.showSaveFilePicker = async options => {
            window.__pickerCalls.push({ kind: 'save', options });
            return {
                name: (options && options.suggestedName) || 'resumed.txt',
                createWritable: async () => ({ write: async () => { }, close: async () => { } })
            };
        };
        return true;
    });
}

async function lastPickerStartIn(page) {
    return page.evaluate(() => {
        const calls = window.__pickerCalls || [];
        const last = calls[calls.length - 1];
        return last ? last.options.startIn : undefined;
    });
}

/** Removes the remembered directory, giving a page a clean-profile start. */
async function clearRememberedPickerDirectory(page) {
    await page.evaluate(() => new Promise((resolve, reject) => {
        const rq = indexedDB.deleteDatabase('notepadia-picker-directory');
        rq.onsuccess = () => resolve(true);
        rq.onerror = () => reject(rq.error);
        rq.onblocked = () => resolve(false);
    }));
}

/** Writes a stand-in "remembered directory" under the store's own db/key. */
async function seedRememberedPickerDirectory(page, value) {
    return page.evaluate(async seed => {
        await new Promise((resolve, reject) => {
            const open = indexedDB.open('notepadia-picker-directory', 1);
            open.onupgradeneeded = () => {
                if (!open.result.objectStoreNames.contains('handles')) {
                    open.result.createObjectStore('handles');
                }
            };
            open.onsuccess = () => {
                const tx = open.result.transaction('handles', 'readwrite');
                tx.objectStore('handles').put(seed, 'last');
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
                tx.onabort = () => reject(tx.error);
            };
            open.onerror = () => reject(open.error);
        });
        return new Promise((resolve, reject) => {
            const open = indexedDB.open('notepadia-picker-directory', 1);
            open.onsuccess = () => {
                const rq = open.result.transaction('handles', 'readonly').objectStore('handles').get('last');
                rq.onsuccess = () => resolve(rq.result === undefined ? null : rq.result);
                rq.onerror = () => reject(rq.error);
            };
            open.onerror = () => reject(open.error);
        });
    }, value);
}

(async () => {
    fs.mkdirSync(SRC_DIR, { recursive: true });
    fs.rmSync(LOCAL_FIXTURE, { force: true });
    fs.writeFileSync(LOCAL_FIXTURE, LOCAL_TEXT);
    // Earlier suites can leave a saved-over workspace behind; start from a file
    // that does not exist so the upload takes the create path, not the
    // "already exists" dialog.
    fs.rmSync(path.join(WS, 'local-notes.txt'), { force: true });

    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await goto(page);

    assert('the File System Access API can be stubbed out for the fallback path', await stubFileSystemAccess(page));

    // Acceptance criterion 3: the File menu must make the two storages legible.
    const entries = await fileMenuEntries(page);
    // D7: no entry anywhere is labeled 'Open...' any more, so the verb cannot
    // resolve to two different filesystems.
    assert('no File menu entry is labeled Open...', !entries.includes('Open...'),
        JSON.stringify(entries));
    assert('File menu offers Open from Computer', entries.includes('Open from Computer'),
        JSON.stringify(entries));
    assert('File menu offers Upload to Workspace...', entries.includes('Upload to Workspace...'),
        JSON.stringify(entries));
    assert('File menu offers Save To This Computer...', entries.includes('Save To This Computer...'),
        JSON.stringify(entries));
    // D7: Theia's server-workspace browse is still reachable, but under a name
    // that says which filesystem it opens. The plain 'Open...' label is gone
    // for good, which is what stops the verb from meaning two places.
    assert("the File menu still offers the server-workspace browse, named", entries.includes('Open from Workspace...'),
        JSON.stringify(entries));
    assert('the dead Theia file.upload entry stays out of the File menu',
        !entries.some(e => /upload files/i.test(e)), JSON.stringify(entries));
    assert('the dead Theia file.download entry stays out of the File menu',
        !entries.some(e => /^download$/i.test(e)), JSON.stringify(entries));

    // --- Open from Computer via the hidden input ---------------------
    await pickViaHiddenInput(page,
        () => clickMenuItem(page, 'File', 'Open from Computer'),
        LOCAL_FIXTURE);
    await waitFor(page, '.monaco-editor');
    await sleep(2500);

    const titles = await tabTitles(page);
    assert('the local file opens in a tab named after the real file', titles.includes('local-notes.txt'),
        JSON.stringify(titles));

    const lines = (await editorLines(page)).map(l => l.replace(/\u00a0/g, ' '));
    assert('the local file content is in the editor',
        lines[0] === 'alpha from my laptop' && lines[2] === 'gamma from my laptop',
        JSON.stringify(lines));

    // Notepad++ shows the file name in the tab bar (its status bar carries
    // Ln/Col/Sel/length, not a name), so the tab label is where the real file
    // name has to show up instead of a generic `new N` untitled name.
    assert('no tab is left with a generic untitled name',
        !titles.some(t => /^new \d/.test(t)), JSON.stringify(titles));

    // --- A second copy of the same file must not collide with the first tab --
    await pickViaHiddenInput(page,
        () => clickMenuItem(page, 'File', 'Open from Computer'),
        LOCAL_FIXTURE);
    await sleep(3000);
    const afterSecond = await tabTitles(page);
    assert('a second copy of the same file is numbered instead of colliding',
        afterSecond.includes('local-notes (2).txt'), JSON.stringify(afterSecond));
    // Back to the first copy, so the download-name checks below see the
    // original tab rather than the numbered duplicate.
    assert('the first copy can be reactivated', await activateTab(page, 'local-notes.txt'),
        JSON.stringify(afterSecond));
    await closeMenus(page);

    // --- Save To This Computer... fires a download ---------------------------
    const { started } = await allowDownloads(page);
    await clickMenuItem(page, 'File', 'Save To This Computer...');
    const deadline = Date.now() + 20000;
    while (started.length === 0 && Date.now() < deadline) {
        await sleep(300);
    }
    assert('Save To This Computer... starts a download', started.length > 0, JSON.stringify(started));
    assert('the download keeps the tab file name', started[0] === 'local-notes.txt', JSON.stringify(started));

    const settled = Date.now() + 20000;
    let written = [];
    while (Date.now() < settled) {
        written = fs.readdirSync(DOWNLOAD_DIR).filter(f => !f.endsWith('.crdownload'));
        if (written.length > 0) {
            break;
        }
        await sleep(300);
    }
    assert('the downloaded copy is written to disk', written.length > 0, JSON.stringify(fs.readdirSync(DOWNLOAD_DIR)));
    if (written.length) {
        const body = fs.readFileSync(path.join(DOWNLOAD_DIR, written[0]), 'utf8');
        assert('the download carries the document text', body === LOCAL_TEXT, JSON.stringify(body));
    }

    // --- Ctrl+S on a fallback-opened tab must not silently do nothing -------
    // There is no handle to write back through, so the Ctrl+S handler defers to
    // Theia, which offers Save As for an untitled resource. What must not
    // happen is a download or a page error.
    const downloadsBefore = started.length;
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyS');
    await page.keyboard.up('Control');
    await sleep(2500);
    assert('Ctrl+S on a handle-less tab does not download', started.length === downloadsBefore,
        JSON.stringify(started));
    await page.keyboard.press('Escape');
    await sleep(800);

    // --- Upload to Workspace... puts the file in the SERVER workspace -------
    await pickViaHiddenInput(page,
        () => clickMenuItem(page, 'File', 'Upload to Workspace...'),
        LOCAL_FIXTURE);
    await sleep(5000);
    const wsCopies = fs.readdirSync(WS).filter(f => f.startsWith('local-notes'));
    assert('Upload to Workspace... writes the file into the server workspace', wsCopies.length > 0,
        JSON.stringify(fs.readdirSync(WS)));
    if (wsCopies.length) {
        const uploaded = fs.readFileSync(path.join(WS, wsCopies[0]), 'utf8');
        assert('the uploaded copy carries the original text', uploaded === LOCAL_TEXT, JSON.stringify(uploaded));
    }
    await sleep(1500);

    // --- WS-I / I1: native dialogs open at home, not the workspace --------
    // The native route only runs under Electron, where Theia substitutes the
    // OS dialogs; forcing the flag exercises the exact code path - and the web
    // fallback dialog that stands in for it is where the default root shows.
    const homeUri = pathToFileURL(os.homedir()).toString();
    await page.evaluate(() => { window.electronTheiaCore = { useNativeElements: true }; });
    assert('Save To This Computer... opens a Theia dialog at home, not the workspace',
        await nativeDialogStartsAtHome(page, homeUri, () => clickMenuItem(page, 'File', 'Save To This Computer...')),
        JSON.stringify(await dialogLocation(page)));
    assert('Open from Computer opens a Theia dialog at home, not the workspace',
        await nativeDialogStartsAtHome(page, homeUri, () => clickMenuItem(page, 'File', 'Open from Computer')),
        JSON.stringify(await dialogLocation(page)));
    assert('Upload to Workspace... opens a Theia dialog at home, not the workspace',
        await nativeDialogStartsAtHome(page, homeUri, () => clickMenuItem(page, 'File', 'Upload to Workspace...')),
        JSON.stringify(await dialogLocation(page)));
    await page.evaluate(() => { delete window.electronTheiaCore; });
    await closeMenus(page);

    // --- WS-I / I2: browser pickers resume and fall back honestly ---------
    // Run on fresh pages: the picker store keeps its IndexedDB connection for
    // the life of a page, so a clean page is what a returning user gets. The
    // remembered-handle branch seeds the store before the first pick; the
    // fallback branch is a profile with nothing remembered.
    const pickerPage = await browser.newPage();
    await pickerPage.setViewport({ width: 1440, height: 1000 });
    await goto(pickerPage);
    await installPickerRecorder(pickerPage);
    assert('the remembered directory can be written to the store',
        (await seedRememberedPickerDirectory(pickerPage, { name: 'remembered-directory' })) !== null);
    await clickMenuItem(pickerPage, 'File', 'Open from Computer');
    await sleep(1500);
    const resumedStartIn = await lastPickerStartIn(pickerPage);
    assert('the browser pick resumes at the remembered directory handle',
        resumedStartIn && resumedStartIn.name === 'remembered-directory', JSON.stringify(resumedStartIn));
    await pickerPage.close();

    const freshPage = await browser.newPage();
    await freshPage.setViewport({ width: 1440, height: 1000 });
    await goto(freshPage);
    await installPickerRecorder(freshPage);
    await clearRememberedPickerDirectory(freshPage);
    await clickMenuItem(freshPage, 'File', 'Open from Computer');
    await sleep(1500);
    const firstStartIn = await lastPickerStartIn(freshPage);
    assert('with nothing remembered the pick uses the documented fallback directory',
        firstStartIn === 'documents', JSON.stringify(firstStartIn));
    await freshPage.close();

    assert('no page errors', errors.length === 0, JSON.stringify(errors));
    await finish(browser);
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });
