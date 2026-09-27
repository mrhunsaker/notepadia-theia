'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    splitName,
    uniqueName,
    suggestedSaveName,
    classifyPickerError,
    LOCAL_FILE_PICKER_TYPES
} = require('../lib/common/local-files.js');

describe('splitName', () => {
    it('splits a name with an extension', () => {
        assert.deepEqual(splitName('notes.txt'), { base: 'notes', extension: '.txt' });
    });
    it('splits on the last dot only', () => {
        assert.deepEqual(splitName('archive.tar.gz'), { base: 'archive.tar', extension: '.gz' });
    });
    it('treats a leading-dot name as all base', () => {
        assert.deepEqual(splitName('.gitignore'), { base: '.gitignore', extension: '' });
    });
    it('gives an extensionless name no extension', () => {
        assert.deepEqual(splitName('Makefile'), { base: 'Makefile', extension: '' });
    });
    it('ignores directory separators', () => {
        assert.deepEqual(splitName('C:\\Users\\me\\notes.md'), { base: 'notes', extension: '.md' });
        assert.deepEqual(splitName('/home/me/notes.md'), { base: 'notes', extension: '.md' });
    });
});

describe('uniqueName', () => {
    const none = () => false;

    it('keeps the real file name when it is free', () => {
        assert.equal(uniqueName('notes.txt', none), 'notes.txt');
    });
    it('numbers the first collision off the base name', () => {
        const taken = n => n === 'notes.txt';
        assert.equal(uniqueName('notes.txt', taken), 'notes (2).txt');
    });
    it('keeps counting while names are taken', () => {
        const taken = new Set(['notes.txt', 'notes (2).txt', 'notes (3).txt']);
        assert.equal(uniqueName('notes.txt', n => taken.has(n)), 'notes (4).txt');
    });
    it('numbers extensionless names too', () => {
        const taken = n => n === 'Makefile';
        assert.equal(uniqueName('Makefile', taken), 'Makefile (2)');
    });
});

describe('suggestedSaveName', () => {
    it('suggests the tab name', () => {
        assert.equal(suggestedSaveName('notes.txt'), 'notes.txt');
    });
    it('reduces a full path to its leaf', () => {
        assert.equal(suggestedSaveName('C:\\Users\\me\\notes.md'), 'notes.md');
        assert.equal(suggestedSaveName('/srv/workspace/app.js'), 'app.js');
    });
    it('falls back to a Notepad++ style name when there is none', () => {
        assert.equal(suggestedSaveName(undefined), 'new 1.txt');
        assert.equal(suggestedSaveName(''), 'new 1.txt');
        assert.equal(suggestedSaveName('   '), 'new 1.txt');
    });
});

describe('classifyPickerError', () => {
    it('treats AbortError as a cancellation, not a failure', () => {
        assert.equal(classifyPickerError(new DOMException('The user aborted a request.', 'AbortError')), 'cancelled');
    });
    it('treats a message-less NotAllowedError as a dismissal', () => {
        // Chromium throws this when the picker is closed.
        assert.equal(classifyPickerError({ name: 'NotAllowedError', message: '' }), 'cancelled');
    });
    it('treats a NotAllowedError naming the permission as a refusal', () => {
        assert.equal(
            classifyPickerError({ name: 'NotAllowedError', message: 'Read/write permission denied.' }),
            'denied'
        );
    });
    it('treats SecurityError as the API being unusable', () => {
        assert.equal(classifyPickerError({ name: 'SecurityError', message: 'Must be handling a user gesture.' }), 'unavailable');
    });
    it('treats an unknown error as the API being unusable', () => {
        assert.equal(classifyPickerError(new Error('boom')), 'unavailable');
        assert.equal(classifyPickerError(undefined), 'unavailable');
        assert.equal(classifyPickerError('nope'), 'unavailable');
    });
});

describe('LOCAL_FILE_PICKER_TYPES', () => {
    it('offers text and source files, then everything', () => {
        assert.equal(LOCAL_FILE_PICKER_TYPES.length, 2);
        assert.ok(LOCAL_FILE_PICKER_TYPES[0].accept['text/plain'].includes('.txt'));
        assert.deepEqual(LOCAL_FILE_PICKER_TYPES[1].accept, { '*/*': ['.'] });
    });
});
