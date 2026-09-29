/**
 * Pure logic behind unsaved-work protection and crash recovery (WS-D / D3).
 *
 * A browser tab dies far more casually than a desktop window: a laptop sleeps,
 * a tab is closed by accident, the browser is killed by a crash. Notepad++
 * keeps periodic session snapshots and restores unsaved buffers on the next
 * launch, and a Notepad++ user expects the same of a browser-hosted editor.
 *
 * The rules that decide *whether* a backup is worth keeping - is it newer than
 * the file on disk, is it still inside the size budget, which one gets dropped
 * first - are here so they can be unit tested. Nothing in this file touches
 * IndexedDB, the DOM, or Theia, for the same reason `zoom-chords.ts` and
 * `sessions.ts` do not: the decisions are the part worth proving.
 */

/** One recovered buffer: what it was, what it contained, where the caret was. */
export interface BackupRecord {
    /**
     * Stable identity for the buffer.
     *
     * File-backed documents use the file URI; an untitled `new 3` uses its
     * untitled URI. Either way it is whatever the editor widget reports, so
     * the same document always maps to the same key and a rewrite replaces
     * rather than accumulates.
     */
    readonly key: string;
    /** What the tab called itself, for the recovery report. */
    readonly label: string;
    /** Full document text at capture time. */
    readonly content: string;
    /** 1-based caret line. */
    readonly line: number;
    /** 1-based caret column. */
    readonly column: number;
    /** `Date.now()` when the backup was written. */
    readonly savedAt: number;
    /**
     * Modification time of the underlying file when the buffer went dirty, or
     * `undefined` for an untitled buffer. Used on restore to tell "the file
     * changed under me" from "this is newer than what is on disk".
     */
    readonly fileMtime?: number;
}

/** Where backups live, so a schema change can abandon the old store safely. */
export const BACKUP_DB_NAME = 'notepadia-backups';
export const BACKUP_DB_VERSION = 1;
export const BACKUP_STORE = 'buffers';

/**
 * Notepad++ caps its session snapshot so one enormous buffer cannot consume the
 * whole backup directory. 8 MB of text is far past what a Notepad++ user
 * expects to recover in a single tab, and small enough that the record plus
 * its key stays small in IndexedDB.
 */
export const DEFAULT_MAX_BACKUP_BYTES = 8 * 1024 * 1024;

/** Longest document worth snapshotting, to bound a single write. */
export const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;

/** Byte length of a string once encoded as UTF-8. */
export function utf8ByteLength(text: string): number {
    // TextEncoder is available in every browser target this app supports; the
    // fallback is only here so the function stays usable in a plain Node test
    // process without depending on a global that older runtimes may lack.
    if (typeof TextEncoder !== 'undefined') {
        return new TextEncoder().encode(text).length;
    }
    return unescape(encodeURIComponent(text)).length;
}

/** Whether a document is small enough to snapshot at all. */
export function isBackupableSize(content: string): boolean {
    return utf8ByteLength(content) <= MAX_DOCUMENT_BYTES;
}

/**
 * What to do with a buffer when the debounce fires: snapshot it, or clear
 * whatever was stored for it.
 *
 * The inputs are the ones that actually decide, kept together so the policy is
 * testable without a browser, an editor or a storage quota:
 *
 * - `enabled` is the user preference. When it is off nothing is ever written,
 *   and an existing backup is left alone rather than being deleted, so turning
 *   the feature off and back on does not silently discard pending work.
 * - `dirty` separates work worth keeping from work already on disk.
 * - `tooLarge` is a document past the per-document cap. The backup is dropped
 *   rather than kept stale, because the last snapshot of a 200 MB file is
 *   exactly the one that is no longer true.
 * - `matchesBackup` and `matchesFile` are what make a clean buffer safe to
 *   clear. Clean on its own is not enough: a restored session can bring back an
 *   *empty* tab for the same URI, and treating "this widget is clean" as "this
 *   text is saved" would let that empty tab delete another session's unsaved
 *   work. Clearing therefore needs evidence - the text on screen is the text we
 *   stored, or it is what is on disk.
 */
export type BackupAction = 'snapshot' | 'clear' | 'skip';

export function decideBackupAction(input: {
    enabled: boolean;
    dirty: boolean;
    tooLarge: boolean;
    matchesBackup?: boolean;
    matchesFile?: boolean;
}): BackupAction {
    if (!input.enabled) {
        return 'skip';
    }
    if (input.dirty) {
        return input.tooLarge ? 'clear' : 'snapshot';
    }
    return input.matchesBackup || input.matchesFile ? 'clear' : 'skip';
}

/** Build the record for a dirty buffer. */
export function createBackupRecord(input: {
    key: string;
    label: string;
    content: string;
    line: number;
    column: number;
    savedAt: number;
    fileMtime?: number;
}): BackupRecord {
    return {
        key: input.key,
        label: input.label,
        content: input.content,
        // A backup with a nonsense caret is worse than one with a clamped
        // caret: restoring it would throw or scroll somewhere arbitrary.
        line: Math.max(1, Math.floor(input.line) || 1),
        column: Math.max(1, Math.floor(input.column) || 1),
        savedAt: input.savedAt,
        ...(input.fileMtime === undefined ? {} : { fileMtime: input.fileMtime })
    };
}

/**
 * Whether a stored backup is still worth offering on startup.
 *
 * The rule is "newer than the file on disk", which is Notepad++'s: if the file
 * has not been touched since the backup was taken, the backup holds work that
 * exists nowhere else. An untitled buffer always qualifies, because there is no
 * file to compare against and the text exists only in the backup.
 *
 * `fileMtime` is the current time for an untitled buffer, so the two cases
 * collapse into one comparison.
 */
export function isBackupWorthRestoring(backup: BackupRecord, currentFileMtime: number | undefined): boolean {
    // An untitled buffer has no file behind it, so nothing on disk can have
    // superseded the snapshot. The backup is the only copy of the text, which
    // makes it worth restoring unconditionally. `savedAt` deliberately plays
    // no part here: it records when the snapshot was taken, not how old the
    // user's work is relative to anything.
    if (backup.fileMtime === undefined) {
        return true;
    }
    // The file could not be stat'ed at recovery time. We cannot claim the disk
    // copy is newer, and the backup is unsaved work, so surface it and let the
    // user decide rather than dropping it silently.
    if (currentFileMtime === undefined) {
        return true;
    }
    // A file written after the snapshot is a deliberate save that must not be
    // overwritten. Filesystem mtime resolution is coarse, so a tie goes to the
    // backup: losing the user's text is the worse of the two mistakes.
    return currentFileMtime <= backup.fileMtime;
}

/**
 * Pick which backups to drop so the total stays inside `maxBytes`.
 *
 * The budget is filled newest first, because the newest buffer is the work the
 * user most recently had open and the one they are most likely to want back. A
 * single record larger than the whole budget is dropped on its own rather than
 * being kept because it happens to be the only one - a 50 MB backup is not
 * recoverable work the user can use, it is a quota problem. Returns the keys to
 * delete, so the caller does the deleting.
 */
export function selectBackupsToEvict(backups: readonly BackupRecord[], maxBytes: number): string[] {
    const byKey = new Map(backups.map(record => [record.key, record]));
    // Newest first; `savedAt` alone is not a total order because two buffers
    // can be written in the same millisecond, so the key breaks the tie and
    // the result does not depend on store iteration order.
    const ordered = [...backups].sort((a, b) => {
        const delta = b.savedAt - a.savedAt;
        return delta !== 0 ? delta : a.key.localeCompare(b.key);
    });
    const evict: string[] = [];
    let total = 0;
    for (const record of ordered) {
        const bytes = utf8ByteLength(record.content);
        if (bytes > maxBytes || total + bytes > maxBytes) {
            evict.push(record.key);
            continue;
        }
        total += bytes;
    }
    // Deleting must be by key, and the order the keys are reported in must not
    // depend on the sort above.
    return [...new Set(evict)].sort((a, b) => a.localeCompare(b)).filter(key => byKey.has(key));
}

/**
 * Validate a record read back out of storage.
 *
 * Storage is not trusted input: a record written by an older build, a partial
 * write after a crash, or a hand-edited database can all produce anything. A
 * record that does not validate is dropped rather than restored, because
 * restoring garbage into an editor is worse than losing it.
 */
export function parseBackupRecord(raw: unknown): BackupRecord | undefined {
    if (typeof raw !== 'object' || raw === null) {
        return undefined;
    }
    const record = raw as Record<string, unknown>;
    if (typeof record.key !== 'string' || record.key.length === 0) {
        return undefined;
    }
    if (typeof record.content !== 'string') {
        return undefined;
    }
    if (typeof record.savedAt !== 'number' || !Number.isFinite(record.savedAt)) {
        return undefined;
    }
    return createBackupRecord({
        key: record.key,
        label: typeof record.label === 'string' && record.label.length > 0 ? record.label : record.key,
        content: record.content,
        line: typeof record.line === 'number' ? record.line : 1,
        column: typeof record.column === 'number' ? record.column : 1,
        savedAt: record.savedAt,
        ...(typeof record.fileMtime === 'number' && Number.isFinite(record.fileMtime)
            ? { fileMtime: record.fileMtime }
            : {})
    });
}

/**
 * Parse a whole store listing, dropping the entries that do not validate and
 * sorting the rest newest first.
 */
export function parseBackupList(raws: readonly unknown[]): BackupRecord[] {
    const records: BackupRecord[] = [];
    for (const raw of raws) {
        const record = parseBackupRecord(raw);
        if (record) {
            records.push(record);
        }
    }
    return records.sort((a, b) => b.savedAt - a.savedAt);
}

/**
 * One line describing what was recovered, for the startup notification.
 *
 * Notepad++ says nothing, but silently repopulating tabs is its own kind of
 * hostile: a user who reloads and sees three documents they never opened
 * cannot tell recovery from a bug. Naming the count and the tabs makes the
 * difference obvious.
 */
export function describeRecovery(labels: readonly string[]): string {
    if (labels.length === 0) {
        return '';
    }
    if (labels.length === 1) {
        return `Recovered unsaved changes to ${labels[0]}`;
    }
    return `Recovered unsaved changes to ${labels.length} documents: ${labels.join(', ')}`;
}
