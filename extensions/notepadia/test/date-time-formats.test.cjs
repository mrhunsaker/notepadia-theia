'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    formatDateTime,
    shortDateTime,
    longDateTime,
    recognizedTokens,
    isValidDateTimeFormat,
    DEFAULT_SHORT_FORMAT,
    DEFAULT_LONG_FORMAT,
    DATE_TIME_TOKENS
} = require('../lib/common/date-time-formats.js');

// Built from local components on purpose: the formatters are about the user's
// wall clock, so a UTC-based fixture would make the expectations depend on the
// machine running the tests.
const date = new Date(2026, 8, 30, 14, 5, 9);

describe('formatDateTime', () => {

    it('formats Notepad++\'s short format', () => {
        assert.equal(shortDateTime(date), '14:05:09 30/09/2026');
        assert.equal(DEFAULT_SHORT_FORMAT, 'HH:mm:ss dd/MM/yyyy');
    });

    it('formats Notepad++\'s long format', () => {
        assert.equal(longDateTime(date, 'en-US'), 'Wed, Sep 30, 2026 2:05 PM');
        assert.equal(DEFAULT_LONG_FORMAT, 'ddd, MMM d, yyyy h:mm tt');
    });

    it('keeps MM (month) and mm (minutes) apart', () => {
        assert.equal(formatDateTime(date, 'MM mm'), '09 05');
        assert.equal(formatDateTime(new Date(2026, 11, 25, 23, 59), 'MM/mm'), '12/59');
    });

    it('prefers the longer token', () => {
        assert.equal(formatDateTime(date, 'MMMM'), 'September');
        assert.equal(formatDateTime(date, 'MMM'), 'Sep');
        assert.equal(formatDateTime(date, 'MM'), '09');
        assert.equal(formatDateTime(date, 'M'), '9');
    });

    it('zero-pads only the two-letter forms', () => {
        assert.equal(formatDateTime(new Date(2026, 0, 2, 3, 4, 5), 'yyyy yy MM M dd d HH H hh h mm m ss s'),
            '2026 26 01 1 02 2 03 3 03 3 04 4 05 5');
    });

    it('reads 12-hour tokens with 12 for midnight and noon', () => {
        assert.equal(formatDateTime(new Date(2026, 8, 30, 0, 0), 'hh:mm tt'), '12:00 AM');
        assert.equal(formatDateTime(new Date(2026, 8, 30, 12, 0), 'hh:mm tt'), '12:00 PM');
        assert.equal(formatDateTime(new Date(2026, 8, 30, 13, 5), 'h tt'), '1 PM');
        assert.equal(formatDateTime(new Date(2026, 8, 30, 11, 5), 'h tt'), '11 AM');
    });

    it('handles years before 2000 with a two-digit year', () => {
        assert.equal(formatDateTime(new Date(1999, 5, 1), 'yy'), '99');
    });

    it('copies unrecognized characters through as literals', () => {
        assert.equal(formatDateTime(date, '[2026] yyyy-MM-dd'), '[2026] 2026-09-30');
        assert.equal(formatDateTime(date, 'on ddd!'), 'on Wed!');
    });

    it('treats single-quoted text as literal', () => {
        assert.equal(formatDateTime(date, "'Week of' dddd"), 'Week of Wednesday');
    });

    it('reads a doubled quote as one literal apostrophe', () => {
        assert.equal(formatDateTime(date, "x''yyyy"), "x'2026");
    });

    it('runs an unterminated quote to the end instead of throwing', () => {
        assert.equal(formatDateTime(date, "at 5 o'clock"), "at 5 o'clock");
    });

    it('formats month and weekday names in the given locale', () => {
        assert.equal(formatDateTime(date, 'MMMM', 'de-DE'), 'September');
        assert.equal(formatDateTime(date, 'dddd', 'de-DE'), 'Mittwoch');
        assert.equal(formatDateTime(date, 'dddd', 'fr-FR'), 'mercredi');
    });

    it('leaves numbers the same in every locale', () => {
        assert.equal(formatDateTime(date, 'yyyy-MM-dd HH:mm', 'fr-FR'), '2026-09-30 14:05');
    });
});

describe('recognizedTokens', () => {

    it('lists the tokens a format uses, longest first, without repeats', () => {
        assert.deepEqual(recognizedTokens('yyyy-MM-dd HH:mm'), ['yyyy', 'MM', 'dd', 'HH', 'mm']);
        assert.deepEqual(recognizedTokens('dd d M MM'), ['dd', 'd', 'M', 'MM']);
    });

    it('ignores tokens inside quotes', () => {
        assert.deepEqual(recognizedTokens("'yyyy' MM"), ['MM']);
    });

    it('finds nothing in a format with no tokens', () => {
        assert.deepEqual(recognizedTokens('abc'), []);
        // "Week" is quoted, so its letters do not count even though `e` and `k`
        // are not tokens and `ddd` would be if the quotes were not there.
        assert.deepEqual(recognizedTokens("'year'"), []);
    });
});

describe('isValidDateTimeFormat', () => {

    it('accepts a format with at least one token', () => {
        assert.equal(isValidDateTimeFormat('yyyy'), true);
        assert.equal(isValidDateTimeFormat("'at' HH:mm"), true);
    });

    it('refuses an empty format', () => {
        assert.equal(isValidDateTimeFormat(''), false);
        assert.equal(isValidDateTimeFormat('   '), false);
    });

    it('refuses a format that would insert a constant string', () => {
        // 'abc' has no token in it, and 'yyyy' inside quotes is literal, so
        // both would paste the same characters on every insertion. Note that
        // "hello" is NOT one of these: its leading `h` is the hour token, which
        // is the same case-sensitivity rule the format table documents.
        assert.equal(isValidDateTimeFormat('abc'), false);
        assert.equal(isValidDateTimeFormat("'yyyy'"), false);
    });

    it('treats a leading letter that is also a token as that token', () => {
        assert.equal(recognizedTokens('hello')[0], 'h');
        assert.equal(isValidDateTimeFormat('hello'), true);
    });
});

describe('DATE_TIME_TOKENS', () => {

    it('publishes every token the dialog offers', () => {
        assert.ok(DATE_TIME_TOKENS.includes('yyyy'));
        assert.ok(DATE_TIME_TOKENS.includes('MMMM'));
        assert.ok(DATE_TIME_TOKENS.includes('tt'));
        assert.equal(new Set(DATE_TIME_TOKENS).size, DATE_TIME_TOKENS.length);
    });
});
