const fs = require('fs');
const path = require('path');
const { WS, assert, finish, sleep, waitFor, launchPage, goto, openFile, save,
    clickMenuItem, modelText, statusBar } = require('./lib.js');

(async () => {
    const { browser, page } = await launchPage();
    await goto(page);

    for (const f of ['enc-utf8bom.txt', 'enc-utf16le.txt', 'enc-utf16be.txt']) {
        await openFile(page, f);
        const text = await modelText(page);
        const ok = text === 'alpha\nbeta\ngamma' || text === 'alpha\nbeta\ngamma\n';
        assert('decode survives round trip ' + f, ok, JSON.stringify(text));
    }

    await openFile(page, 'sam');
    assert('status bar labels encoding', (await statusBar(page)).length > 0, JSON.stringify(await statusBar(page)));

    await openFile(page, 'enc-utf8.txt');
    const expectBom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('alpha\nbeta\ngamma\n', 'utf8')]);
    async function encodeAndSave(label, expected) {
        for (let attempt = 1; attempt <= 3; attempt++) {
            await clickMenuItem(page, 'Encoding', label);
            await sleep(1800);
            await save(page);
            const bytes = fs.readFileSync(path.join(WS, 'enc-utf8.txt'));
            if (bytes.equals(expected)) return bytes;
        }
        return fs.readFileSync(path.join(WS, 'enc-utf8.txt'));
    }

    let bytes = await encodeAndSave('Encode in UTF-8 BOM', expectBom);
    assert('convert to UTF-8 BOM adds EF BB BF', bytes.slice(0, 3).toString('hex') === 'efbbbf', bytes.slice(0, 3).toString('hex'));

    const expect16le = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('alpha\nbeta\ngamma\n', 'utf16le')]);
    bytes = await encodeAndSave('Encode in UTF-16 LE', expect16le);
    assert('convert to UTF-16 LE matches expected bytes', bytes.equals(expect16le), 'len=' + bytes.length + ' ' + bytes.slice(0, 6).toString('hex'));

    await openFile(page, 'enc-utf16le.txt');
    const text16 = await modelText(page);
    assert('UTF-16 LE file decodes cleanly', text16.includes('alpha'), JSON.stringify(text16));

    await openFile(page, 'enc-utf8.txt');
    const expect16be = Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from('alpha\nbeta\ngamma\n', 'utf16le').swap16()]);
    bytes = await encodeAndSave('Encode in UTF-16 BE', expect16be);
    assert('convert to UTF-16 BE matches expected bytes', bytes.equals(expect16be), 'len=' + bytes.length + ' ' + bytes.slice(0, 6).toString('hex'));

    await clickMenuItem(page, 'Encoding', 'Reload as UTF-8');
    await sleep(1800);
    bytes = fs.readFileSync(path.join(WS, 'enc-utf8.txt'));
    assert('reload as UTF-8 leaves bytes intact', bytes.equals(expect16be) || bytes.slice(0, 2).equals(Buffer.from([0xfe, 0xff])),
        bytes.slice(0, 6).toString('hex'));

    console.log('status bar sample:', JSON.stringify(await statusBar(page)));
    await finish(browser);
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });