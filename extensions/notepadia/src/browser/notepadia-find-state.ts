import { injectable } from '@theia/core/shared/inversify';
import { Emitter } from '@theia/core/lib/common/event';
import {
    DEFAULT_FIND_OPTIONS,
    FindOptions
} from '../common/find-options';

/**
 * The single source of truth for "the search the user is currently
 * performing". The Find dialog (B2) writes its options here on every change
 * and every action; the Mark engine and the F3 / Shift+F3 continuation read
 * them so the dialog, the Search > Mark submenu and the keyboard all agree on
 * the same term and the same options without ever opening Monaco's own find
 * widget.
 */
@injectable()
export class NotepadiaFindState {

    protected readonly onDidChangeEmitter = new Emitter<FindOptions>();

    /** Fired whenever `set()` updates the shared options. */
    readonly onDidChange = this.onDidChangeEmitter.event;

    protected current: FindOptions = DEFAULT_FIND_OPTIONS;

    get(): FindOptions {
        return this.current;
    }

    set(patch: Partial<FindOptions>): FindOptions {
        this.current = { ...this.current, ...patch };
        this.onDidChangeEmitter.fire(this.current);
        return this.current;
    }

    dispose(): void {
        this.onDidChangeEmitter.dispose();
    }
}