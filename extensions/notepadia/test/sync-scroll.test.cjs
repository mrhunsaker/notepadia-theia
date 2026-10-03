'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    clamp,
    scrollableHeight,
    mirrorScrollTop,
    mirrorScrollLeft,
    shouldMirrorScroll,
    resolveMirrorTop,
    resolveMirrorLeft
} = require('../lib/common/sync-scroll.js');

describe('clamp', () => {
    it('keeps values inside the range', () => {
        assert.equal(clamp(5, 0, 10), 5);
    });
    it('clamps to the bounds', () => {
        assert.equal(clamp(-3, 0, 10), 0);
        assert.equal(clamp(42, 0, 10), 10);
    });
    it('collapses an inverted range to the minimum', () => {
        assert.equal(clamp(5, 10, 2), 10);
    });
});

describe('scrollableHeight', () => {
    it('is the total minus the viewport', () => {
        assert.equal(scrollableHeight(1000, 400), 600);
    });
    it('is zero when the content fits the viewport', () => {
        assert.equal(scrollableHeight(300, 400), 0);
    });
    it('is never negative', () => {
        assert.equal(scrollableHeight(100, 400), 0);
    });
});

describe('mirrorScrollTop', () => {
    it('mirrors exactly when both panes have the same scrollable height', () => {
        assert.equal(mirrorScrollTop({
            sourceScrollTop: 120,
            sourceTotalHeight: 1000,
            sourceViewportHeight: 400,
            targetTotalHeight: 1000,
            targetViewportHeight: 400
        }), 120);
    });
    it('mirrors by percentage when the panes differ in height', () => {
        // Source is halfway down its 600px of scroll; target can only travel 200.
        assert.equal(mirrorScrollTop({
            sourceScrollTop: 300,
            sourceTotalHeight: 1000,
            sourceViewportHeight: 400,
            targetTotalHeight: 600,
            targetViewportHeight: 400
        }), 100);
    });
    it('aligns the top of one document with the top of the other', () => {
        assert.equal(mirrorScrollTop({
            sourceScrollTop: 0,
            sourceTotalHeight: 1000,
            sourceViewportHeight: 400,
            targetTotalHeight: 3000,
            targetViewportHeight: 400
        }), 0);
    });
    it('aligns the bottom of one document with the bottom of the other', () => {
        assert.equal(mirrorScrollTop({
            sourceScrollTop: 600,
            sourceTotalHeight: 1000,
            sourceViewportHeight: 400,
            targetTotalHeight: 3000,
            targetViewportHeight: 400
        }), 2600);
    });
    it('is zero when the source cannot scroll', () => {
        assert.equal(mirrorScrollTop({
            sourceScrollTop: 0,
            sourceTotalHeight: 300,
            sourceViewportHeight: 400,
            targetTotalHeight: 3000,
            targetViewportHeight: 400
        }), 0);
    });
    it('is zero when the target cannot scroll', () => {
        assert.equal(mirrorScrollTop({
            sourceScrollTop: 300,
            sourceTotalHeight: 1000,
            sourceViewportHeight: 400,
            targetTotalHeight: 300,
            targetViewportHeight: 400
        }), 0);
    });
    it('clamps an out-of-range source offset', () => {
        assert.equal(mirrorScrollTop({
            sourceScrollTop: 9999,
            sourceTotalHeight: 1000,
            sourceViewportHeight: 400,
            targetTotalHeight: 1000,
            targetViewportHeight: 400
        }), 600);
    });
});

describe('mirrorScrollLeft', () => {
    it('mirrors exactly when both panes have the same scrollable width', () => {
        assert.equal(mirrorScrollLeft({
            sourceScrollLeft: 80,
            sourceScrollWidth: 1000,
            sourceViewportWidth: 400,
            targetScrollWidth: 1000,
            targetViewportWidth: 400
        }), 80);
    });
    it('mirrors by percentage when the widths differ', () => {
        assert.equal(mirrorScrollLeft({
            sourceScrollLeft: 300,
            sourceScrollWidth: 1000,
            sourceViewportWidth: 400,
            targetScrollWidth: 600,
            targetViewportWidth: 400
        }), 100);
    });
    it('is zero when there is nothing to scroll horizontally', () => {
        assert.equal(mirrorScrollLeft({
            sourceScrollLeft: 0,
            sourceScrollWidth: 300,
            sourceViewportWidth: 400,
            targetScrollWidth: 3000,
            targetViewportWidth: 400
        }), 0);
    });
});

describe('shouldMirrorScroll', () => {
    it('skips a write when the target is already where it should be', () => {
        assert.equal(shouldMirrorScroll({ targetScrollTop: 100, mirroredScrollTop: 100 }), false);
    });
    it('ignores sub-pixel differences', () => {
        assert.equal(shouldMirrorScroll({ targetScrollTop: 100.4, mirroredScrollTop: 100 }), false);
    });
    it('reports a real move', () => {
        assert.equal(shouldMirrorScroll({ targetScrollTop: 100, mirroredScrollTop: 240 }), true);
    });
});

describe('resolveMirrorTop', () => {
    const geometry = {
        sourceTotalHeight: 1000,
        sourceViewportHeight: 400,
        targetTotalHeight: 1000,
        targetViewportHeight: 400
    };
    it('does nothing when disabled, and leaves the offset alone', () => {
        assert.deepEqual(resolveMirrorTop({
            enabled: false,
            sourceScrollTop: 300,
            targetScrollTop: 42,
            ...geometry
        }), { scrollTop: 42, apply: false });
    });
    it('applies a move the target has not made yet', () => {
        assert.deepEqual(resolveMirrorTop({
            enabled: true,
            sourceScrollTop: 300,
            targetScrollTop: 0,
            ...geometry
        }), { scrollTop: 300, apply: true });
    });
    it('does not re-apply a move the target already made', () => {
        // This is the oscillation guard: the mirrored write has already landed.
        assert.deepEqual(resolveMirrorTop({
            enabled: true,
            sourceScrollTop: 300,
            targetScrollTop: 300,
            ...geometry
        }), { scrollTop: 300, apply: false });
    });
});

describe('resolveMirrorLeft', () => {
    it('does nothing when disabled', () => {
        assert.deepEqual(resolveMirrorLeft({
            enabled: false,
            sourceScrollLeft: 100,
            targetScrollLeft: 7,
            sourceScrollWidth: 1000,
            sourceViewportWidth: 400,
            targetScrollWidth: 1000,
            targetViewportWidth: 400
        }), { scrollLeft: 7, apply: false });
    });
    it('applies a horizontal move', () => {
        assert.deepEqual(resolveMirrorLeft({
            enabled: true,
            sourceScrollLeft: 150,
            targetScrollLeft: 0,
            sourceScrollWidth: 1000,
            sourceViewportWidth: 400,
            targetScrollWidth: 1000,
            targetViewportWidth: 400
        }), { scrollLeft: 150, apply: true });
    });
    it('does not re-apply a horizontal move already made', () => {
        assert.deepEqual(resolveMirrorLeft({
            enabled: true,
            sourceScrollLeft: 150,
            targetScrollLeft: 150,
            sourceScrollWidth: 1000,
            sourceViewportWidth: 400,
            targetScrollWidth: 1000,
            targetViewportWidth: 400
        }), { scrollLeft: 150, apply: false });
    });
});