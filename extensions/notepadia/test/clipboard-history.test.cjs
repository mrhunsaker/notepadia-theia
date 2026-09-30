'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    addClipboardEntry,
    clipboardEntryPreview,
    CLIPBOARD_HISTORY_LIMIT
} = require('../lib/common/clipboard-history.js');

describe('addClipboardEntry', () => {

    it('puts the newest copy first', () => {
        assert.deepEqual(addClipboardEntry(['old'], 'new'), ['new', 'old']);
    });

    it('ignores a copy of nothing', () => {
        assert.deepEqual(addClipboardEntry(['old'], ''), ['old']);
    });

    it('moves a re-copied entry back to the top instead of duplicating it', () => {
        assert.deepEqual(addClipboardEntry(['c', 'b', 'a'], 'a'), ['a', 'c', 'b']);
    });

    it('keeps the same entry from being added twice in a row', () => {
        assert.deepEqual(addClipboardEntry(['x'], 'x'), ['x']);
    });

    it('drops the oldest entry once the limit is reached', () => {
        const full = Array.from({ length: CLIPBOARD_HISTORY_LIMIT }, (_, i) => `e${i}`);
        const next = addClipboardEntry(full, 'new');
        assert.equal(next.length, CLIPBOARD_HISTORY_LIMIT);
        assert.equal(next[0], 'new');
        // A full list plus the new copy is one too many, so the entry that was
        // oldest - e19 - is the one that goes, and e0 stays.
        assert.equal(next.includes(`e${CLIPBOARD_HISTORY_LIMIT - 1}`), false);
        assert.equal(next[next.length - 1], `e${CLIPBOARD_HISTORY_LIMIT - 2}`);
    });

    it('honours a smaller limit', () => {
        assert.deepEqual(addClipboardEntry(['a', 'b'], 'c', 2), ['c', 'a']);
    });

    it('keeps a copy that is only whitespace', () => {
        assert.deepEqual(addClipboardEntry([], '  '), ['  ']);
    });

    it('is a no-op with a limit of zero', () => {
        assert.deepEqual(addClipboardEntry(['a'], 'b', 0), ['a']);
    });
});

describe('clipboardEntryPreview', () => {

    it('collapses a multi-line copy onto one line', () => {
        assert.equal(clipboardEntryPreview('function a() {\n    return 1;\n}\n'), 'function a() { return 1; }');
    });

    it('trims the result', () => {
        assert.equal(clipboardEntryPreview('  padded  '), 'padded');
    });

    it('keeps a short entry whole', () => {
        assert.equal(clipboardEntryPreview('short'), 'short');
    });

    it('cuts a long entry with an ellipsis', () => {
        const preview = clipboardEntryPreview('x'.repeat(100));
        assert.equal(preview.length, 60);
        assert.ok(preview.endsWith('…'));
    });

    it('honours a custom length', () => {
        assert.equal(clipboardEntryPreview('abcdef', 4), 'abc…');
    });

    it('returns nothing for a zero length', () => {
        assert.equal(clipboardEntryPreview('abcdef', 0), '');
    });
});
