'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    resolveRenameTarget,
    reloadFromDiskMessage,
    deleteFromDiskMessage,
    copyNameFor
} = require('../lib/common/file-operations.js');

describe('resolveRenameTarget', () => {

    it('renames in place when a bare name is typed', () => {
        assert.deepEqual(resolveRenameTarget('/ws/notes.txt', 'renamed.txt'), {
            ok: true,
            path: '/ws/renamed.txt'
        });
    });

    it('trims the typed name', () => {
        assert.deepEqual(resolveRenameTarget('/ws/a.txt', '  b.txt  '), { ok: true, path: '/ws/b.txt' });
    });

    it('moves into a subfolder the way Notepad++ allows', () => {
        assert.deepEqual(resolveRenameTarget('/ws/a.txt', 'sub/a.txt'), { ok: true, path: '/ws/sub/a.txt' });
    });

    it('collapses a redundant ./ segment', () => {
        assert.deepEqual(resolveRenameTarget('/ws/a.txt', './b.txt'), { ok: true, path: '/ws/b.txt' });
    });

    it('collapses doubled slashes', () => {
        assert.deepEqual(resolveRenameTarget('/ws/a.txt', 'sub//b.txt'), { ok: true, path: '/ws/sub/b.txt' });
    });

    it('handles a file at the filesystem root', () => {
        assert.deepEqual(resolveRenameTarget('/a.txt', 'b.txt'), { ok: true, path: '/b.txt' });
        assert.deepEqual(resolveRenameTarget('/a.txt', 'sub/b.txt'), { ok: true, path: '/sub/b.txt' });
    });

    it('handles a relative current path', () => {
        assert.deepEqual(resolveRenameTarget('a.txt', 'b.txt'), { ok: true, path: 'b.txt' });
    });

    it('refuses an empty name', () => {
        assert.equal(resolveRenameTarget('/ws/a.txt', '   ').ok, false);
    });

    it('refuses "." and ".." as the whole name', () => {
        assert.equal(resolveRenameTarget('/ws/a.txt', '.').ok, false);
        assert.equal(resolveRenameTarget('/ws/a.txt', '..').ok, false);
    });

    it('refuses an absolute path', () => {
        const result = resolveRenameTarget('/ws/a.txt', '/etc/passwd');
        assert.equal(result.ok, false);
        assert.match(result.reason, /absolute path/);
    });

    it('refuses a Windows absolute path', () => {
        assert.equal(resolveRenameTarget('/ws/a.txt', 'C:\\Windows\\a.txt').ok, false);
    });

    it('refuses to climb out of the file\'s folder', () => {
        const result = resolveRenameTarget('/ws/a.txt', '../a.txt');
        assert.equal(result.ok, false);
        assert.match(result.reason, /"\.\."/);
    });

    it('refuses a .. buried in the middle of the path', () => {
        assert.equal(resolveRenameTarget('/ws/a.txt', 'sub/../../a.txt').ok, false);
    });

    it('refuses a folder as the target', () => {
        assert.equal(resolveRenameTarget('/ws/a.txt', 'sub/').ok, false);
    });

    it('refuses renaming a file to the name it already has', () => {
        const result = resolveRenameTarget('/ws/a.txt', 'a.txt');
        assert.equal(result.ok, false);
        assert.match(result.reason, /already has/);
    });

    it('allows renaming into a subfolder even when the name matches the file name', () => {
        assert.deepEqual(resolveRenameTarget('/ws/a.txt', 'sub/a.txt'), { ok: true, path: '/ws/sub/a.txt' });
    });
});

describe('reloadFromDiskMessage', () => {

    it('warns about losing changes only when the buffer is dirty', () => {
        assert.match(reloadFromDiskMessage('a.txt', true), /lose the changes/);
        assert.doesNotMatch(reloadFromDiskMessage('a.txt', false), /lose the changes/);
    });

    it('names the file in both cases', () => {
        assert.match(reloadFromDiskMessage('a.txt', true), /a\.txt/);
        assert.match(reloadFromDiskMessage('a.txt', false), /a\.txt/);
    });
});

describe('deleteFromDiskMessage', () => {

    it('says the file is deleted from disk', () => {
        assert.match(deleteFromDiskMessage('a.txt', false), /delete "a\.txt" from disk/);
    });

    it('warns about losing changes only when the buffer is dirty', () => {
        assert.match(deleteFromDiskMessage('a.txt', true), /lose the changes/);
        assert.doesNotMatch(deleteFromDiskMessage('a.txt', false), /lose the changes/);
    });
});

describe('copyNameFor', () => {

    it('keeps the file name as-is', () => {
        assert.equal(copyNameFor('notes.txt'), 'notes.txt');
    });

    it('strips a directory if one is handed in', () => {
        assert.equal(copyNameFor('/ws/sub/notes.txt'), 'notes.txt');
    });

    it('adds .txt to a name with no extension', () => {
        assert.equal(copyNameFor('new 1'), 'new 1.txt');
    });

    it('keeps a multi-dot name intact', () => {
        assert.equal(copyNameFor('archive.tar.gz'), 'archive.tar.gz');
    });

    it('does not treat a leading dot file as extensionless', () => {
        assert.equal(copyNameFor('.bashrc'), '.bashrc');
    });

    it('falls back for an empty name', () => {
        assert.equal(copyNameFor(''), 'copy.txt');
    });

    it('names the copy after the last segment of a path that ends in a slash', () => {
        assert.equal(copyNameFor('/ws/'), 'ws.txt');
    });
});
