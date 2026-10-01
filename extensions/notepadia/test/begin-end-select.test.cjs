'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    samePosition,
    anchorSelection,
    shouldExtend,
    isPlainNavigation
} = require('../lib/common/begin-end-select.js');

// The numeric values Monaco 1.75 uses; kept literal so the test does not need
// a monaco import.
const KEY = { Left: 15, Up: 16, Right: 17, Down: 18, Home: 14, End: 13,
    PageUp: 11, PageDown: 12, KeyA: 65 };
const NAV = new Set([KEY.Left, KEY.Up, KEY.Right, KEY.Down,
    KEY.Home, KEY.End, KEY.PageUp, KEY.PageDown]);

const P = (lineNumber, column) => ({ lineNumber, column });

describe('samePosition', () => {

    it('is true for two identical positions', () => {
        assert.equal(samePosition(P(1, 5), P(1, 5)), true);
    });

    it('is false for a different column or line', () => {
        assert.equal(samePosition(P(1, 5), P(1, 6)), false);
        assert.equal(samePosition(P(1, 5), P(2, 5)), false);
    });

    it('is false when either side is missing', () => {
        assert.equal(samePosition(undefined, P(1, 5)), false);
        assert.equal(samePosition(P(1, 5), undefined), false);
        assert.equal(samePosition(undefined, undefined), false);
    });
});

describe('anchorSelection', () => {

    it('puts the anchor first and the caret second', () => {
        assert.deepEqual(anchorSelection(P(1, 5), P(3, 2)), [P(1, 5), P(3, 2)]);
    });

    it('does not reorder a backwards selection, so it reads left to right', () => {
        assert.deepEqual(anchorSelection(P(3, 2), P(1, 5)), [P(3, 2), P(1, 5)]);
    });

    it('collapses to a single point when the caret is on the anchor', () => {
        assert.deepEqual(anchorSelection(P(2, 3), P(2, 3)), [P(2, 3), P(2, 3)]);
    });
});

describe('shouldExtend', () => {

    it('extends on a caret move the user made', () => {
        assert.equal(shouldExtend({
            anchored: true, extending: false, caret: P(2, 5), lastExtended: P(1, 5)
        }), true);
    });

    it('ignores the echo of its own previous extension', () => {
        // The regression: setSelection reports the caret it just installed, and
        // extending from that a second time is what made one ArrowRight move
        // the caret four columns.
        assert.equal(shouldExtend({
            anchored: true, extending: false, caret: P(1, 5), lastExtended: P(1, 5)
        }), false);
    });

    it('extends again once the caret moves on from the echoed position', () => {
        assert.equal(shouldExtend({
            anchored: true, extending: false, caret: P(1, 6), lastExtended: P(1, 5)
        }), true);
    });

    it('never extends with no anchor, while re-arming, or with no caret', () => {
        assert.equal(shouldExtend({ anchored: false, extending: false, caret: P(1, 6) }), false);
        assert.equal(shouldExtend({ anchored: true, extending: true, caret: P(1, 6) }), false);
        assert.equal(shouldExtend({ anchored: true, extending: false }), false);
    });

    it('extends the first move after arming, when nothing has been echoed yet', () => {
        assert.equal(shouldExtend({
            anchored: true, extending: false, caret: P(1, 5), lastExtended: undefined
        }), true);
    });
});

describe('isPlainNavigation', () => {

    const nav = (keyCode, shiftKey) =>
        isPlainNavigation({ keyCode, shiftKey, navigationKeyCodes: NAV });

    it('recognises the caret-moving keys', () => {
        for (const code of [KEY.Left, KEY.Right, KEY.Up, KEY.Down,
            KEY.Home, KEY.End, KEY.PageUp, KEY.PageDown]) {
            assert.equal(nav(code), true, `keyCode ${code} should be plain navigation`);
        }
    });

    it('ignores keys that do not move the caret', () => {
        assert.equal(nav(KEY.KeyA), false);
    });

    it('leaves Shift+navigation to Monaco, which already extends', () => {
        // Collapsing first would fight Monaco's own Shift handling.
        assert.equal(nav(KEY.Right, true), false);
        assert.equal(nav(KEY.Left, true), false);
    });

    it('recognises Ctrl+Home, a plain caret move that must be measured from the caret', () => {
        // The regression: Ctrl+Home then ArrowRight moved the caret four
        // columns, to the anchor, because the range had not been collapsed.
        assert.equal(nav(KEY.Home), true);
    });

    it('is false when no navigation keys are supplied', () => {
        assert.equal(isPlainNavigation({
            keyCode: KEY.Right, navigationKeyCodes: new Set()
        }), false);
    });
});
