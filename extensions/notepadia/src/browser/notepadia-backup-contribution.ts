import { inject, injectable } from '@theia/core/shared/inversify';
import { Widget } from '@lumino/widgets';
import { Emitter, Event } from '@theia/core/lib/common/event';
import { DisposableCollection } from '@theia/core/lib/common/disposable';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { NavigatableWidget } from '@theia/core/lib/browser/navigatable-types';
import { Saveable } from '@theia/core/lib/browser/saveable';
import { PreferenceService, PreferenceContribution, PreferenceSchema } from '@theia/core/lib/common/preferences';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import { EditorWidget } from '@theia/editor/lib/browser/editor-widget';
import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { URI } from '@theia/core/lib/common/uri';
import { MessageService } from '@theia/core/lib/common/message-service';
import {
    BACKUP_DB_NAME,
    BACKUP_DB_VERSION,
    BACKUP_STORE,
    BackupRecord,
    DEFAULT_MAX_BACKUP_BYTES,
    createBackupRecord,
    decideBackupAction,
    describeRecovery,
    isBackupableSize,
    isBackupWorthRestoring,
    parseBackupList,
    parseBackupRecord,
    selectBackupsToEvict
} from '../common/backup';

export const NOTEPADIA_BACKUP_ENABLED_PREFERENCE = 'notepadia.backup.enabled';
export const NOTEPADIA_BACKUP_INTERVAL_PREFERENCE = 'notepadia.backup.intervalSeconds';

/** Notepad++'s default autosave-to-session-backup delay is a few seconds. */
export const DEFAULT_BACKUP_INTERVAL_SECONDS = 5;

/**
 * D3 - unsaved-work protection and crash recovery.
 *
 * What Theia already does, measured rather than assumed before writing this:
 * `CommonFrontendContribution.onWillStop` vetoes shutdown while any editor is
 * dirty, and `DefaultWindowService` turns that veto into a `beforeunload`
 * prompt, so closing the tab already asks first (verified: a dirty buffer
 * raises the dialog, a clean one does not). What Theia does *not* do is keep
 * the text. Reloading with an unsaved `new 1` leaves no tab and no content at
 * all, which is the part a Notepad++ user notices.
 *
 * So this contribution is the recovery half: dirty buffers are snapshotted to
 * IndexedDB on a debounce, and restored on the next launch. IndexedDB rather
 * than `StorageService` because in Theia 1.75 that is localStorage, a ~5 MB
 * synchronous string store - the wrong shape for document text, and a
 * synchronous write of a large buffer on the main thread is exactly the kind of
 * jank a backup feature must not introduce.
 */
@injectable()
export class NotepadiaBackupContribution implements FrontendApplicationContribution {

    protected readonly toDispose = new DisposableCollection();

    /** Per-widget debounce handles, so typing does not write on every keystroke. */
    protected readonly pendingWrites = new Map<string, ReturnType<typeof setTimeout>>();

    protected readonly onDidRestoreEmitter = new Emitter<readonly BackupRecord[]>();
    readonly onDidRestore: Event<readonly BackupRecord[]> = this.onDidRestoreEmitter.event;

    constructor(
        @inject(ApplicationShell) protected readonly shell: ApplicationShell,
        @inject(EditorManager) protected readonly editorManager: EditorManager,
        @inject(PreferenceService) protected readonly preferences: PreferenceService,
        @inject(FileService) protected readonly fileService: FileService,
        @inject(MessageService) protected readonly messageService: MessageService
    ) { }

    onStart(): void {
        // Watching starts immediately, so an edit made during startup is still
        // captured. Restoring waits for the layout, because a tab opened before
        // the tab bar is initialized is one the layout then overwrites: a
        // second launch would restore the buffer and then lose the tab again.
        if (this.isEnabled()) {
            this.watchEditors();
        }
    }

    onDidInitializeLayout(): void {
        if (this.isEnabled()) {
            void this.recoverBackups();
        }
    }

    onStop(): void {
        for (const handle of this.pendingWrites.values()) {
            clearTimeout(handle);
        }
        this.pendingWrites.clear();
        this.toDispose.dispose();
    }

    protected intervalMs(): number {
        const seconds = this.preferences.get<number>(NOTEPADIA_BACKUP_INTERVAL_PREFERENCE, DEFAULT_BACKUP_INTERVAL_SECONDS);
        // Notepad++ clamps its own backup interval; a zero or negative interval
        // would otherwise turn the debounce into a busy loop.
        return Math.max(1, Math.floor(seconds) || DEFAULT_BACKUP_INTERVAL_SECONDS) * 1000;
    }

    protected isEnabled(): boolean {
        return this.preferences.get<boolean>(NOTEPADIA_BACKUP_ENABLED_PREFERENCE, true);
    }

    /**
     * Run one store operation on a connection of its own and close it again.
     *
     * The connection is deliberately not cached for the lifetime of the page.
     * A connection still open when the page unloads keeps the renderer busy
     * enough to stall a browser reload, which is exactly the navigation this
     * feature exists to survive, and it shows up as a reload that never
     * finishes rather than as anything resembling a backup failure.
     */
    protected async withDb<T>(work: (db: IDBDatabase) => Promise<T>): Promise<T> {
        const db = await this.openConnection();
        try {
            return await work(db);
        } finally {
            db.close();
        }
    }

    protected openConnection(): Promise<IDBDatabase> {
        return new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open(BACKUP_DB_NAME, BACKUP_DB_VERSION);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(BACKUP_STORE)) {
                    db.createObjectStore(BACKUP_STORE, { keyPath: 'key' });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error ?? new Error('backup store unavailable'));
            // Another window holding an older version open would block the
            // upgrade forever; failing fast keeps the editor working.
            request.onblocked = () => reject(new Error('backup store blocked by another window'));
        });
    }

    protected async withStore<T>(
        mode: IDBTransactionMode,
        action: (store: IDBObjectStore) => IDBRequest<T> | void
    ): Promise<T | undefined> {
        return this.withDb(db => new Promise<T | undefined>((resolve, reject) => {
            const transaction = db.transaction(BACKUP_STORE, mode);
            let request: IDBRequest<T> | void;
            try {
                request = action(transaction.objectStore(BACKUP_STORE));
            } catch (error) {
                reject(error);
                return;
            }
            if (!request) {
                // No request to wait for: the transaction's own completion is
                // the signal, which is what a delete-all needs.
                transaction.oncomplete = () => resolve(undefined);
                transaction.onerror = () => reject(transaction.error);
                return;
            }
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        }));
    }

    /** Every stored record, newest first, with unreadable entries dropped. */
    protected async readAll(): Promise<BackupRecord[]> {
        try {
            const raw = await this.withStore<unknown[]>('readonly', store => store.getAll());
            return parseBackupList(raw ?? []);
        } catch {
            // A store that cannot be read is a store that cannot help. The
            // app is still usable; it just cannot recover.
            return [];
        }
    }

    /** One stored record, or undefined if it is absent or unreadable. */
    protected async read(key: string): Promise<BackupRecord | undefined> {
        try {
            return parseBackupRecord(await this.withStore<unknown>('readonly', store => store.get(key)));
        } catch {
            return undefined;
        }
    }

    protected async write(record: BackupRecord): Promise<void> {
        try {
            await this.withStore('readwrite', store => store.put(record));
            await this.enforceBudget();
        } catch (error) {
            // Quota is the expected failure here, not an exception. A failed
            // backup must never surface as a broken editor.
            console.warn('[notepadia] backup write failed', error);
        }
    }

    protected async remove(key: string): Promise<void> {
        try {
            await this.withStore('readwrite', store => store.delete(key));
        } catch (error) {
            console.warn('[notepadia] backup delete failed', error);
        }
    }

    protected async enforceBudget(): Promise<void> {
        // `selectBackupsToEvict` owns the policy - which record to drop and in
        // what order - so this only has to apply what it decides.
        const all = await this.readAll();
        for (const key of selectBackupsToEvict(all, DEFAULT_MAX_BACKUP_BYTES)) {
            await this.remove(key);
        }
    }

    // -------------------------------------------------------------- capture

    /**
     * Snapshot a widget if it is dirty and small enough, or clear its backup if
     * it has been saved since the last snapshot.
     */
    protected async capture(widget: EditorWidget): Promise<void> {
        if (!this.isEnabled()) {
            return;
        }
        const key = this.keyFor(widget);
        if (!key) {
            return;
        }
        // The decision itself is pure and unit-tested; this only supplies the
        // facts it needs. The content has to be read to know its size, which is
        // why a Monaco-backed widget is required before the policy can run.
        const editor = MonacoEditor.get(widget);
        const control = editor?.getControl();
        const model = control?.getModel();
        const dirty = Saveable.isDirty(widget);
        if (!control || !model) {
            // A widget we cannot read is a widget we cannot judge, so the
            // cheaper part of the policy still applies: a clean one is done.
            if (decideBackupAction({ enabled: this.isEnabled(), dirty, tooLarge: false }) === 'clear') {
                await this.remove(key);
            }
            return;
        }
        const content = model.getValue();
        const action = decideBackupAction({
            enabled: this.isEnabled(),
            dirty,
            tooLarge: !isBackupableSize(content),
            ...(await this.clearEvidence(key, widget, content))
        });
        if (action === 'clear') {
            await this.remove(key);
            return;
        }
        if (action === 'skip') {
            return;
        }
        const position = control.getPosition();
        await this.write(createBackupRecord({
            key,
            label: widget.title.label,
            content,
            line: position?.lineNumber ?? 1,
            column: position?.column ?? 1,
            savedAt: Date.now(),
            ...(await this.mtimeFor(widget))
        }));
    }

    /**
     * The two facts that justify deleting a backup for a clean buffer: the text
     * on screen is the text that was stored, or it is the text on disk. Both
     * are only needed when a buffer has just gone clean, which happens on save
     * or revert rather than on every keystroke.
     */
    protected async clearEvidence(key: string, widget: EditorWidget, content: string):
        Promise<{ matchesBackup?: boolean; matchesFile?: boolean }> {
        const stored = await this.read(key);
        if (stored && stored.content === content) {
            return { matchesBackup: true };
        }
        const uri = NavigatableWidget.getUri(widget);
        if (!uri || uri.scheme === 'untitled') {
            return {};
        }
        try {
            const file = await this.fileService.readFile(uri);
            // A file the editor opened as binary has no text to compare, and
            // guessing at an encoding here would be worse than not clearing.
            return { matchesFile: typeof file.value === 'string' && file.value === content };
        } catch {
            return {};
        }
    }

    /** Identity of a buffer: its URI, untitled or file-backed. */
    protected keyFor(widget: EditorWidget): string | undefined {
        return NavigatableWidget.getUri(widget)?.toString() || widget.id;
    }

    protected async mtimeFor(widget: EditorWidget): Promise<{ fileMtime?: number }> {
        const uri = NavigatableWidget.getUri(widget);
        if (!uri || uri.scheme === 'untitled') {
            return {};
        }
        try {
            const stat = await this.fileService.resolve(uri);
            return { fileMtime: stat.mtime };
        } catch {
            // No stat yet (still loading, or gone from disk) means "not newer
            // than the file", which is the safe direction: do not restore over
            // a file we could not prove was unchanged.
            return {};
        }
    }

    /**
     * Watch every open editor. Content changes arm the debounce; a widget
     * closing while still dirty has its last snapshot taken immediately,
     * because there will be no further content change to trigger one.
     */
    protected watchEditors(): void {
        for (const widget of this.shell.widgets) {
            this.watchWidget(widget);
        }
        this.toDispose.push(this.shell.onDidAddWidget(widget => this.watchWidget(widget)));
        this.toDispose.push(this.shell.onDidRemoveWidget(widget => {
            // A tab closed while still dirty will never fire another content
            // change, so its last snapshot is taken here. Closing *with* a save
            // flips `dirty` first, so the save still wins the race and clears
            // the backup instead of writing it.
            if (Saveable.isDirty(widget)) {
                void this.capture(widget as EditorWidget);
            }
            const key = this.keyFor(widget as EditorWidget);
            if (key) {
                const handle = this.pendingWrites.get(key);
                if (handle) {
                    clearTimeout(handle);
                    this.pendingWrites.delete(key);
                }
            }
        }));
    }

    protected watchWidget(widget: Widget): void {
        if (!Saveable.isSource(widget)) {
            return;
        }
        const saveable = widget.saveable;
        // `onContentChanged` is the debounced-friendly signal; `onDirtyChanged`
        // is what tells us a save happened, which must clear the backup now
        // rather than waiting out the timer.
        this.toDispose.push(saveable.onContentChanged(() => this.arm(widget as EditorWidget)));
        this.toDispose.push(saveable.onDirtyChanged(() => void this.capture(widget as EditorWidget)));
    }

    protected arm(widget: EditorWidget): void {
        const key = this.keyFor(widget);
        if (!key) {
            return;
        }
        const existing = this.pendingWrites.get(key);
        if (existing) {
            clearTimeout(existing);
        }
        this.pendingWrites.set(key, setTimeout(() => {
            this.pendingWrites.delete(key);
            void this.capture(widget);
        }, this.intervalMs()));
    }

    // -------------------------------------------------------------- restore

    protected async recoverBackups(): Promise<void> {
        if (!this.isEnabled()) {
            return;
        }
        const all = await this.readAll();
        if (all.length === 0) {
            return;
        }
        const restored: BackupRecord[] = [];
        for (const backup of all) {
            const uri = this.uriFor(backup);
            if (!uri) {
                continue;
            }
            const currentMtime = await this.currentMtimeFor(uri);
            if (!isBackupWorthRestoring(backup, currentMtime)) {
                // The file caught up with the backup, or the buffer is gone.
                // Either way there is nothing to recover.
                await this.remove(backup.key);
                continue;
            }
            if (await this.restore(backup, uri)) {
                restored.push(backup);
            }
        }
        if (restored.length > 0) {
            this.onDidRestoreEmitter.fire(restored);
            void this.messageService.info(describeRecovery(restored.map(r => r.label)));
        }
    }

    protected uriFor(backup: BackupRecord): URI | undefined {
        try {
            return new URI(backup.key);
        } catch {
            return undefined;
        }
    }

    protected async currentMtimeFor(uri: URI): Promise<number | undefined> {
        if (uri.scheme === 'untitled') {
            // Nothing on disk to be newer than, which is what makes an
            // untitled backup always worth restoring.
            return undefined;
        }
        try {
            const stat = await this.fileService.resolve(uri);
            return stat.mtime;
        } catch {
            return undefined;
        }
    }

    /**
     * Reopen a buffer with its text and caret.
     *
     * The restored tab is left dirty on purpose: the recovered text is not on
     * disk yet, and marking it clean would make Ctrl+S a no-op and hide the
     * fact that there is something to save.
     *
     * The backup is deliberately *not* deleted here. The recovered work is
     * still unsaved, so a second crash before the next interval would lose it
     * again. Reopening an already-open URI reuses that tab rather than
     * duplicating it, so a second launch simply recovers the same buffer
     * again. The record is removed when the user saves or discards it.
     */
    protected async restore(backup: BackupRecord, uri: URI): Promise<boolean> {
        try {
            const widget = await this.editorManager.open(uri, { mode: 'activate' });
            const editor = MonacoEditor.get(widget);
            const control = editor?.getControl();
            const model = control?.getModel();
            if (!control || !model) {
                return false;
            }
            if (model.getValue() !== backup.content) {
                model.pushEditOperations(
                    [],
                    [{ range: model.getFullModelRange(), text: backup.content }],
                    () => null
                );
            }
            const lastLine = model.getLineCount();
            const line = Math.min(Math.max(1, backup.line), lastLine);
            const column = Math.min(Math.max(1, backup.column), model.getLineMaxColumn(line));
            control.setPosition({ lineNumber: line, column });
            return true;
        } catch (error) {
            console.warn('[notepadia] backup restore failed', backup.key, error);
            return false;
        }
    }
}

export const notepadiaBackupPreferenceSchema: PreferenceSchema = {
    properties: {
        [NOTEPADIA_BACKUP_ENABLED_PREFERENCE]: {
            type: 'boolean',
            default: true,
            description: 'Whether to keep a periodic copy of unsaved changes in the browser, so a closed or crashed tab can be recovered on the next launch.'
        },
        [NOTEPADIA_BACKUP_INTERVAL_PREFERENCE]: {
            type: 'integer',
            default: DEFAULT_BACKUP_INTERVAL_SECONDS,
            minimum: 1,
            description: 'How many seconds to wait after the last keystroke before copying an unsaved document into the backup store.'
        }
    }
};

export const NotepadiaBackupPreferences: PreferenceContribution = { schema: notepadiaBackupPreferenceSchema };
