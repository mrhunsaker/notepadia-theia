const { sleep, launchPage, goto } = require('./lib.js');

async function outline(page, rootSel, maxDepth) {
    return page.evaluate(([rootSel, maxDepth]) => {
        const roots = Array.from(document.querySelectorAll(rootSel));
        const lines = [];
        const walk = (el, depth) => {
            if (depth > maxDepth) return;
            const id = el.id ? '#' + el.id : '';
            const cls = typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : '';
            const aria = el.getAttribute('aria-label') ? ' {' + el.getAttribute('aria-label') + '}' : '';
            lines.push('  '.repeat(depth) + el.tagName.toLowerCase() + id + cls + aria);
            for (const c of el.children) walk(c, depth + 1);
        };
        for (const r of roots) walk(r, 0);
        return lines;
    }, [rootSel, maxDepth]);
}

(async () => {
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await goto(page);
    const regions = ['#theia-top-panel', '.theia-app-sides', '.theia-app-side .theia-app-left', '.theia-app-side .theia-app-right', '#theia-statusBar', '.theia-breadcrumbs', '.monaco-editor'];
    for (const sel of regions) {
        const present = await page.$(sel);
        console.log(`\n### region ${sel} present=${!!present}`);
        if (present) {
            const tree = await outline(page, sel, 3);
            console.log(tree.slice(0, 60).join('\n'));
        }
        await sleep(100);
    }
    const probs = await page.evaluate(() => ({
        appSideCount: document.querySelectorAll('.theia-app-side').length,
        leftTabBar: !!document.querySelector('.theia-app-left .p-TabBar'),
        rightTabBar: !!document.querySelector('.theia-app-right .p-TabBar'),
        statusChildren: Array.from(document.querySelectorAll('#theia-statusBar > *')).map(e => e.className).filter(Boolean).slice(0, 20)
    }));
    console.log('\nactions:', JSON.stringify(probs, null, 1));
    console.log('errors:', JSON.stringify(errors));
    await browser.close();
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });