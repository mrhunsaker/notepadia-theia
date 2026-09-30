'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    multiSelectTerm,
    MULTI_SELECT_NO_TARGET_MESSAGE
} = require('../lib/common/multi-select.js');

describe('multiSelectTerm', () => {

    it('prefers the selection when there is one', () => {
        assert.equal(multiSelectTerm({ selectionText: 'return', wordAtPosition: 'if' }), 'return');
    });

    it('falls back to the word under the caret', () => {
        assert.equal(multiSelectTerm({ selectionText: '', wordAtPosition: 'return' }), 'return');
        assert.equal(multiSelectTerm({ wordAtPosition: 'return' }), 'return');
    });

    it('keeps a selection that has surrounding whitespace', () => {
        assert.equal(multiSelectTerm({ selectionText: ' foo ', wordAtPosition: 'foo' }), ' foo ');
    });

    it('refuses a selection that spans lines', () => {
        assert.equal(
            multiSelectTerm({ selectionText: 'foo\nbar', wordAtPosition: 'foo', selectionIsMultiline: true }),
            'foo');
    });

    it('refuses a multi-line selection even with no word under the caret', () => {
        assert.equal(
            multiSelectTerm({ selectionText: 'foo\nbar', selectionIsMultiline: true }),
            undefined);
    });

    it('has no term for a caret between two words', () => {
        assert.equal(multiSelectTerm({ selectionText: '', wordAtPosition: '' }), undefined);
        assert.equal(multiSelectTerm({}), undefined);
    });
});

describe('MULTI_SELECT_NO_TARGET_MESSAGE', () => {

    it('names the two things that do work', () => {
        assert.match(MULTI_SELECT_NO_TARGET_MESSAGE, /Select a word/);
        assert.match(MULTI_SELECT_NO_TARGET_MESSAGE, /one line/);
    });
});
