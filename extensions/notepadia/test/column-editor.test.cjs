'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    computePadWidth,
    textForIndex,
    columnTextsFor
} = require('../lib/common/column-editor.js');

const textConfig = (overrides = {}) => ({ mode: 'text', text: 'X', initialNumber: 1, increment: 1, leadingZeros: false, ...overrides });

describe('columnTextsFor (text mode)', () => {
    it('inserts the same text on every row', () => {
        assert.deepEqual(columnTextsFor(textConfig({ text: 'hello' }), 3), ['hello', 'hello', 'hello']);
    });
    it('accepts an empty text', () => {
        assert.deepEqual(columnTextsFor(textConfig({ text: '' }), 2), ['', '']);
    });
});

describe('columnTextsFor (number mode)', () => {
    it('counts up by the increment from the initial number', () => {
        assert.deepEqual(columnTextsFor(textConfig({ mode: 'number', initialNumber: 2, increment: 3 }), 4), ['2', '5', '8', '11']);
    });
    it('supports negative increments and negative starts', () => {
        assert.deepEqual(columnTextsFor(textConfig({ mode: 'number', initialNumber: 5, increment: -2 }), 3), ['5', '3', '1']);
        assert.deepEqual(columnTextsFor(textConfig({ mode: 'number', initialNumber: -3, increment: 1 }), 3), ['-3', '-2', '-1']);
    });
    it('pads with leading zeros to the widest value', () => {
        assert.deepEqual(columnTextsFor(textConfig({ mode: 'number', initialNumber: 1, increment: 1, leadingZeros: true }), 10), [
            '01', '02', '03', '04', '05', '06', '07', '08', '09', '10'
        ]);
    });
    it('does not pad negative numbers', () => {
        const texts = columnTextsFor(textConfig({ mode: 'number', initialNumber: -2, increment: 1, leadingZeros: true }), 13);
        assert.deepEqual(texts.slice(0, 5), ['-2', '-1', '00', '01', '02']);
        assert.deepEqual(texts.slice(10), ['08', '09', '10']);
    });
    it('leaves values alone when leading zeros are off', () => {
        assert.deepEqual(columnTextsFor(textConfig({ mode: 'number', leadingZeros: false }), 2), ['1', '2']);
    });
});

describe('columnTextsFor (repeated mode)', () => {
    it('cycles the text one character per row', () => {
        assert.deepEqual(columnTextsFor(textConfig({ mode: 'repeated', text: 'abc' }), 5), ['a', 'b', 'c', 'a', 'b']);
    });
    it('returns empty rows for an empty repeated text', () => {
        assert.deepEqual(columnTextsFor(textConfig({ mode: 'repeated', text: '' }), 3), ['', '', '']);
    });
});

describe('computePadWidth', () => {
    it('is zero when leading zeros are disabled', () => {
        assert.equal(computePadWidth(1, 1, 5, false), 0);
    });
    it('sizes to the widest of first and last value', () => {
        assert.equal(computePadWidth(9, 1, 2, true), 2);
        assert.equal(computePadWidth(5, 10, 2, true), 2);
        assert.equal(computePadWidth(1, 1, 9, true), 1);
    });
    it('clamps negative values to zero when sizing', () => {
        assert.equal(computePadWidth(-50, 1, 5, true), 1);
    });
});

describe('textForIndex', () => {
    it('pads the number when padWidth allows', () => {
        assert.equal(textForIndex(textConfig({ mode: 'number' }), 0, 7, 3), '007');
        assert.equal(textForIndex(textConfig({ mode: 'number' }), 0, 7, 0), '7');
    });
    it('cycles repeated text by index', () => {
        assert.equal(textForIndex(textConfig({ mode: 'repeated', text: 'xy' }), 0, 0, 0), 'x');
        assert.equal(textForIndex(textConfig({ mode: 'repeated', text: 'xy' }), 3, 0, 0), 'y');
    });
});