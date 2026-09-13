const fs = require('fs');
const path = require('path');
const { WS, assert, finish, sleep, waitFor, launchPage, goto, openFile, save,
    clickSubMenuItem } = require('./lib.js');

(async () => {
    const { browser, page } = await launchPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await goto(page);

    await openFile(page, 'eol-lf.txt');
    await clickSubMenuItem(page, 'Edit', 'EOL Conversion', 'Convert to Windows Format (CRLF)');
    await save(page);
    let bytes = fs.readFileSync(path.join(WS, 'eol-lf.txt'));
    assert('LF -> CRLF exact bytes', bytes.equals(Buffer.from('alpha\r\nbeta\r\ngamma\r\n', 'utf8')),
        bytes.toString('hex').slice(0, 40));

    await clickSubMenuItem(page, 'Edit', 'EOL Conversion', 'Convert to Unix Format (LF)');
    await save(page);
    bytes = fs.readFileSync(path.join(WS, 'eol-lf.txt'));
    assert('CRLF -> LF exact bytes', bytes.equals(Buffer.from('alpha\nbeta\ngamma\n', 'utf8')) && !bytes.includes('\r\n'),
        bytes.toString('hex').slice(0, 40));

    await openFile(page, 'eol-crlf.txt');
    const sbEol = await page.evaluate(() => Array.from(document.querySelectorAll('#theia-statusBar *')).map(e => (e.textContent || '').trim()).filter(Boolean));
    assert('status bar shows CRLF', sbEol.includes('CRLF'), JSON.stringify(sbEol.filter(t => t === 'LF' || t === 'CRLF')));
    const clicked = await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll('#theia-statusBar *')).find(e => (e.textContent || '').trim() === 'CRLF');
        if (el) { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); return true; }
        return false;
    });
    await sleep(1500);
    const qp = await page.$$eval('#quick-input-container .monaco-list-row', els => els.map(r => (r.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 4));
    assert('status bar click opens EOL picker', clicked && qp.length > 0, JSON.stringify(qp));
    assert('no page errors', errs.length === 0, JSON.stringify(errs));
    await finish(browser);
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });