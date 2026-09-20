'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { extendedToLiteral, escapeForRegex } = require('../lib/common/extended-search.js');

const count = (regex, text) => (text.match(regex) || []).length;

describe('extendedToLiteral - simple escapes', () => {
    it('maps \\n to a newline', () => {
        assert.equal(extendedToLiteral('a\\nb'), 'a\nb');
    });
    it('maps \\r to a carriage return', () => {
        assert.equal(extendedToLiteral('a\\rb'), 'a\rb');
    });
    it('maps \\t to a tab', () => {
        assert.equal(extendedToLiteral('a\\tb'), 'a\tb');
    });
    it('maps \\0 to a null byte', () => {
        assert.equal(extendedToLiteral('\\0').charCodeAt(0), 0);
    });
    it('maps \\\\ to a single backslash', () => {
        assert.equal(extendedToLiteral('a\\\\b'), 'a\\b');
    });
    it('is idempotent on plain text', () => {
        assert.equal(extendedToLiteral('hello world'), 'hello world');
        assert.equal(extendedToLiteral(extendedToLiteral('hello world')), 'hello world');
    });
});

describe('extendedToLiteral - numeric escapes', () => {
    it('maps \\xHH to the hex byte', () => {
        assert.equal(extendedToLiteral('\\x41'), 'A');
    });
    it('matches \\xHH case-insensitively', () => {
        assert.equal(extendedToLiteral('\\x4a'), 'J');
    });
    it('maps \\oOOO to the octal byte', () => {
        assert.equal(extendedToLiteral('\\o101'), 'A');
        assert.equal(extendedToLiteral('\\o0'), '\\o0'); // needs three digits
    });
    it('maps \\dDDD to the decimal byte', () => {
        assert.equal(extendedToLiteral('\\d065'), 'A');
        assert.equal(extendedToLiteral('\\d255'), String.fromCharCode(255));
    });
    it('maps \\bBBBBBBBB to the binary byte', () => {
        assert.equal(extendedToLiteral('\\b01000001'), 'A');
        assert.equal(extendedToLiteral('\\b00000000').charCodeAt(0), 0);
    });
    it('treats \\d999 overflow as passthrough', () => {
        assert.equal(extendedToLiteral('\\d999'), '\\d999');
    });
    it('\\x without two hex digits passes through', () => {
        assert.equal(extendedToLiteral('\\x'), '\\x');
        assert.equal(extendedToLiteral('\\x4'), '\\x4');
        assert.equal(extendedToLiteral('\\xGG'), '\\xGG');
    });
    it('\\o without three octal digits passes through', () => {
        assert.equal(extendedToLiteral('\\o999'), '\\o999');
        assert.equal(extendedToLiteral('\\o8'), '\\o8');
    });
    it('\\d without three digits passes through', () => {
        assert.equal(extendedToLiteral('\\d'), '\\d');
        assert.equal(extendedToLiteral('\\d6'), '\\d6');
    });
    it('\\b without eight binary digits passes through', () => {
        assert.equal(extendedToLiteral('\\b0100'), '\\b0100');
        assert.equal(extendedToLiteral('\\b0100000x'), '\\b0100000x');
    });
});

describe('extendedToLiteral - passthrough and boundaries', () => {
    it('passes unknown escapes through literally', () => {
        assert.equal(extendedToLiteral('\\m'), '\\m');
        assert.equal(extendedToLiteral('\\qfoo'), '\\qfoo');
    });
    it('keeps regex metacharacters literal in the output', () => {
        assert.equal(extendedToLiteral('a.b'), 'a.b');
        assert.equal(extendedToLiteral('[x](y)'), '[x](y)');
    });
    it('handles a trailing lone backslash', () => {
        assert.equal(extendedToLiteral('a\\'), 'a\\');
    });
    it('handles empty source', () => {
        assert.equal(extendedToLiteral(''), '');
    });
    it('preserves a raw newline typed as Enter', () => {
        assert.equal(extendedToLiteral('a\nb'), 'a\nb');
    });
    it('does not mistake doubled backslashes for numeric escapes', () => {
        assert.equal(extendedToLiteral('\\\\x41'), '\\x41');
    });
});

describe('escapeForRegex - regex semantics for a literal', () => {
    const matchLiteral = (literal, text) => count(new RegExp(escapeForRegex(literal)), text);

    it('escapes regex metacharacters', () => {
        assert.equal(escapeForRegex('a.b'), 'a\\.b');
        assert.equal(matchLiteral('a.b', 'axb'), 0);
        assert.equal(matchLiteral('a.b', 'a.b'), 1);
    });
    it('escapes [] {} () * + ? | ^ $', () => {
        const literal = '[x](y) *+? | ^$';
        assert.equal(matchLiteral(literal, literal), 1);
        assert.equal(matchLiteral(literal, 'x y'), 0);
    });
    it('escapes a literal backslash', () => {
        assert.equal(matchLiteral('a\\b', 'a\\b'), 1);
        assert.equal(matchLiteral('a\\b', 'ab'), 0);
    });
    it('keeps plain text as plain text', () => {
        assert.equal(escapeForRegex('hello world'), 'hello world');
    });
    it('escapes newline, tab and CR as named escapes', () => {
        assert.equal(escapeForRegex('a\nb'), 'a\\nb');
        assert.equal(escapeForRegex('a\tb'), 'a\\tb');
        assert.equal(escapeForRegex('a\rb'), 'a\\rb');
        assert.equal(matchLiteral('a\nb', 'a\nb'), 1);
    });
    it('escapes the null byte as a hex escape', () => {
        assert.equal(escapeForRegex('\0'), '\\x00');
    });
    it('escapes non-ASCII characters', () => {
        assert.equal(escapeForRegex('é'), '\\xe9');
        assert.equal(escapeForRegex('你'), '\\u4f60');
        assert.equal(matchLiteral('你', '你'), 1);
    });
    it('round-trips through a regex literal match', () => {
        const literal = 'C:\\temp\\file (1).txt\tend';
        assert.equal(matchLiteral(literal, literal), 1);
    });
    it('handles empty string', () => {
        assert.equal(escapeForRegex(''), '');
    });
});

describe('extended + regex pipeline', () => {
    it('decodes an escape table term and then matches it as a literal', () => {
        const literal = extendedToLiteral('id=1\\tid=2');
        const regex = new RegExp(escapeForRegex(literal));
        const haystack = 'id=1\tid=2';
        assert.equal(count(regex, haystack), 1);
    });
    it('escapes numeric escapes back to a safe literal for regex use', () => {
        // '\x28\x29' decode to '(' and ')': escapeForRegex must re-escape them
        const literal = extendedToLiteral('\\x28\\x29[abc]');
        assert.equal(literal, '()[abc]');
        const regex = new RegExp(escapeForRegex(literal));
        assert.equal(count(regex, '()[abc]'), 1);
        assert.equal(count(regex, 'abc'), 0);
    });
});