'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    resolveSearch,
    describeMatchCount,
    addHistory,
    FIND_HISTORY_LIMIT,
    DEFAULT_FIND_OPTIONS
} = require('../lib/common/find-options.js');

describe('resolveSearch - search modes', () => {
    it('normal mode searches the term verbatim without regex', () => {
        const r = resolveSearch('foo.bar', 'normal');
        assert.equal(r.term, 'foo.bar');
        assert.equal(r.isRegex, false);
    });
    it('normal mode keeps regex metacharacters literal', () => {
        const r = resolveSearch('[x](y) *+', 'normal');
        assert.equal(r.term, '[x](y) *+');
        assert.equal(r.isRegex, false);
    });
    it('regex mode passes the term through as a regular expression', () => {
        const r = resolveSearch('foo\\d+', 'regex');
        assert.equal(r.term, 'foo\\d+');
        assert.equal(r.isRegex, true);
    });
    it('extended mode decodes the Notepad++ escape table to a literal', () => {
        const r = resolveSearch('a\\tb', 'extended');
        assert.equal(r.term, 'a\tb');
        assert.equal(r.isRegex, false);
    });
    it('extended mode decodes \\n, \\r, \\0 and \\\\', () => {
        assert.equal(resolveSearch('a\\nb', 'extended').term, 'a\nb');
        assert.equal(resolveSearch('a\\rb', 'extended').term, 'a\rb');
        assert.equal(resolveSearch('\\0', 'extended').term.charCodeAt(0), 0);
        assert.equal(resolveSearch('a\\\\b', 'extended').term, 'a\\b');
    });
    it('extended mode keeps regex metacharacters literal', () => {
        assert.equal(resolveSearch('a.b', 'extended').isRegex, false);
        assert.equal(resolveSearch('a.b', 'extended').term, 'a.b');
    });
});

describe('describeMatchCount - status line format', () => {
    it('reports the selection index within the result set', () => {
        assert.equal(describeMatchCount(4, 1), '1 of 4');
    });
    it('reports zero when nothing is selected yet', () => {
        assert.equal(describeMatchCount(4, 0), '0 of 4');
    });
    it('returns No results for an empty result set', () => {
        assert.equal(describeMatchCount(0, 0), 'No results');
    });
});

describe('addHistory - Find dialog history', () => {
    it('prepends new entries', () => {
        assert.deepEqual(addHistory(['b', 'a'], 'c'), ['c', 'b', 'a']);
    });
    it('moves an existing entry to the front', () => {
        assert.deepEqual(addHistory(['b', 'a'], 'a'), ['a', 'b']);
    });
    it('does not store empty or whitespace-only entries', () => {
        assert.deepEqual(addHistory(['a'], ''), ['a']);
        assert.deepEqual(addHistory(['a'], '   '), ['a']);
    });
    it('stores trimmed values', () => {
        assert.deepEqual(addHistory(['a'], '  foo  '), ['foo', 'a']);
    });
    it('caps the list at FIND_HISTORY_LIMIT', () => {
        const seed = Array.from({ length: FIND_HISTORY_LIMIT }, (_, i) => 'e' + i);
        const next = addHistory(seed, 'new');
        assert.equal(next.length, FIND_HISTORY_LIMIT);
        assert.equal(next[0], 'new');
        assert.equal(next.includes('e' + (FIND_HISTORY_LIMIT - 1)), false);
    });
});

describe('DEFAULT_FIND_OPTIONS', () => {
    it('defaults to a normal, wrapping, case-insensitive literal search', () => {
        const d = DEFAULT_FIND_OPTIONS;
        assert.equal(d.mode, 'normal');
        assert.equal(d.wrap, true);
        assert.equal(d.caseSensitive, false);
        assert.equal(d.wholeWord, false);
        assert.equal(d.backward, false);
        assert.equal(d.dotMatchesNewline, false);
        assert.equal(d.inSelection, false);
        assert.equal(d.term, '');
        assert.equal(d.replace, '');
    });
});