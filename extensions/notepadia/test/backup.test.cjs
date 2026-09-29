'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    utf8ByteLength,
    isBackupableSize,
    createBackupRecord,
    isBackupWorthRestoring,
    decideBackupAction,
    selectBackupsToEvict,
    parseBackupRecord,
    parseBackupList,
    describeRecovery,
    MAX_DOCUMENT_BYTES,
    DEFAULT_MAX_BACKUP_BYTES
} = require('../lib/common/backup.js');

const record = (over = {}) => createBackupRecord({
    key: 'untitled:Untitled-1',
    label: 'new 1',
    content: 'hello',
    line: 1,
    column: 1,
    savedAt: 1000,
    ...over
});

describe('utf8ByteLength', () => {
    it('counts ASCII as one byte per character', () => {
        assert.equal(utf8ByteLength('abc'), 3);
        assert.equal(utf8ByteLength(''), 0);
    });
    it('counts multi-byte characters as their real width', () => {
        assert.equal(utf8ByteLength('é'), 2);
        assert.equal(utf8ByteLength('€'), 3);
        assert.equal(utf8ByteLength('😀'), 4);
    });
    it('does not mistake character count for byte count', () => {
        assert.notEqual(utf8ByteLength('😀'.repeat(100)).toString(), '100');
        assert.equal(utf8ByteLength('😀'.repeat(100)), 400);
    });
});

describe('isBackupableSize', () => {
    it('accepts an ordinary document', () => {
        assert.equal(isBackupableSize('a'.repeat(1000)), true);
    });
    it('accepts a document exactly at the limit', () => {
        assert.equal(isBackupableSize('a'.repeat(MAX_DOCUMENT_BYTES)), true);
    });
    it('rejects a document one byte over the limit', () => {
        assert.equal(isBackupableSize('a'.repeat(MAX_DOCUMENT_BYTES + 1)), false);
    });
    it('measures in bytes, not characters', () => {
        // Three bytes per character, so a string well under the character
        // count is over the byte limit.
        assert.equal(isBackupableSize('€'.repeat(MAX_DOCUMENT_BYTES / 2)), false);
    });
    it('accepts an empty buffer', () => {
        assert.equal(isBackupableSize(''), true);
    });
});

describe('createBackupRecord', () => {
    it('keeps the fields it is given', () => {
        const r = record({ content: 'abc', line: 4, column: 9, savedAt: 55 });
        assert.equal(r.key, 'untitled:Untitled-1');
        assert.equal(r.content, 'abc');
        assert.equal(r.line, 4);
        assert.equal(r.column, 9);
        assert.equal(r.savedAt, 55);
    });
    it('omits fileMtime for an untitled buffer rather than storing undefined', () => {
        assert.equal('fileMtime' in record(), false);
    });
    it('keeps a file mtime when there is one', () => {
        assert.equal(record({ fileMtime: 900 }).fileMtime, 900);
    });
    it('keeps a zero mtime, which is a real value', () => {
        assert.equal(record({ fileMtime: 0 }).fileMtime, 0);
    });
    it('clamps a zero or negative caret to line 1', () => {
        assert.equal(record({ line: 0 }).line, 1);
        assert.equal(record({ line: -5 }).line, 1);
    });
    it('clamps a non-integer caret by flooring it', () => {
        assert.equal(record({ line: 3.7 }).line, 3);
        assert.equal(record({ column: 2.9 }).column, 2);
    });
    it('replaces a NaN caret with 1 rather than persisting NaN', () => {
        assert.equal(record({ line: NaN }).line, 1);
        assert.equal(record({ column: NaN }).column, 1);
    });
});

describe('isBackupWorthRestoring', () => {
    // The comparison is between the file on disk and the file as it was when
    // the snapshot was taken. `savedAt` is when the snapshot happened and says
    // nothing about whether the file has moved on since.
    const fileRecord = fileMtime => record({ fileMtime });

    it('restores a file-backed buffer whose file has not changed since the snapshot', () => {
        assert.equal(isBackupWorthRestoring(fileRecord(1000), 1000), true);
    });
    it('restores a file-backed buffer when the file is older than the snapshot', () => {
        assert.equal(isBackupWorthRestoring(fileRecord(1000), 900), true);
    });
    it('refuses a file-backed buffer whose file was written after the snapshot', () => {
        assert.equal(isBackupWorthRestoring(fileRecord(1000), 2000), false);
    });
    it('restores rather than drops when the file cannot be stat-ed at recovery time', () => {
        assert.equal(isBackupWorthRestoring(fileRecord(1000), undefined), true);
    });
    it('restores an untitled buffer whatever the caller passes, because it has no file', () => {
        // No `fileMtime` on the record is what marks it untitled, and a caller
        // that passes a number for it anyway must not change the answer.
        const untitled = record({ key: 'untitled:/new 1' });
        assert.equal(isBackupWorthRestoring(untitled, undefined), true);
        assert.equal(isBackupWorthRestoring(untitled, 0), true);
        assert.equal(isBackupWorthRestoring(untitled, Date.now()), true);
    });
    it('ignores savedAt when deciding, so an old snapshot of a changed file is still refused', () => {
        assert.equal(isBackupWorthRestoring(record({ fileMtime: 1000, savedAt: 9_999_999 }), 1001), false);
    });
});

describe('selectBackupsToEvict', () => {
    const sized = (key, chars, savedAt) => record({ key, content: 'a'.repeat(chars), savedAt });

    it('keeps everything when the total fits', () => {
        const all = [sized('a', 100, 1), sized('b', 100, 2)];
        assert.deepEqual(selectBackupsToEvict(all, 1000), []);
    });

    it('drops the oldest first when the total overflows', () => {
        const all = [sized('old', 600, 1), sized('new', 600, 2)];
        assert.deepEqual(selectBackupsToEvict(all, 1000), ['old']);
    });

    it('keeps the two newest when the budget holds exactly two', () => {
        const all = [sized('a', 400, 1), sized('b', 400, 2), sized('c', 400, 3)];
        // Budget holds two, so the oldest single one goes.
        assert.deepEqual(selectBackupsToEvict(all, 800), ['a']);
    });

    it('drops a single backup larger than the entire budget', () => {
        const all = [sized('huge', 5000, 1)];
        assert.deepEqual(selectBackupsToEvict(all, 1000), ['huge']);
    });

    it('keeps the newest even when the oldest is huge', () => {
        const all = [sized('huge', 5000, 1), sized('small', 100, 2)];
        assert.deepEqual(selectBackupsToEvict(all, 1000), ['huge']);
    });

    it('breaks a same-timestamp tie deterministically by key', () => {
        // Newest-first fill, tie broken ascending by key, so 'a' is filled
        // first and 'b' is the one dropped. Reversing the input must not
        // change the answer.
        const all = [sized('b', 600, 100), sized('a', 600, 100)];
        assert.deepEqual(selectBackupsToEvict(all, 1000), ['b']);
        assert.deepEqual(selectBackupsToEvict([...all].reverse(), 1000), ['b']);
    });

    it('evicts nothing from an empty list', () => {
        assert.deepEqual(selectBackupsToEvict([], 0), []);
    });

    it('drops everything rather than exceeding a zero budget', () => {
        assert.deepEqual(selectBackupsToEvict([sized('a', 10, 1)], 0), ['a']);
    });

    it('keeps empty documents for free', () => {
        assert.deepEqual(selectBackupsToEvict([sized('empty', 0, 1)], 1000), []);
    });

    it('defaults to a budget that holds ordinary documents', () => {
        const ordinary = sized('a', 1000, 1);
        assert.deepEqual(selectBackupsToEvict([ordinary], DEFAULT_MAX_BACKUP_BYTES), []);
    });
});

describe('parseBackupRecord', () => {
    it('round-trips a record', () => {
        const r = record({ line: 7, column: 3, fileMtime: 42 });
        assert.deepEqual(parseBackupRecord(JSON.parse(JSON.stringify(r))), r);
    });

    it('rejects non-objects', () => {
        assert.equal(parseBackupRecord(null), undefined);
        assert.equal(parseBackupRecord(undefined), undefined);
        assert.equal(parseBackupRecord('a string'), undefined);
        assert.equal(parseBackupRecord(42), undefined);
    });

    it('rejects a record with no key', () => {
        assert.equal(parseBackupRecord({ content: 'x', savedAt: 1 }), undefined);
        assert.equal(parseBackupRecord({ key: '', content: 'x', savedAt: 1 }), undefined);
    });

    it('rejects a record whose content is not a string', () => {
        assert.equal(parseBackupRecord({ key: 'a', content: 42, savedAt: 1 }), undefined);
    });

    it('accepts an empty document, which is a real unsaved state', () => {
        assert.equal(parseBackupRecord({ key: 'a', content: '', savedAt: 1 }).content, '');
    });

    it('rejects a record with no usable timestamp', () => {
        assert.equal(parseBackupRecord({ key: 'a', content: 'x' }), undefined);
        assert.equal(parseBackupRecord({ key: 'a', content: 'x', savedAt: 'soon' }), undefined);
        assert.equal(parseBackupRecord({ key: 'a', content: 'x', savedAt: NaN }), undefined);
        assert.equal(parseBackupRecord({ key: 'a', content: 'x', savedAt: Infinity }), undefined);
    });

    it('substitutes the key for a missing label rather than showing nothing', () => {
        assert.equal(parseBackupRecord({ key: 'a', content: 'x', savedAt: 1 }).label, 'a');
    });

    it('repairs a corrupt caret instead of rejecting the whole buffer', () => {
        const parsed = parseBackupRecord({ key: 'a', content: 'x', savedAt: 1, line: 'four', column: -2 });
        assert.equal(parsed.line, 1);
        assert.equal(parsed.column, 1);
    });

    it('drops a non-numeric mtime rather than treating it as a time', () => {
        assert.equal('fileMtime' in parseBackupRecord({ key: 'a', content: 'x', savedAt: 1, fileMtime: 'yesterday' }), false);
    });
});

describe('parseBackupList', () => {
    it('drops invalid entries and keeps the rest', () => {
        const list = parseBackupList([
            { key: 'a', content: 'x', savedAt: 2 },
            { key: 'b', content: 5, savedAt: 3 },
            { key: 'c', content: 'y', savedAt: 1 }
        ]);
        assert.deepEqual(list.map(r => r.key), ['a', 'c']);
    });

    it('sorts newest first so restore order is deterministic', () => {
        const list = parseBackupList([
            { key: 'a', content: 'x', savedAt: 1 },
            { key: 'b', content: 'x', savedAt: 3 },
            { key: 'c', content: 'x', savedAt: 2 }
        ]);
        assert.deepEqual(list.map(r => r.key), ['b', 'c', 'a']);
    });

    it('handles an empty store', () => {
        assert.deepEqual(parseBackupList([]), []);
    });
});

describe('describeRecovery', () => {
    it('says nothing when there is nothing to report', () => {
        assert.equal(describeRecovery([]), '');
    });
    it('names a single recovered document', () => {
        assert.equal(describeRecovery(['new 1']), 'Recovered unsaved changes to new 1');
    });
    it('counts and names several recovered documents', () => {
        assert.equal(
            describeRecovery(['new 1', 'notes.txt']),
            'Recovered unsaved changes to 2 documents: new 1, notes.txt');
    });
});

describe('decideBackupAction', () => {
    const decide = (over) => decideBackupAction({ enabled: true, dirty: true, tooLarge: false, ...over });

    it('snapshots a dirty document that fits', () => {
        assert.equal(decide(), 'snapshot');
    });
    it('clears the backup of a saved buffer, whose text matches what was stored', () => {
        assert.equal(decide({ dirty: false, matchesBackup: true }), 'clear');
    });
    it('clears the backup of a reverted buffer, whose text matches the file', () => {
        assert.equal(decide({ dirty: false, matchesFile: true }), 'clear');
    });
    it('keeps the backup when a clean buffer shows different text', () => {
        // The case that matters: a restored session brings back an *empty* tab
        // for the same URI. "This widget is clean" is not "this text is saved",
        // and clearing here would delete another session's unsaved work.
        assert.equal(decide({ dirty: false }), 'skip');
        assert.equal(decide({ dirty: false, matchesBackup: false, matchesFile: false }), 'skip');
    });
    it('clears rather than keeping a stale snapshot of an oversized document', () => {
        assert.equal(decide({ tooLarge: true }), 'clear');
    });
    it('keeps a dirty buffer backed up whatever it happens to match', () => {
        // Dirty is the whole point: the text is not on disk, so a match with a
        // previous snapshot or with a stale file cannot retire the backup.
        assert.equal(decide({ matchesBackup: true, matchesFile: true }), 'snapshot');
        assert.equal(decide({ tooLarge: true, matchesFile: true }), 'clear');
    });
    it('does nothing when the feature is off, leaving any stored backup alone', () => {
        // 'skip' rather than 'clear': turning the preference off and on again
        // must not throw away work that was already backed up.
        assert.equal(decide({ enabled: false }), 'skip');
        assert.equal(decide({ enabled: false, dirty: false }), 'skip');
        assert.equal(decide({ enabled: false, dirty: false, matchesBackup: true }), 'skip');
    });
    it('prefers the preference over dirtiness, since nothing should be written at all', () => {
        assert.equal(decide({ enabled: false, dirty: true, tooLarge: true }), 'skip');
    });
});
