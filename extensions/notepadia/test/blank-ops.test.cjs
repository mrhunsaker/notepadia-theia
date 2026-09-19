'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    tabsToSpaces,
    spacesToTabs,
    trimLeadingAndTrailing,
    trimTrailing,
    eolToSpace,
    removeUnnecessaryEol,
    splitLines,
    wrapLine,
    removeConsecutiveDuplicateLines
} = require('../lib/common/blank-ops.js');

describe('tabsToSpaces', () => {
    it('expands a tab at column 0 to a full tab stop', () => {
        assert.equal(tabsToSpaces('\t', 4), '    ');
        assert.equal(tabsToSpaces('\t', 2), '  ');
    });
    it('expands a tab to the next column stop', () => {
        assert.equal(tabsToSpaces('abc\t', 4), 'abc ');
        assert.equal(tabsToSpaces('ab\t', 4), 'ab  ');
    });
    it('counts every non-tab as one column including mid-line tabs', () => {
        assert.equal(tabsToSpaces('a\tb', 4), 'a   b');
        assert.equal(tabsToSpaces('a\t\tb', 4), 'a       b');
    });
    it('leaves a tab-free line untouched', () => {
        assert.equal(tabsToSpaces('plain text', 4), 'plain text');
    });
});

describe('spacesToTabs', () => {
    it('turns full leading tab stops into tabs', () => {
        assert.equal(spacesToTabs('    x', 4), '\tx');
        assert.equal(spacesToTabs('        x', 4), '\t\tx');
    });
    it('keeps the remainder spaces after the last full stop', () => {
        assert.equal(spacesToTabs('     x', 4), '\t x');
        assert.equal(spacesToTabs('  x', 4), '  x');
    });
    it('accounts for a leading tab as a full stop', () => {
        assert.equal(spacesToTabs('\t x', 4), '\t x');
        assert.equal(spacesToTabs('\t   x', 4), '\t   x');
        assert.equal(spacesToTabs('\t \tx', 4), '\t\tx');
    });
    it('leaves the rest of the line untouched', () => {
        assert.equal(spacesToTabs('  a b  ', 4), '  a b  ');
    });
});

describe('trimLeadingAndTrailing', () => {
    it('trims both ends of every line', () => {
        assert.deepEqual(trimLeadingAndTrailing(['  a  ', '\tb\t', '  c']), ['a', 'b', 'c']);
    });
    it('handles empty lines and empties', () => {
        assert.deepEqual(trimLeadingAndTrailing([]), []);
        assert.deepEqual(trimLeadingAndTrailing(['   ']), ['']);
    });
});

describe('trimTrailing', () => {
    it('strips trailing spaces and tabs only', () => {
        assert.deepEqual(trimTrailing(['a  ', 'b\t\t', '  c  ']), ['a', 'b', '  c']);
    });
    it('does not touch leading whitespace', () => {
        assert.deepEqual(trimTrailing(['   x   ']), ['   x']);
    });
});

describe('eolToSpace', () => {
    it('joins every line with a single space', () => {
        assert.deepEqual(eolToSpace(['one', 'two', 'three']), ['one two three']);
    });
    it('handles empty lines as empty tokens', () => {
        assert.deepEqual(eolToSpace(['a', '', 'b']), ['a  b']);
    });
});

describe('removeUnnecessaryEol', () => {
    it('strips trailing whitespace on every line', () => {
        assert.deepEqual(removeUnnecessaryEol(['a  ', '\tb']), ['a', '\tb']);
    });
    it('collapses consecutive empty lines into one', () => {
        assert.deepEqual(removeUnnecessaryEol(['a', '', '', 'b']), ['a', '', 'b']);
    });
    it('keeps the first empty line of a block', () => {
        assert.deepEqual(removeUnnecessaryEol(['', '', 'a']), ['', 'a']);
    });
    it('keeps a single trailing empty line at the end of the file', () => {
        assert.deepEqual(removeUnnecessaryEol(['a', '']), ['a', '']);
        assert.deepEqual(removeUnnecessaryEol(['a', '', '']), ['a', '']);
    });
});

describe('wrapLine / splitLines', () => {
    it('breaks on the last space at or before the column', () => {
        assert.deepEqual(splitLines(['one two three'], 10), ['one two', 'three']);
    });
    it('breaks a single over-long word mid-word', () => {
        assert.deepEqual(splitLines(['abcdefghijklmno'], 5), ['abcde', 'fghij', 'klmno']);
    });
    it('keeps short lines and preserves an empty input line', () => {
        assert.deepEqual(splitLines(['short', '', 'ok'], 80), ['short', '', 'ok']);
    });
    it('does not alter leading spaces at a break', () => {
        assert.deepEqual(splitLines(['a b c d'], 4), ['a b', 'c d']);
    });
    it('emits remaining content after the last break', () => {
        assert.deepEqual(wrapLine('aa bb cc', 5), ['aa', 'bb cc']);
    });
});

describe('removeConsecutiveDuplicateLines', () => {
    it('removes duplicates only when consecutive', () => {
        assert.deepEqual(
            removeConsecutiveDuplicateLines(['a', 'a', 'b', 'a', 'b', 'b']),
            ['a', 'b', 'a', 'b']
        );
    });
    it('collapses consecutive empty lines', () => {
        assert.deepEqual(removeConsecutiveDuplicateLines(['', '', 'a', '']), ['', 'a', '']);
    });
});