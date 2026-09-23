const { assert, finish, sleep, launchPage, goto, openFile, save,
    clickByLabel, subLabels, closeMenus, clickSubMenuItem } = require('./lib.js');

async function tabRects(page, label) {
    return page.evaluate(l => {
        const el = Array.from(document.querySelectorAll('li.lm-TabBar-tab'))
            .filter(t => t.getBoundingClientRect().width > 0 && t.getBoundingClientRect().height > 0)
            .find(t => (t.textContent || '').trim().startsWith(l));
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, label);
}

async function tabLabels(page) {
    return page.evaluate(() => Array.from(document.querySelectorAll('li.lm-TabBar-tab'))
        .filter(t => t.getBoundingClientRect().width > 0 && t.getBoundingClientRect().height > 0)
        .map(t => (t.textContent || '').trim())
        .filter(t => t.includes('.txt')));
}

async function tabState(page, label) {
    return page.evaluate(l => {
        const el = Array.from(document.querySelectorAll('li.lm-TabBar-tab'))
            .filter(t => t.getBoundingClientRect().width > 0 && t.getBoundingClientRect().height > 0)
            .find(t => (t.textContent || '').trim().startsWith(l));
        if (!el) return null;
        const out = { classes: [] };
        for (const c of ['notepadia-tab-saved', 'notepadia-tab-dirty', 'notepadia-tab-readonly']) {
            if (el.classList.contains(c)) out.classes.push(c);
        }
        const icon = el.querySelector('.lm-TabBar-tabIcon');
        const labelEl = el.querySelector('.lm-TabBar-tabLabel');
        out.iconDisplay = icon ? getComputedStyle(icon).display : null;
        out.bgImage = labelEl ? getComputedStyle(labelEl, '::before').backgroundImage : null;
        return out;
    }, label);
}

async function bodyClass(page, name) {
    return page.evaluate(n => document.body.classList.contains(n), name);
}

(async () => {
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await goto(page);

    assert('draw close button class present by default', await bodyClass(page, 'notepadia-tabclose-all'));

    await openFile(page, 'sample.txt');
    let state = await tabState(page, 'sample');
    assert('clean tab carries saved state', state && state.classes.includes('notepadia-tab-saved'),
        JSON.stringify(state && state.classes));

    // The default file icon is suppressed and the state icon is painted.
    assert('state icon painted via label ::before', state && state.bgImage.includes('data:image/svg+xml'),
        JSON.stringify(state && state.bgImage));
    assert('default tab icon suppressed on state tab', state && state.iconDisplay === 'none',
        JSON.stringify(state && state.iconDisplay));

    // Type into the editor: the tab flips to the dirty state.
    await page.evaluate(() => document.querySelector('.monaco-editor').focus());
    await page.keyboard.type('XYZ');
    await sleep(700);
    state = await tabState(page, 'sample');
    assert('typed tab carries dirty state', state && state.classes.includes('notepadia-tab-dirty'),
        JSON.stringify(state && state.classes));

    await save(page);
    state = await tabState(page, 'sample');
    assert('saved tab back to saved state', state && state.classes.includes('notepadia-tab-saved')
        && !state.classes.includes('notepadia-tab-dirty'), JSON.stringify(state && state.classes));

    await openFile(page, 'recent-a.txt');
    let labels = await tabLabels(page);
    assert('two open tabs', labels.includes('sample.txt') && labels.includes('recent-a.txt'), JSON.stringify(labels));

    // The editor tab context menu is the Notepad++ one.
    const recentA = await tabRects(page, 'recent-a');
    await page.mouse.click(recentA.x, recentA.y, { button: 'right' });
    await sleep(1100);
    labels = await subLabels(page);
    for (const expected of ['Close', 'Close All BUT This', 'Close All to the Left', 'Close All to the Right',
        'Save', 'Save As...', 'Print', 'Copy File Path', 'Copy File Name', 'Copy Directory Path']) {
        assert('tab menu has ' + expected, labels.includes(expected), JSON.stringify(labels));
    }
    for (const gone of ['Copy Path', 'Pin', 'Unpin', 'Keep Open', 'Close Others', 'Close to the Right',
        'Close Saved', 'Close All', 'Reveal in File Explorer']) {
        assert('tab menu lacks stock ' + gone, !labels.includes(gone), JSON.stringify(labels));
    }
    await closeMenus(page);

    // Middle-clicking a secondary tab closes it and keeps the first one.
    const recent2 = await tabRects(page, 'recent-a');
    await page.mouse.click(recent2.x, recent2.y, { button: 'middle' });
    await sleep(900);
    labels = await tabLabels(page);
    assert('middle-click closes second tab', labels.includes('sample.txt') && !labels.includes('recent-a.txt'),
        JSON.stringify(labels));

    // Close All BUT This from the tab menu keeps only the clicked tab.
    await openFile(page, 'recent-b.txt');
    const sample = await tabRects(page, 'sample.txt');
    await page.mouse.click(sample.x, sample.y, { button: 'right' });
    await sleep(1100);
    await clickByLabel(page, 'Close All BUT This');
    labels = await tabLabels(page);
    assert('Close All BUT This keeps only the clicked tab', labels.length === 1 && labels[0] === 'sample.txt',
        JSON.stringify(labels));

    // View > Tab Bar > Draw Close Button toggles the draw-close-button class.
    await clickSubMenuItem(page, 'View', 'Tab Bar', 'Draw Close Button');
    assert('draw close button toggled off', !(await bodyClass(page, 'notepadia-tabclose-all')));
    await clickSubMenuItem(page, 'View', 'Tab Bar', 'Draw Close Button');
    assert('draw close button toggled back on', await bodyClass(page, 'notepadia-tabclose-all'));

    await closeMenus(page);
    assert('no page errors', errors.length === 0, JSON.stringify(errors));
    await finish(browser);
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });