'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
    AA_TEXT,
    AA_NON_TEXT,
    parseColor,
    relativeLuminance,
    contrastRatio,
    blend,
    rgbToHex,
    checkPair,
    checkPairs,
    themePairs
} = require('../lib/common/theme-contrast.js');

const THEME_DIR = path.join(__dirname, '..', 'src', 'browser', 'theme');
const TOOLBAR_CSS = path.join(__dirname, '..', 'src', 'browser', 'style', 'notepadia-toolbar.css');
const THEMES = ['notepadia-classic', 'notepadia-classic-dark', 'notepadia-high-contrast'];

/**
 * The toolbar greys disabled icons with a CSS opacity, and the contrast
 * audit has to know that number to judge them. Reading it out of the
 * stylesheet keeps the two from drifting: change the opacity and this test
 * sees the new value, or fails loudly if the rule was renamed.
 */
function disabledToolbarOpacity() {
    const css = fs.readFileSync(TOOLBAR_CSS, 'utf8');
    const rule = /\.notepadia-toolbar-button-disabled\s*\{([^}]*)\}/.exec(css);
    assert.ok(rule, 'the disabled toolbar rule must exist in notepadia-toolbar.css');
    const opacity = /opacity:\s*([\d.]+)/.exec(rule[1]);
    assert.ok(opacity, 'the disabled toolbar rule must set an opacity');
    return parseFloat(opacity[1]);
}

const loadTheme = name => JSON.parse(fs.readFileSync(path.join(THEME_DIR, `${name}.color-theme.json`), 'utf8'));

describe('parseColor', () => {
    it('reads six digit hex', () => {
        assert.deepEqual(parseColor('#767676'), { r: 118, g: 118, b: 118, a: 1 });
    });
    it('reads shorthand hex by doubling each digit', () => {
        assert.deepEqual(parseColor('#abc'), { r: 170, g: 187, b: 204, a: 1 });
    });
    it('reads alpha from eight digit hex and from rgba()', () => {
        assert.equal(parseColor('#00000080').a, 128 / 255);
        assert.equal(parseColor('rgba(0, 0, 0, 0.5)').a, 0.5);
    });
    it('reads rgb() with mixed spacing', () => {
        assert.deepEqual(parseColor('rgb(1, 2, 3)'), { r: 1, g: 2, b: 3, a: 1 });
        assert.deepEqual(parseColor('rgba(1 2 3 / 0.25)'), { r: 1, g: 2, b: 3, a: 0.25 });
    });
    it('rejects what is not a colour', () => {
        assert.equal(parseColor('not-a-colour'), undefined);
        assert.equal(parseColor('#12345'), undefined);
        assert.equal(parseColor('rgb(1, 2)'), undefined);
    });
});

describe('relativeLuminance', () => {
    it('anchors black and white at 0 and 1', () => {
        assert.equal(relativeLuminance({ r: 0, g: 0, b: 0, a: 1 }), 0);
        assert.equal(relativeLuminance({ r: 255, g: 255, b: 255, a: 1 }), 1);
    });
    it('treats channels below the knee linearly rather than as a power', () => {
        // 10/255 is 0.0392, just under the 0.03928 knee, so the channel is
        // divided by 12.92 and the three luminance weights sum to 1.
        assert.equal(relativeLuminance({ r: 10, g: 10, b: 10, a: 1 }), (10 / 255) / 12.92);
    });
});

describe('contrastRatio', () => {
    it('is 21 for black on white and 1 for a colour on itself', () => {
        assert.equal(Math.round(contrastRatio('#000000', '#FFFFFF')), 21);
        assert.equal(contrastRatio('#123456', '#123456'), 1);
    });
    it('is order independent', () => {
        assert.equal(contrastRatio('#767676', '#FFFFFF'), contrastRatio('#FFFFFF', '#767676'));
    });
    it('is null when a colour cannot be parsed', () => {
        assert.equal(contrastRatio('nope', '#FFFFFF'), null);
    });
});

describe('blend', () => {
    it('mixes a foreground over a background at an opacity', () => {
        assert.equal(blend('#000000', '#FFFFFF', 0.5), '#808080');
    });
    it('is the foreground at full opacity and the background at none', () => {
        assert.equal(blend('#112233', '#FFFFFF', 1), '#112233');
        assert.equal(blend('#112233', '#FFFFFF', 0), '#FFFFFF');
    });
});

describe('rgbToHex', () => {
    it('pads single digit channels and clamps out of range ones', () => {
        assert.equal(rgbToHex({ r: 1, g: 2, b: 3, a: 1 }), '#010203');
        assert.equal(rgbToHex({ r: 300, g: -20, b: 128, a: 1 }), '#FF0080');
    });
});

describe('checkPair', () => {
    const pair = (fg, bg, minimum) => ({ label: 'pair', foreground: fg, background: bg, minimum });

    it('passes at the threshold and fails just under it', () => {
        assert.equal(checkPair(pair('#FFFFFF', '#767676', AA_TEXT)).passes, true);
        assert.equal(checkPair(pair('#FFFFFF', '#808080', AA_TEXT)).passes, false);
    });
    it('reports the ratio it measured so a failure can be explained', () => {
        const result = checkPair(pair('#FFFFFF', '#767676', AA_TEXT));
        assert.ok(result.ratio >= AA_TEXT && result.ratio < AA_TEXT + 0.05, `unexpected ratio ${result.ratio}`);
    });
    it('fails rather than passing silently when a colour is unparseable', () => {
        assert.equal(checkPair(pair('nope', '#FFFFFF', AA_TEXT)).ratio, null);
        assert.equal(checkPair(pair('nope', '#FFFFFF', AA_TEXT)).passes, false);
    });
});

describe('shipped theme contrast', () => {
    for (const name of THEMES) {
        it(`${name} meets its minimum for every pair the app relies on`, () => {
            const theme = loadTheme(name);
            const opacity = disabledToolbarOpacity();
            const results = checkPairs(themePairs(theme.colors, opacity));
            const failures = results
                .filter(result => !result.passes)
                .map(result => `${result.pair.label}: ${result.ratio} < ${result.pair.minimum}`);
            assert.deepEqual(failures, [], `${name} contrast failures:\n  ${failures.join('\n  ')}`);
            assert.ok(results.length >= 14, `${name} should check at least 14 pairs, got ${results.length}`);
        });

        it(`${name} parses every colour the audit reads`, () => {
            const theme = loadTheme(name);
            for (const pair of themePairs(theme.colors, disabledToolbarOpacity())) {
                assert.ok(parseColor(pair.foreground), `${name}: cannot parse "${pair.foreground}" for ${pair.label}`);
                assert.ok(parseColor(pair.background), `${name}: cannot parse "${pair.background}" for ${pair.label}`);
            }
        });
    }

    it('keeps the disabled toolbar icon above the non-text floor', () => {
        const opacity = disabledToolbarOpacity();
        assert.ok(opacity >= 0.5, `disabled toolbar opacity ${opacity} is below the audited 0.5`);
        for (const name of THEMES) {
            const theme = loadTheme(name);
            const dimmed = themePairs(theme.colors, opacity).find(pair => pair.label.startsWith('disabled toolbar icon'));
            const result = checkPair(dimmed);
            assert.ok(result.passes && result.ratio >= AA_NON_TEXT,
                `${name} disabled toolbar icon is ${result.ratio}, below ${AA_NON_TEXT}`);
        }
    });

    it('gives the high contrast theme a black background and AAA text', () => {
        const colors = loadTheme('notepadia-high-contrast').colors;
        assert.equal(colors['editor.background'].toUpperCase(), '#000000');
        assert.ok(contrastRatio(colors['editor.foreground'], colors['editor.background']) >= 7,
            'high contrast editor text should reach AAA');
    });
});