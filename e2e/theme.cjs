const { assert, finish, sleep, launchPage, goto, openFile, waitFor,
    openMenuBar, hoverByLabel, clickByLabel, closeMenus } = require('./lib.js');

const bodyUiClass = page => page.evaluate(() => document.body.className);
const statusbarBg = page => page.evaluate(() =>
    getComputedStyle(document.querySelector('#theia-statusBar')).backgroundColor);

async function solidBgUnder(page, x, y) {
    return page.evaluate(([px, py]) => {
        let cur = document.elementFromPoint(px, py);
        while (cur && cur !== document.documentElement) {
            const bg = getComputedStyle(cur).backgroundColor;
            if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
            cur = cur.parentElement;
        }
        return null;
    }, [x, y]);
}

async function editorBackground(page) {
    const box = await page.evaluate(() => {
        const el = document.querySelector('.monaco-editor .view-lines');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (!box) return null;
    return solidBgUnder(page, box.x, box.y);
}

async function editorFontStack(page) {
    return page.evaluate(() => {
        const el = document.querySelector('.monaco-editor .view-lines .view-line');
        return el ? getComputedStyle(el).fontFamily : null;
    });
}

async function openThemePicker(page) {
    await page.keyboard.down('Control');
    await page.keyboard.down('Shift');
    await page.keyboard.press('KeyP');
    await page.keyboard.up('Shift');
    await page.keyboard.up('Control');
    await waitFor(page, '#quick-input-container input', 10000, 'command palette');
    await sleep(1200);
    const input = await page.$('#quick-input-container input');
    await input.type('Color Theme', { delay: 25 });
    await sleep(900);
    await page.keyboard.press('Enter');
    await sleep(1500);
}

const pickerItems = page => page.evaluate(() =>
    Array.from(document.querySelectorAll('#quick-input-container .monaco-list .monaco-list-row'))
        .map(r => (r.getAttribute('aria-label') || r.textContent || '').trim()));

const firstPickerItem = page => page.evaluate(() => {
    const row = document.querySelector('#quick-input-container .monaco-list .monaco-list-row');
    return row ? (row.getAttribute('aria-label') || row.textContent || '').trim() : null;
});

async function selectTheme(page, themeName) {
    await openThemePicker(page);
    const menu = await pickerItems(page);
    assert('theme picker offers Notepadia Classic',
        menu.some(i => i.includes('Notepadia Classic') && !i.includes('Dark')),
        JSON.stringify(menu));
    assert('theme picker offers Notepadia Classic Dark',
        menu.some(i => i.includes('Notepadia Classic Dark')), JSON.stringify(menu));
    const input = await page.$('#quick-input-container input');
    await input.click();
    await sleep(200);
    await input.type(themeName, { delay: 25 });
    await sleep(900);
    const top = await firstPickerItem(page);
    await page.keyboard.press('Enter');
    await sleep(1500);
    return top;
}

// vs-code's quick pick fires onDidChangeActive([]) during close, and theia's
// underlying 'select color theme' picker reads activeItems[0].id unguarded;
// theme switching trips that core race, unrelated to this product code.
const isKnownCorePreviewRace = e => e.startsWith('pageerror: ')
    && e.includes("Cannot read properties of undefined (reading 'id')")
    && e.includes('onDidChangeActive');

async function waitStatusbar(page, rgb, ms) {
    await page.waitForFunction(target => {
        const st = document.querySelector('#theia-statusBar');
        return st && getComputedStyle(st).backgroundColor === target;
    }, { timeout: ms }, rgb).catch(() => { });
    await sleep(400);
}

async function readMarkColor(page) {
    await page.evaluate(() => { const el = document.querySelector('.monaco-editor'); el && el.focus(); });
    await sleep(200);
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyF');
    await page.keyboard.up('Control');
    await waitFor(page, '.monaco-editor .find-widget textarea[aria-label="Find"]', 10000, 'find input');
    await sleep(400);
    await page.click('.monaco-editor .find-widget textarea[aria-label="Find"]');
    await sleep(200);
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await sleep(200);
    await page.keyboard.type('alpha', { delay: 40 });
    await sleep(700);
    await page.keyboard.press('Escape');
    await sleep(400);
    await openMenuBar(page, 'Search');
    await hoverByLabel(page, 'Mark');
    await clickByLabel(page, 'Mark All');
    await closeMenus(page);
    await sleep(500);
    return page.evaluate(() => {
        const all = Array.from(document.querySelectorAll('.monaco-editor [class*="notepadia-mark"]'));
        const el = all[0];
        return {
            count: all.length,
            classes: [...new Set(all.map(e => e.className))].slice(0, 5),
            bg: el ? getComputedStyle(el).backgroundColor : null
        };
    });
}

(async () => {
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await goto(page);
    await sleep(500);

    await openFile(page, 'sample.txt');
    await sleep(600);
    assert('cold profile uses the light UI theme (body.vs)',
        (await bodyUiClass(page)).split(/\s+/).includes('vs'), await bodyUiClass(page));
    assert('status bar renders the light chrome #F0F0F0',
        await statusbarBg(page) === 'rgb(240, 240, 240)', await statusbarBg(page));
    assert('editor surface renders white #FFFFFF',
        await editorBackground(page) === 'rgb(255, 255, 255)', await editorBackground(page));
    const font = await editorFontStack(page);
    assert('editor uses the Consolas-first Notepad++ font stack',
        !!font && font.includes('Consolas'), font);

    const markBg = await readMarkColor(page);
    assert('Search > Mark inks .notepadia-mark-0 from the stylesheet layer',
        !!markBg && markBg.bg === 'rgba(244, 67, 54, 0.35)', JSON.stringify(markBg));

    const topDark = await selectTheme(page, 'Notepadia Classic Dark');
    assert('picker selects Notepadia Classic Dark',
        !!topDark && topDark.includes('Notepadia Classic Dark'), topDark);
    await waitStatusbar(page, 'rgb(45, 45, 48)', 20000);
    assert('dark theme switches the body to vs-dark',
        (await bodyUiClass(page)).split(/\s+/).includes('vs-dark'), await bodyUiClass(page));
    assert('dark status bar renders the chrome #2D2D30',
        await statusbarBg(page) === 'rgb(45, 45, 48)', await statusbarBg(page));
    assert('dark editor surface renders #1E1E1E',
        await editorBackground(page) === 'rgb(30, 30, 30)', await editorBackground(page));

    const topLight = await selectTheme(page, 'Notepadia Classic');
    assert('picker selects Notepadia Classic to leave the profile clean',
        !!topLight && topLight.includes('Notepadia Classic') && !topLight.includes('Dark'), topLight);
    await waitStatusbar(page, 'rgb(240, 240, 240)', 20000);
    assert('light palette restored after switching back',
        await statusbarBg(page) === 'rgb(240, 240, 240)', await statusbarBg(page));

    const unexpected = errors.filter(e => !isKnownCorePreviewRace(e));
    assert('no page errors besides the known core preview race',
        unexpected.length === 0, JSON.stringify(unexpected));
    await finish(browser);
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });