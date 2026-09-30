'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { columnBlockSelections } = require('../lib/common/column-block.js');

/** Four 6-character lines: maxColumn 7 each, 1-based line 1..4. */
const RECT = {
    startLine: 1,
    endLine: 4,
    startColumn: 2,
    endColumn: 4,
    lineCount: 4,
    lineMaxColumns: [7, 7, 7, 7]
};

describe('columnBlockSelections', () => {

    it('gives every line of the block the same columns', () => {
        assert.deepEqual(columnBlockSelections(RECT), [
            { line: 1, startColumn: 2, endColumn: 4 },
            { line: 2, startColumn: 2, endColumn: 4 },
            { line: 3, startColumn: 2, endColumn: 4 },
            { line: 4, startColumn: 2, endColumn: 4 }
        ]);
    });

    it('starts and ends on the same line', () => {
        assert.deepEqual(
            columnBlockSelections({ ...RECT, startLine: 2, endLine: 2 }),
            [{ line: 2, startColumn: 2, endColumn: 4 }]);
    });

    it('reorders a selection made upwards', () => {
        assert.deepEqual(columnBlockSelections({ ...RECT, startLine: 3, endLine: 1, startColumn: 4, endColumn: 2 }), [
            { line: 1, startColumn: 2, endColumn: 4 },
            { line: 2, startColumn: 2, endColumn: 4 },
            { line: 3, startColumn: 2, endColumn: 4 }
        ]);
    });

    it('clips a line that is shorter than the block', () => {
        assert.deepEqual(
            columnBlockSelections({ ...RECT, lineCount: 3, lineMaxColumns: [7, 3, 7] }),
            [
                { line: 1, startColumn: 2, endColumn: 4 },
                { line: 2, startColumn: 2, endColumn: 3 },
                { line: 3, startColumn: 2, endColumn: 4 }
            ]);
    });

    it('leaves a line with one column as a caret', () => {
        assert.deepEqual(
            columnBlockSelections({ ...RECT, lineCount: 3, lineMaxColumns: [7, 1, 7] }),
            [
                { line: 1, startColumn: 2, endColumn: 4 },
                { line: 2, startColumn: 1, endColumn: 1 },
                { line: 3, startColumn: 2, endColumn: 4 }
            ]);
    });

    it('skips the empty line a trailing newline leaves behind', () => {
        // "a\nb\n" is 3 lines, the third of them empty.
        assert.deepEqual(
            columnBlockSelections({ ...RECT, lineCount: 3, lineMaxColumns: [2, 2, 1] }),
            [
                { line: 1, startColumn: 1, endColumn: 2 },
                { line: 2, startColumn: 1, endColumn: 2 }
            ]);
    });

    it('turns a bare caret into a block out to the end of its line', () => {
        assert.deepEqual(
            columnBlockSelections({ ...RECT, startLine: 2, endLine: 2, startColumn: 3, endColumn: 3, caretOnly: true }),
            [{ line: 2, startColumn: 3, endColumn: 7 }]);
    });

    it('keeps a caret at the end of a line a caret', () => {
        assert.deepEqual(
            columnBlockSelections({ ...RECT, startLine: 1, endLine: 1, startColumn: 7, endColumn: 7, caretOnly: true }),
            [{ line: 1, startColumn: 7, endColumn: 7 }]);
    });

    it('never returns a selection past the end of a line', () => {
        for (const block of columnBlockSelections({ ...RECT, startColumn: 40, endColumn: 60 })) {
            assert.ok(block.endColumn <= 7, JSON.stringify(block));
            assert.ok(block.startColumn >= 1, JSON.stringify(block));
            assert.ok(block.endColumn >= block.startColumn, JSON.stringify(block));
        }
    });

    it('clamps a block that points past the end of the document', () => {
        assert.deepEqual(
            columnBlockSelections({ ...RECT, startLine: 0, endLine: 99 }),
            [
                { line: 1, startColumn: 2, endColumn: 4 },
                { line: 2, startColumn: 2, endColumn: 4 },
                { line: 3, startColumn: 2, endColumn: 4 },
                { line: 4, startColumn: 2, endColumn: 4 }
            ]);
    });

    it('returns nothing for a document with no lines', () => {
        assert.deepEqual(columnBlockSelections({ ...RECT, lineCount: 0, lineMaxColumns: [] }), []);
    });

    it('survives a missing line-length entry', () => {
        assert.deepEqual(
            columnBlockSelections({ ...RECT, lineCount: 4, lineMaxColumns: [7, 7] }),
            [
                { line: 1, startColumn: 2, endColumn: 4 },
                { line: 2, startColumn: 2, endColumn: 4 },
                { line: 3, startColumn: 1, endColumn: 1 }
            ]);
    });
});
