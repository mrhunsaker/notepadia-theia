import { inject, injectable } from '@theia/core/shared/inversify';
import { Widget } from '@theia/core/shared/@lumino/widgets';
import { Emitter, Event } from '@theia/core/lib/common/event';
import { Disposable, DisposableCollection } from '@theia/core/lib/common/disposable';
import { URI } from '@theia/core/lib/common/uri';
import { ApplicationShell, NavigatableWidget, Saveable } from '@theia/core/lib/browser';
import { documentType } from '../common/open-documents';

/** One open document, as both the Document List and the Window menu see it. */
export interface NotepadiaDocument {
    readonly widget: NavigatableWidget;
    readonly id: string;
    readonly name: string;
    readonly path: string;
    readonly type: string;
    readonly dirty: boolean;
    readonly uri: URI | undefined;
}

/**
 * The single model behind the two surfaces that list the open documents:
 * `View ▸ Document List` and the `Window` menu / `Windows...` dialog. It owns
 * the shell listeners and the naming rules so the two views stay in step, and
 * fires `onDidChange` whenever the set, the active document or a dirty flag
 * changes.
 */
@injectable()
export class NotepadiaOpenDocuments implements Disposable {

    protected readonly onDidChangeEmitter = new Emitter<void>();
    /** Fired when the set of open documents changes. */
    readonly onDidChange: Event<void> = this.onDidChangeEmitter.event;
    protected readonly onDidChangeActiveEmitter = new Emitter<void>();
    /**
     * Fired when only the active document changes. Kept separate from
     * {@link onDidChange} because rebuilding the Window menu clears and refills
     * the menu bar, and opening a menu itself moves focus: a listener that
     * rebuilt on every active change would tear down the menu being opened.
     */
    readonly onDidChangeActive: Event<void> = this.onDidChangeActiveEmitter.event;
    protected readonly toDispose = new DisposableCollection();

    constructor(@inject(ApplicationShell) protected readonly shell: ApplicationShell) {
        this.toDispose.push(this.shell.onDidAddWidget(widget => {
            if (NavigatableWidget.is(widget)) {
                this.onDidChangeEmitter.fire();
            }
        }));
        this.toDispose.push(this.shell.onDidRemoveWidget(widget => {
            if (NavigatableWidget.is(widget)) {
                this.onDidChangeEmitter.fire();
            }
        }));
        this.toDispose.push(this.shell.onDidChangeCurrentWidget(() => this.onDidChangeActiveEmitter.fire()));
    }

    /** The id of the active document, if the active widget is a document. */
    get activeId(): string | undefined {
        const widget = this.shell.currentWidget;
        return widget && NavigatableWidget.is(widget) ? widget.id : undefined;
    }

    /**
     * Every open document, main-area editors first in tab order and any
     * navigatable widget kept elsewhere afterwards, each listed at most once.
     */
    documents(): NotepadiaDocument[] {
        const seen = new Set<string>();
        const result: NotepadiaDocument[] = [];
        const collect = (widget: Widget): void => {
            if (NavigatableWidget.is(widget) && !seen.has(widget.id)) {
                seen.add(widget.id);
                result.push(this.describe(widget));
            }
        };
        for (const widget of this.shell.getWidgets('main')) {
            collect(widget);
        }
        for (const widget of this.shell.widgets) {
            collect(widget);
        }
        return result;
    }

    activate(id: string): void {
        void this.shell.activateWidget(id);
    }

    protected describe(widget: NavigatableWidget): NotepadiaDocument {
        const uri = NavigatableWidget.getUri(widget);
        const path = uri ? uri.path.toString() : '';
        const name = (uri ? uri.path.base : widget.title.label) || widget.id;
        return {
            widget,
            id: widget.id,
            name,
            path,
            type: documentType(path),
            dirty: Saveable.isDirty(widget),
            uri
        };
    }

    dispose(): void {
        this.toDispose.dispose();
        this.onDidChangeEmitter.dispose();
        this.onDidChangeActiveEmitter.dispose();
    }
}
