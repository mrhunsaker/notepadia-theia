'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    thousands,
    formatLength,
    formatCaret,
    formatSelection
} = require('../lib/common/status-fields.js');

describe('thousands', () => {
    it('leaves small numbers plain', () => {
        assert.equal(thousands(0), '0');
        assert.equal(thousands(7), '7');
        assert.equal(thousands(999), '999');
    });
    it('groups at thousands boundaries', () => {
        assert.equal(thousands(1000), '1,000');
        assert.equal(thousands(1234), '1,234');
        assert.equal(thousands(1234567), '1,234,567');
    });
});

describe('formatLength', () => {
    it('formats an empty document', () => {
        assert.equal(formatLength(0, 0), 'length : 0  lines : 0');
    });
    it('formats a small document', () => {
        assert.equal(formatLength(20, 5), 'length : 20  lines : 5');
    });
    it('groups large counts and a single line', () => {
        assert.equal(formatLength(1234, 56), 'length : 1,234  lines : 56');
        assert.equal(formatLength(5, 1), 'length : 5  lines : 1');
    });
    it('keeps exactly two spaces between the fields', () => {
        assert.equal(formatLength(1, 1), 'length : 1  lines : 1');
    });
});

describe('formatCaret', () => {
    it('formats the document start', () => {
        assert.equal(formatCaret(1, 1, 0), 'Ln : 1  Col : 1  Pos : 0');
    });
    it('matches the Notepad++ example', () => {
        assert.equal(formatCaret(3, 12, 47), 'Ln : 3  Col : 12  Pos : 47');
    });
    it('leaves line/column plain and groups the offset', () => {
        assert.equal(formatCaret(1234, 56, 1234567), 'Ln : 1234  Col : 56  Pos : 1,234,567');
    });
    it('keeps exactly two spaces between the fields', () => {
        assert.equal(formatCaret(1, 1, 1), 'Ln : 1  Col : 1  Pos : 1');
    });
});

describe('formatSelection', () => {
    it('renders the empty selection as 0 | 0', () => {
        assert.equal(formatSelection(0, 0), 'Sel : 0 | 0');
    });
    it('formats a two-line selection', () => {
        assert.equal(formatSelection(18, 2), 'Sel : 18 | 2');
    });
    it('groups large selections', () => {
        assert.equal(formatSelection(1234, 56), 'Sel : 1,234 | 56');
    });
});