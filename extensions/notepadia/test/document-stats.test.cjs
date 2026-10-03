'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    countWords,
    documentStats,
    summaryRows,
    summaryAsStatusFields
} = require('../lib/common/document-stats.js');

describe('countWords', () => {
    it('counts an empty document as zero words', () => {
        assert.equal(countWords(''), 0);
    });
    it('counts whitespace-only text as zero words', () => {
        assert.equal(countWords('   \n\t\r\n  '), 0);
    });
    it('counts single words', () => {
        assert.equal(countWords('hello'), 1);
    });
    it('counts separated words', () => {
        assert.equal(countWords('hello world'), 2);
    });
    it('collapses runs of whitespace between words', () => {
        assert.equal(countWords('hello    world'), 2);
        assert.equal(countWords('  hello \n\t world  '), 2);
    });
    it('treats punctuation as a separator, not part of a word', () => {
        assert.equal(countWords('a,b'), 2);
        assert.equal(countWords('one;two:three'), 3);
        assert.equal(countWords('end.'), 1);
        assert.equal(countWords('...'), 0);
    });
    it('counts apostrophes and hyphens as separators, as Notepad++ does', () => {
        assert.equal(countWords("don't"), 2);
        assert.equal(countWords('well-known'), 2);
    });
    it('does not merge words across a line break', () => {
        assert.equal(countWords('alpha\nbeta'), 2);
    });
    it('counts numbers and mixed alphanumerics as words', () => {
        assert.equal(countWords('123'), 1);
        assert.equal(countWords('abc123'), 1);
    });
    it('counts non-Latin scripts', () => {
        assert.equal(countWords('日本語'), 1);
        assert.equal(countWords('привет мир'), 2);
    });
});

describe('documentStats', () => {
    it('reports characters, lines and words for a whole document', () => {
        const stats = documentStats({ text: 'one two\nthree', lineCount: 2 });
        assert.equal(stats.characters, 13);
        assert.equal(stats.lines, 2);
        assert.equal(stats.words, 3);
    });
    it('omits selection figures when no selection is supplied', () => {
        const stats = documentStats({ text: 'hello', lineCount: 1 });
        assert.equal(stats.selectedCharacters, 0);
        assert.equal(stats.selectedLines, 0);
        assert.equal(stats.selectedWords, undefined);
    });
    it('reports selection figures when a selection is supplied', () => {
        const stats = documentStats({
            text: 'one two three',
            lineCount: 1,
            selectedText: 'two',
            selectedLineCount: 1
        });
        assert.equal(stats.selectedCharacters, 3);
        assert.equal(stats.selectedLines, 1);
        assert.equal(stats.selectedWords, 1);
    });
    it('distinguishes an empty selection from an absent one', () => {
        const stats = documentStats({
            text: 'hello',
            lineCount: 1,
            selectedText: '',
            selectedLineCount: 0
        });
        assert.equal(stats.selectedWords, 0);
    });
    it('defaults missing selected line spans to zero', () => {
        const stats = documentStats({ text: 'a b', lineCount: 1, selectedText: 'a b' });
        assert.equal(stats.selectedLines, 0);
        assert.equal(stats.selectedWords, 2);
    });
});

describe('summaryRows', () => {
    it('shows only document rows when nothing is selected', () => {
        const rows = summaryRows(documentStats({ text: 'one two', lineCount: 1 }));
        assert.deepEqual(rows, [
            { label: 'Characters', value: '7' },
            { label: 'Words', value: '2' }
        ]);
    });
    it('adds selection rows when a selection is present', () => {
        const rows = summaryRows(documentStats({
            text: 'one two three',
            lineCount: 1,
            selectedText: 'two three',
            selectedLineCount: 1
        }));
        assert.deepEqual(rows, [
            { label: 'Characters', value: '13' },
            { label: 'Words', value: '3' },
            { label: 'Selected characters', value: '9' },
            { label: 'Selected words', value: '2' }
        ]);
    });
    it('groups large numbers', () => {
        const rows = summaryRows(documentStats({ text: 'x'.repeat(12345), lineCount: 1 }));
        assert.equal(rows[0].value, '12,345');
        assert.equal(rows[1].value, '1');
    });
});

describe('summaryAsStatusFields', () => {
    it('reuses the status bar formatters for the same figures', () => {
        const stats = documentStats({
            text: 'one two three',
            lineCount: 3,
            selectedText: 'two',
            selectedLineCount: 1
        });
        assert.deepEqual(summaryAsStatusFields(stats), {
            length: 'length : 13  lines : 3',
            selection: 'Sel : 3 | 1'
        });
    });
});