// G1 - screenshot regression suite.
//
// Renders the running app at a fixed 1280x800 viewport, captures a small set of
// stable views, and pixel-diffs each against a committed baseline under
// e2e/baselines/. A styling regression therefore fails CI with a visible diff
// written to the failure artifact bundle (baseline / actual / diff PNGs).
//
// Baselines are refreshed deliberately, never implicitly: run with
// E2E_UPDATE_BASELINES=1 and commit the rewritten PNGs.
//
// This suite is the first entry in run.cjs SUITES so it captures a cold profile
// before any other suite mutates persisted preferences or layout.

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch');
const { launchPage, goto, openFile, sleep, assert, finish, waitFor } = require('./lib.js');

const BASELINE_DIR = path.join(__dirname, 'baselines');
const ARTIFACT_DIR = process.env.E2E_ARTIFACTS || path.join(__dirname, '..', 'e2e-artifacts');

// Fixed, device-pixel-ratio-1 viewport so the raster is reproducible.
const VIEWPORT = { width: 1280, height: 800, deviceScaleFactor: 1 };

// pixelmatch per-pixel colour distance and the share of the frame allowed to
// differ. The budget absorbs anti-aliasing/font-hinting jitter between the
// baseline host and CI while still catching a real styling change.
const PIXEL_THRESHOLD = 0.1;
const MAX_DIFF_RATIO = 0.02;

const UPDATE = process.env.E2E_UPDATE_BASELINES === '1';

// Remove the sources of nondeterminism that are not the UI under test: CSS
// animations/transitions, the blinking editor caret, and the fontconfig default
// fonts (the baseline host resolves fonts to Noto, the CI runner to DejaVu;
// pinning everything to DejaVu keeps glyph metrics identical). Code text is
// re-pinned to a monospace face below. Codicon glyphs are safe: they set their
// own font-family on pseudo-elements, which an element-level font does not
// reach. Native form controls (input/select/button use the UA default font) are
// covered by the universal rule.
async function stabilize(page) {
    await page.addStyleTag({
        content: `
            *, *::before, *::after {
                animation: none !important;
                transition: none !important;
                font-family: 'DejaVu Sans', 'Liberation Sans', sans-serif !important;
            }
            .monaco-editor .cursors-layer { visibility: hidden !important; }
            .monaco-editor .view-lines, .monaco-editor .view-line,
            .monaco-editor .margin-view-overlays, .monaco-editor .line-numbers,
            .monaco-editor textarea, .monaco-editor .inputarea {
                font-family: 'DejaVu Sans Mono', 'Liberation Mono', monospace !important;
            }
        `
    });
}

async function shot(page, name) {
    const actual = Buffer.from(await page.screenshot({ type: 'png' }));
    const baselinePath = path.join(BASELINE_DIR, name + '.png');

    if (UPDATE || !fs.existsSync(baselinePath)) {
        fs.mkdirSync(BASELINE_DIR, { recursive: true });
        fs.writeFileSync(baselinePath, actual);
        assert(`${name}: baseline ${UPDATE ? 'updated' : 'created'}`, true);
        return;
    }

    const base = PNG.sync.read(fs.readFileSync(baselinePath));
    const act = PNG.sync.read(actual);
    if (base.width !== act.width || base.height !== act.height) {
        assert(`${name}: screenshot dimensions stable`, false,
            `${base.width}x${base.height} != ${act.width}x${act.height}`);
        return;
    }

    const diff = new PNG({ width: base.width, height: base.height });
    const mismatched = pixelmatch(base.data, act.data, diff.data, base.width, base.height, {
        threshold: PIXEL_THRESHOLD
    });
    const ratio = mismatched / (base.width * base.height);
    const ok = ratio <= MAX_DIFF_RATIO;
    const pct = (ratio * 100).toFixed(3);
    assert(`${name}: screenshot matches baseline (${pct}% diff)`, ok, ok ? '' : `${mismatched} px differ`);

    if (!ok) {
        fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
        fs.writeFileSync(path.join(ARTIFACT_DIR, `baseline-${name}.png`), fs.readFileSync(baselinePath));
        fs.writeFileSync(path.join(ARTIFACT_DIR, `actual-${name}.png`), actual);
        fs.writeFileSync(path.join(ARTIFACT_DIR, `diff-${name}.png`), PNG.sync.write(diff));
    }
}

async function main() {
    const { browser, page } = await launchPage({ viewport: VIEWPORT });
    try {
        await goto(page);
        await waitFor(page, '.notepadia-toolbar', 30000, 'toolbar widget');
        await stabilize(page);

        // Main editor with the toolbar, menu bar and status bar visible.
        await openFile(page, 'app.js');
        await sleep(1200);
        await shot(page, 'main-editor');

        // Find dialog over the editor.
        await page.keyboard.down('Control');
        await page.keyboard.press('KeyF');
        await page.keyboard.up('Control');
        await waitFor(page, '.notepadia-find-panel', 10000, 'find dialog');
        await sleep(1200);
        await shot(page, 'find-dialog');
        await page.keyboard.press('Escape');
        await sleep(500);
    } finally {
        await finish(browser);
    }
}

main();
