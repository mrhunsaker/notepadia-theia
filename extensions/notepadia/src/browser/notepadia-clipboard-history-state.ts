import { injectable } from '@theia/core/shared/inversify';
import { Emitter, Event } from '@theia/core/lib/common/event';
import { addClipboardEntry, CLIPBOARD_HISTORY_LIMIT } from '../common/clipboard-history';

/**
 * The last 20 things copied out of the editor, newest first.
 *
 * Kept in its own injectable singleton rather than inside the contribution, so
 * the panel and the thing that watches for copies are two consumers of one
 * list instead of one of them owning a copy of it. The list itself is
 * deliberately session-only: a clipboard history that survives a reload is a
 * history of text the user no longer has open anywhere.
 */
@injectable()
export class NotepadiaClipboardHistoryState {

    protected entries: string[] = [];

    protected readonly onDidChangeEmitter = new Emitter<void>();
    readonly onDidChange: Event<void> = this.onDidChangeEmitter.event;

    /** Record a copy. A no-op - and no event - when the list would not change. */
    add(text: string): void {
        const next = addClipboardEntry(this.entries, text, CLIPBOARD_HISTORY_LIMIT);
        if (next.length === this.entries.length && next.every((entry, index) => entry === this.entries[index])) {
            return;
        }
        this.entries = next;
        this.onDidChangeEmitter.fire();
    }

    getEntries(): string[] {
        return this.entries;
    }

    clear(): void {
        if (this.entries.length === 0) {
            return;
        }
        this.entries = [];
        this.onDidChangeEmitter.fire();
    }
}
