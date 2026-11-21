'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    captureContextInText,
    hasUnbalancedRegexDelimiters,
    normalizeFileSearchPattern,
    resolveReplacement
} = require('../lib/common/find-options.js');

// The context mirrors what Monaco's FindMatch.matches and RegExp.exec produce:
// index 0 is the whole match, index n is capture group n.
const context = {
    match: 'foo=123',
    groups: ['foo=123', 'foo', '123'],
    named: { key: 'foo', value: '123' }
};

describe('resolveReplacement - search modes', () => {
    it('normal mode inserts the replacement verbatim', () => {
        assert.equal(resolveReplacement('\\1 $1 \\n', 'normal', context), '\\1 $1 \\n');
    });
    it('extended mode decodes the Notepad++ escape table', () => {
        assert.equal(resolveReplacement('a\\nb\\tc\\\\d\\x41', 'extended'), 'a\nb\tc\\dA');
    });
    it('extended mode ignores the match context', () => {
        assert.equal(resolveReplacement('$1', 'extended', context), '$1');
    });
});

describe('resolveReplacement - regex backreferences', () => {
    it('expands \\1 to the first captured group', () => {
        assert.equal(resolveReplacement('\\1', 'regex', context), 'foo');
    });
    it('expands $1 to the first captured group', () => {
        assert.equal(resolveReplacement('$1', 'regex', context), 'foo');
    });
    it('expands several groups in either syntax', () => {
        assert.equal(resolveReplacement('$2-\\1', 'regex', context), '123-foo');
        assert.equal(resolveReplacement('\\2=$2', 'regex', context), '123=123');
    });
    it('supports braced numeric references', () => {
        assert.equal(resolveReplacement('${2}${1}', 'regex', context), '123foo');
    });
    it('expands the whole match with \\0, $0 and $&', () => {
        assert.equal(resolveReplacement('[\\0]', 'regex', context), '[foo=123]');
        assert.equal(resolveReplacement('[$0]', 'regex', context), '[foo=123]');
        assert.equal(resolveReplacement('[$&]', 'regex', context), '[foo=123]');
    });
    it('expands named groups with both syntaxes', () => {
        assert.equal(resolveReplacement('$<value>:\\k<key>', 'regex', context), '123:foo');
        assert.equal(resolveReplacement('${value}', 'regex', context), '123');
    });
    it('turns a group that did not participate into an empty string', () => {
        const partial = { match: 'a', groups: ['a', 'a', undefined] };
        assert.equal(resolveReplacement('[\\2]', 'regex', partial), '[]');
        assert.equal(resolveReplacement('[$2]', 'regex', partial), '[]');
    });
    it('keeps a literal dollar and backslash when escaped', () => {
        assert.equal(resolveReplacement('$$\\1', 'regex', context), '$foo');
        assert.equal(resolveReplacement('\\\\1', 'regex', context), '\\1');
    });
    it('decodes control escapes in a regex replacement', () => {
        assert.equal(resolveReplacement('\\1\\n\\t', 'regex', context), 'foo\n\t');
    });
    it('prefers the longest group that exists', () => {
        const many = { match: 'x', groups: Array.from({ length: 13 }, (_, i) => 'g' + i) };
        assert.equal(resolveReplacement('\\12', 'regex', many), 'g12');
        assert.equal(resolveReplacement('$12', 'regex', many), 'g12');
    });
    it('falls back to the first digit when a longer group is absent', () => {
        assert.equal(resolveReplacement('\\20', 'regex', context), '1230');
        assert.equal(resolveReplacement('$20', 'regex', context), '1230');
    });
    it('passes unknown escapes and unmatched dollar signs through', () => {
        assert.equal(resolveReplacement('\\q$?', 'regex', context), '\\q$?');
    });
    it('is safe without a match context', () => {
        assert.equal(resolveReplacement('[\\1][$1][\\0]', 'regex'), '[][][]');
    });
    it('handles an empty replacement', () => {
        assert.equal(resolveReplacement('', 'regex', context), '');
    });
});

describe('captureContextInText - recovering groups from a match', () => {
    it('recovers named groups Monaco drops from FindMatch.matches', () => {
        const haystack = 'alice@example.com';
        const captured = captureContextInText(haystack, 0, '(?<user>\\w+)@(?<host>\\w+)', true, 'alice@example.com', ['alice@example.com']);
        assert.equal(resolveReplacement('$<user>，$<host>', 'regex', captured), 'alice，example');
        assert.equal(resolveReplacement('\\k<user>', 'regex', captured), 'alice');
        // \\w stops before the dot, so the match is 'alice@example'.
        assert.deepEqual(captured.groups, ['alice@example', 'alice', 'example']);
    });
    it('recovers groups for a multiline match', () => {
        const haystack = 'first\nsecond';
        const captured = captureContextInText(haystack, 0, '(\\w+)\\n(\\w+)', true, haystack);
        assert.equal(resolveReplacement('$2$1', 'regex', captured), 'secondfirst');
    });
    it('resolves ^ and $ against the whole line, not just the match', () => {
        const captured = captureContextInText('foo=123', 0, '^(\\w+)=(\\d+)$', true, 'foo=123');
        assert.equal(resolveReplacement('$2-$1', 'regex', captured), '123-foo');
    });
    it('honours Match case', () => {
        const captured = captureContextInText('Foo=123', 0, '^foo=', true, 'Foo=', ['fallback']);
        assert.deepEqual(captured.groups, ['fallback'], 'no case-insensitive fallback match');
    });
    it('keeps the supplied context when the regex cannot be parsed', () => {
        const fallback = { match: 'x', groups: ['x', 'x'] };
        const captured = captureContextInText('x', 0, '(?P<name>x)', true, 'x', fallback.groups);
        assert.equal(resolveReplacement('$1', 'regex', captured), 'x');
    });
});

describe('normalizeFileSearchPattern', () => {
    it('translates ripgrep named-group syntax for JavaScript', () => {
        assert.equal(normalizeFileSearchPattern('(?P<key>\\w+)=(?P<value>\\d+)'), '(?<key>\\w+)=(?<value>\\d+)');
    });
    it('leaves JavaScript patterns alone', () => {
        const pattern = '(?<key>\\w+)@\\w+';
        assert.equal(normalizeFileSearchPattern(pattern), pattern);
    });
});

describe('hasUnbalancedRegexDelimiters', () => {
    it('rejects an unclosed group before the backend hides it as no results', () => {
        assert.equal(hasUnbalancedRegexDelimiters('('), true);
        assert.equal(hasUnbalancedRegexDelimiters('foo(bar'), true);
    });
    it('rejects an unclosed character class and a stray closing parenthesis', () => {
        assert.equal(hasUnbalancedRegexDelimiters('[abc'), true);
        assert.equal(hasUnbalancedRegexDelimiters('abc)'), true);
    });
    it('accepts balanced groups, classes and escaped delimiters', () => {
        assert.equal(hasUnbalancedRegexDelimiters('(\\w+)@(\\w+)'), false);
        assert.equal(hasUnbalancedRegexDelimiters('[()\\[\\]]+'), false);
        assert.equal(hasUnbalancedRegexDelimiters('\\(literal\\)'), false);
    });
});
