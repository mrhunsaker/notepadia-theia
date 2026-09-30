'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    indentOf,
    pasteAndIndent,
    pasteAndUnindent
} = require('../lib/common/paste-special.js');

describe('indentOf', () => {

    it('returns the leading spaces and tabs', () => {
        assert.equal(indentOf('    const x = 1;'), '    ');
        assert.equal(indentOf('\t\tif (x) {'), '\t\t');
        assert.equal(indentOf(' \tmixed'), ' \t');
    });

    it('returns nothing for an unindented line', () => {
        assert.equal(indentOf('const x = 1;'), '');
        assert.equal(indentOf(''), '');
    });

    it('returns the whole line when it is only whitespace', () => {
        assert.equal(indentOf('    '), '    ');
    });
});

describe('pasteAndIndent', () => {

    it('gives the pasted line the indentation of the line above', () => {
        assert.equal(pasteAndIndent('    return x;', 'y = 1;'), '    y = 1;');
    });

    it('replaces the clipboard\'s own indentation', () => {
        assert.equal(pasteAndIndent('        return x;', '\ty = 1;'), '        y = 1;');
        assert.equal(pasteAndIndent('    return x;', '        y = 1;'), '    y = 1;');
    });

    it('leaves the clipboard alone when the line above has no indentation', () => {
        assert.equal(pasteAndIndent('return x;', '    y = 1;'), '    y = 1;');
        assert.equal(pasteAndIndent('return x;', 'y = 1;'), 'y = 1;');
    });

    it('only re-indents the first line of a multi-line clipboard', () => {
        assert.equal(pasteAndIndent('    return x;', 'if (a) {\n    b();\n}'),
            '    if (a) {\n    b();\n}');
    });

    it('keeps the clipboard\'s own line endings after the first line', () => {
        assert.equal(pasteAndIndent('  return x;', 'a;\r\nb;'), '  a;\r\nb;');
    });

    it('is a no-op when the indentation already matches', () => {
        assert.equal(pasteAndIndent('    return x;', '    y = 1;'), '    y = 1;');
    });

    it('handles an empty clipboard', () => {
        assert.equal(pasteAndIndent('    return x;', ''), '');
    });
});

describe('pasteAndUnindent', () => {

    it('removes the line above\'s indentation from the pasted line', () => {
        assert.equal(pasteAndUnindent('    return x;', '    y = 1;'), 'y = 1;');
    });

    it('removes a longer indent from a less-indented clipboard unchanged', () => {
        assert.equal(pasteAndUnindent('        return x;', '    y = 1;'), '    y = 1;');
    });

    it('leaves a clipboard that does not start with the indent alone', () => {
        assert.equal(pasteAndUnindent('    return x;', 'y = 1;'), 'y = 1;');
    });

    it('leaves the clipboard alone when the line above has no indentation', () => {
        assert.equal(pasteAndUnindent('return x;', '    y = 1;'), '    y = 1;');
    });

    it('removes the indent from the first line of a multi-line clipboard only', () => {
        assert.equal(pasteAndUnindent('    return x;', '    if (a) {\n        b();\n    }'),
            'if (a) {\n        b();\n    }');
    });

    it('keeps the clipboard\'s own line endings after the first line', () => {
        assert.equal(pasteAndUnindent('  return x;', '  a;\r\n  b;'), 'a;\r\n  b;');
    });
});
