'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    documentType,
    documentMenuLabel,
    sortDocuments
} = require('../lib/common/open-documents.js');

describe('documentType', () => {
    it('reports the lower-case extension without its dot', () => {
        assert.equal(documentType('/tmp/notes.TXT'), 'txt');
        assert.equal(documentType('C:\\dir\\app.js'), 'js');
    });
    it('uses only the last extension', () => {
        assert.equal(documentType('/tmp/archive.tar.gz'), 'gz');
    });
    it('treats a name without an extension as text', () => {
        assert.equal(documentType('/tmp/README'), 'Text');
        assert.equal(documentType('new 1'), 'Text');
    });
    it('treats a dotfile as a name, not an extension', () => {
        assert.equal(documentType('/tmp/.gitignore'), 'Text');
    });
    it('treats a trailing dot as text', () => {
        assert.equal(documentType('/tmp/weird.'), 'Text');
    });
});

describe('documentMenuLabel', () => {
    it('numbers documents from one', () => {
        assert.equal(documentMenuLabel(0, 'notes.txt'), '1 notes.txt');
        assert.equal(documentMenuLabel(9, 'app.js'), '10 app.js');
    });
});

describe('sortDocuments', () => {
    const documents = [
        { name: 'beta.txt', path: '/b/beta.txt', type: 'txt' },
        { name: 'Alpha.txt', path: '/a/Alpha.txt', type: 'txt' },
        { name: 'main.js', path: '/a/main.js', type: 'js' }
    ];

    it('sorts by name, case-insensitively, ascending', () => {
        const sorted = sortDocuments(documents, 'name', true);
        assert.deepEqual(sorted.map(d => d.name), ['Alpha.txt', 'beta.txt', 'main.js']);
    });
    it('reverses the direction when asked', () => {
        const sorted = sortDocuments(documents, 'name', false);
        assert.deepEqual(sorted.map(d => d.name), ['main.js', 'beta.txt', 'Alpha.txt']);
    });
    it('sorts by path and by type', () => {
        assert.deepEqual(
            sortDocuments(documents, 'path', true).map(d => d.path),
            ['/a/Alpha.txt', '/a/main.js', '/b/beta.txt']
        );
        assert.deepEqual(
            sortDocuments(documents, 'type', true).map(d => d.name),
            ['main.js', 'Alpha.txt', 'beta.txt']
        );
    });
    it('does not mutate the input', () => {
        const original = [...documents];
        sortDocuments(documents, 'type', false);
        assert.deepEqual(documents, original);
    });
});
