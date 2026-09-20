'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    serializeSession,
    parseSessionJson,
    dedupeUriList,
    isUri
} = require('../lib/common/sessions.js');

describe('serializeSession / parseSessionJson', () => {
    it('round-trips files and activeFile', () => {
        const text = serializeSession(['file:///w/a.txt', 'file:///w/b.txt'], 'file:///w/b.txt');
        assert.deepEqual(parseSessionJson(text), {
            files: ['file:///w/a.txt', 'file:///w/b.txt'],
            activeFile: 'file:///w/b.txt'
        });
    });
    it('omits activeFile when absent', () => {
        const text = serializeSession(['file:///w/a.txt']);
        assert.deepEqual(parseSessionJson(text), { files: ['file:///w/a.txt'] });
    });
    it('deduplicates the file list on save', () => {
        const text = serializeSession(['file:///w/a.txt', 'file:///w/a.txt', 'file:///w/b.txt']);
        assert.deepEqual(parseSessionJson(text).files, ['file:///w/a.txt', 'file:///w/b.txt']);
    });
    it('returns null for non-JSON content', () => {
        assert.equal(parseSessionJson('not json {'), null);
    });
    it('returns null for the wrong version', () => {
        assert.equal(parseSessionJson('{"version":99,"files":["file:///w/a.txt"]}'), null);
    });
    it('returns null when files is missing or empty', () => {
        assert.equal(parseSessionJson('{"version":1}'), null);
        assert.equal(parseSessionJson('{"version":1,"files":[]}'), null);
        assert.equal(parseSessionJson('{"version":1,"files":[""] }'), null);
    });
    it('drops non-string entries and keeps the rest', () => {
        const data = parseSessionJson('{"version":1,"files":["file:///w/a.txt", 42, null]}');
        assert.deepEqual(data.files, ['file:///w/a.txt']);
    });
    it('ignores an activeFile that is not a file URI', () => {
        const text = serializeSession(['file:///w/a.txt'], 'https://example.com/x');
        assert.deepEqual(parseSessionJson(text), { files: ['file:///w/a.txt'] });
    });
    it('keeps an activeFile that is absent from the list so the caller can open it', () => {
        const data = parseSessionJson('{"version":1,"files":["file:///w/a.txt"],"activeFile":"file:///w/b.txt"}');
        assert.deepEqual(data, { files: ['file:///w/a.txt'], activeFile: 'file:///w/b.txt' });
    });
});

describe('dedupeUriList', () => {
    it('preserves first-seen order', () => {
        assert.deepEqual(
            dedupeUriList(['file:///w/b.txt', 'file:///w/a.txt', 'file:///w/b.txt']),
            ['file:///w/b.txt', 'file:///w/a.txt']
        );
    });
    it('drops empty strings', () => {
        assert.deepEqual(dedupeUriList(['', 'file:///w/a.txt']), ['file:///w/a.txt']);
    });
});

describe('isUri', () => {
    it('accepts file URIs and rejects paths/others', () => {
        assert.equal(isUri('file:///w/a.txt'), true);
        assert.equal(isUri('/w/a.txt'), false);
        assert.equal(isUri('https://example.com'), false);
    });
});