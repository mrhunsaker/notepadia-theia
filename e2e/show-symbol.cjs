// C3 - `View > Show Symbol`.
//
// Every entry is asserted by the effect it has on the editor rather than by the
// command firing: a checkbox that toggles without changing what is drawn is not
// a feature. Sample.txt is 'alpha\nbeta\ngamma\n', which has no whitespace to
// reveal and no indentation, so 'blank-tab.txt' (leading tabs and spaces) is
// used for the markers that need something to mark.
//
// The three markers have three different DOM shapes in Monaco, and none of them
// is obvious:
//   - space/tab markers are `.mwh` elements, but only when
//     `editor.experimentalWhitespaceRendering` is `font`; its default `svg`
//     draws them into an SVG overlay instead,
//   - the end-of-line glyph is an empty `.notepadia-eol-glyph` span whose
//     character comes from a `::after` rule in the Notepadia stylesheet,
//   - indent guides are `.core-guide` elements.
const { assert, finish, sleep, launchPage, goto, openFile,
    openMenuBar, hoverByLabel, clickByLabel, closeMenus } = require('./lib.js');

/** The visible editor, so a second pane cannot satisfy an assertion. */
const VISIBLE_EDITOR = `Array.from(document.querySelectorAll('.monaco-editor')).find(e => e.getBoundingClientRect().width > 0)`;

/** Space and tab markers drawn in the visible editor. */
function whitespaceMarkers(page) {
    return page.evaluate(`(() => { const ed = ${VISIBLE_EDITOR}; return ed ? ed.querySelectorAll('.mwh').length : -1; })()`);
}

/** End-of-line glyph spans added by the Show End of Line decoration. */
function eolGlyphs(page) {
    return page.evaluate(() => document.querySelectorAll('.notepadia-eol-glyph').length);
}

/** Indent guides drawn in the visible editor. */
function indentGuides(page) {
    return page.evaluate(`(() => { const ed = ${VISIBLE_EDITOR}; return ed ? ed.querySelectorAll('.core-guide').length : -1; })()`);
}

/** Toggle one Show Symbol entry and close the menu. */
async function toggle(page, label) {
    await openMenuBar(page, 'View');
    await hoverByLabel(page, 'Show Symbol');
    await sleep(600);
    await clickByLabel(page, label);
    await closeMenus(page);
    await sleep(1200);
}

(async () => {
    const { browser, page, errors } = await launchPage({ viewport: { width: 1440, height: 1000 } });
    await goto(page);

    // A cold profile starts with the space/tab and end-of-line markers off,
    // which is what Notepad++ does, and indent guides on, which is Monaco's
    // own default and was left that way deliberately.
    await openFile(page, 'blank-tab.txt');
    assert('Show End of Line is off on a cold profile', await eolGlyphs(page) === 0,
        'glyphs=' + await eolGlyphs(page));
    assert('Show Space and TAB is off on a cold profile', await whitespaceMarkers(page) === 0,
        'markers=' + await whitespaceMarkers(page));
    assert('Show Indent Guide is on on a cold profile', await indentGuides(page) > 0,
        'guides=' + await indentGuides(page));

    await toggle(page, 'Show Space and TAB');
    const markersOn = await whitespaceMarkers(page);
    assert('Show Space and TAB draws whitespace markers', markersOn > 0, 'markers=' + markersOn);

    await toggle(page, 'Show Space and TAB');
    assert('Show Space and TAB can be turned back off', await whitespaceMarkers(page) === 0,
        'markers=' + await whitespaceMarkers(page));

    await toggle(page, 'Show End of Line');
    const glyphsOn = await eolGlyphs(page);
    assert('Show End of Line draws an end-of-line glyph on every line', glyphsOn > 0,
        'glyphs=' + glyphsOn);

    await toggle(page, 'Show End of Line');
    assert('Show End of Line can be turned back off', await eolGlyphs(page) === 0,
        'glyphs=' + await eolGlyphs(page));

    await toggle(page, 'Show Indent Guide');
    assert('Show Indent Guide can be turned off', await indentGuides(page) === 0,
        'guides=' + await indentGuides(page));

    await toggle(page, 'Show Indent Guide');
    const guidesBackOn = await indentGuides(page);
    assert('Show Indent Guide draws indent guides', guidesBackOn > 0, 'guides=' + guidesBackOn);

    // Show All Characters is the umbrella switch: it turns the whitespace
    // markers and the end-of-line glyph on together, as Notepad++'s single
    // checkbox does.
    await toggle(page, 'Show All Characters');
    const umbrellaMarkers = await whitespaceMarkers(page);
    const umbrellaGlyphs = await eolGlyphs(page);
    assert('Show All Characters turns on the whitespace markers', umbrellaMarkers > 0,
        'markers=' + umbrellaMarkers);
    assert('Show All Characters turns on the end-of-line glyph', umbrellaGlyphs > 0,
        'glyphs=' + umbrellaGlyphs);

    await toggle(page, 'Show All Characters');
    assert('Show All Characters turns the whitespace markers back off',
        await whitespaceMarkers(page) === 0, 'markers=' + await whitespaceMarkers(page));
    assert('Show All Characters turns the end-of-line glyph back off',
        await eolGlyphs(page) === 0, 'glyphs=' + await eolGlyphs(page));

    // The markers have to follow the setting to a newly opened tab, which is
    // the case a control-only implementation gets wrong.
    await toggle(page, 'Show End of Line');
    await openFile(page, 'foldable.txt');
    const glyphsNewTab = await eolGlyphs(page);
    assert('Show End of Line applies to a tab opened afterwards', glyphsNewTab > 0,
        'glyphs=' + glyphsNewTab);

    // Adding a line has to add a marker for it. The edit is undone so the
    // fixture is left exactly as it was found for the next run.
    const before = await eolGlyphs(page);
    await page.keyboard.down('Control');
    await page.keyboard.press('End');
    await page.keyboard.up('Control');
    await page.keyboard.press('Enter');
    await page.keyboard.type('new line');
    await sleep(900);
    const after = await eolGlyphs(page);
    assert('a new line gets its own end-of-line glyph', after > before,
        `before=${before} after=${after}`);
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyZ');
    await page.keyboard.press('KeyZ');
    await page.keyboard.up('Control');
    await sleep(600);

    await toggle(page, 'Show End of Line');
    assert('Show End of Line can be turned off after editing', await eolGlyphs(page) === 0,
        'glyphs=' + await eolGlyphs(page));

    assert('no page errors', errors.length === 0, JSON.stringify(errors));
    await finish(browser);
})().catch(e => { console.error('SCRIPT FAILED:', e.message); process.exit(1); });