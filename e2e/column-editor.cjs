const { assert, finish, sleep, launchPage, goto, openFile, waitFor,
    openMenuBar, hoverByLabel, clickByLabel, closeMenus, modelText } = require('./lib.js');

async function selectAll(page) {
    await page.evaluate(() => {
        const el = document.querySelector('.monaco-editor .inputarea, .monaco-editor textarea');
        el && el.focus();
    });
    await sleep(300);
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await sleep(400);
}

const text = async page => (await modelText(page)).replace(/\n+$/, '');

async function setInput(page, value) {
    await page.evaluate(v => {
        const el = document.querySelector('.dialogContent input[type="text"]');
        if (!el) return;
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(value));
    await sleep(200);
}

async function setMode(page, value) {
    await page.evaluate(v => {
        const el = document.querySelector('.dialogContent select');
        if (!el) return;
        el.value = v;
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
    await sleep(300);
}

async function setNumber(page, index, value) {
    await page.evaluate((i, v) => {
        const el = document.querySelectorAll('.dialogContent input[type="number"]')[i];
        if (!el) return;
        el.value = String(v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
    }, index, value);
    await sleep(200);
}

async function setLeadingZeros(page, on) {
    await page.evaluate(on => {
        const el = document.querySelector('.dialogContent input[type="checkbox"]');
        if (!el) return;
        el.checked = on;
    }, on);
    await sleep(200);
}

async function acceptDialog(page) {
    const box = await page.evaluate(() => {
        const el = document.querySelector('.dialogControl button.main');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    assert('column editor dialog has an Insert button', !!box, 'no .dialogControl button.main');
    if (!box) return;
    await page.mouse.click(box.x, box.y);
    await sleep(1600);
}

async function openColumnEditor(page) {
    await openMenuBar(page, 'Edit');
    await hoverByLabel(page, 'Line Operations');
    await sleep(1000);
    await clickByLabel(page, 'Column Editor...');
    await waitFor(page, '.dialogContent', 10000, 'column editor dialog');
    await sleep(400);
}

(async () => {
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await goto(page);
    await openFile(page, 'col-text.txt');

    // Column Editor... lives under Edit > Line Operations
    await openMenuBar(page, 'Edit');
    await hoverByLabel(page, 'Line Operations');
    await sleep(1000);
    const lineOps = await page.$$eval('.lm-Menu-item .lm-Menu-itemLabel', els =>
        els.map(e => (e.textContent || '').trim()).filter(Boolean));
    assert('Line Operations submenu has Column Editor...', lineOps.includes('Column Editor...'),
        JSON.stringify(lineOps));
    await closeMenus(page);

    // Text to insert, applied on every selected line (not the trailing newline line)
    await selectAll(page);
    await openColumnEditor(page);
    await setInput(page, 'X');
    await acceptDialog(page);
    assert('Column Editor inserts text on every line',
        await text(page) === 'Xalpha\nXbeta\nXgamma',
        JSON.stringify(await text(page)));

    // Sequential numbers across the selection
    await openFile(page, 'col-number.txt');
    await selectAll(page);
    await openColumnEditor(page);
    await setMode(page, 'number');
    await setNumber(page, 0, 1);
    await setNumber(page, 1, 2);
    await acceptDialog(page);
    assert('Column Editor inserts sequential numbers',
        await text(page) === '1alpha\n3beta\n5gamma',
        JSON.stringify(await text(page)));

    // Numbers padded with leading zeros
    await openFile(page, 'col-zeros.txt');
    await selectAll(page);
    await openColumnEditor(page);
    await setMode(page, 'number');
    await setNumber(page, 0, 7);
    await setNumber(page, 1, 3);
    await setLeadingZeros(page, true);
    await acceptDialog(page);
    assert('Column Editor pads numbers with leading zeros',
        await text(page) === '07alpha\n10beta\n13gamma',
        JSON.stringify(await text(page)));

    // Repeated text cycles one character per line
    await openFile(page, 'col-repeated.txt');
    await selectAll(page);
    await openColumnEditor(page);
    await setMode(page, 'repeated');
    await setInput(page, 'ab');
    await acceptDialog(page);
    assert('Column Editor repeats text per line',
        await text(page) === 'aalpha\nbbeta\nagamma',
        JSON.stringify(await text(page)));

    assert('no page errors', errors.length === 0, JSON.stringify(errors));
    await finish(browser);
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });