import { inject, injectable } from '@theia/core/shared/inversify';
import { Message } from '@theia/core/shared/@lumino/messaging';
import { Widget } from '@theia/core/shared/@lumino/widgets';
import { DisposableCollection } from '@theia/core/lib/common/disposable';
import { ApplicationShell, BaseWidget, NavigatableWidget, Saveable } from '@theia/core/lib/browser';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';

export const NOTEPADIA_DOCUMENT_LIST_ID = 'notepadia.documentList';

@injectable()
export class NotepadiaDocumentListWidget extends BaseWidget {

    static readonly ID = NOTEPADIA_DOCUMENT_LIST_ID;
    static readonly LABEL = 'Document List';

    protected static readonly STYLE_ID = 'notepadia-document-list-style';
    protected static readonly STYLE_TEXT = `
.notepadia-document-list { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.notepadia-document-list-filter { padding: 4px; }
.notepadia-document-list-filter input { width: 100%; box-sizing: border-box; padding: 4px 6px; background: var(--theia-input-background); color: var(--theia-input-foreground); border: 1px solid var(--theia-input-border, transparent); }
.notepadia-document-list-entries { flex: 1; overflow-y: auto; }
.notepadia-document-list-empty { padding: 8px; opacity: 0.7; }
.notepadia-document-list-entry { display: flex; align-items: center; gap: 6px; padding: 3px 8px; cursor: pointer; white-space: nowrap; user-select: none; }
.notepadia-document-list-entry:hover { background: var(--theia-list-hoverBackground); }
.notepadia-document-list-entry.active { background: var(--theia-list-activeSelectionBackground); color: var(--theia-list-activeSelectionForeground); }
.notepadia-document-list-file-label { overflow: hidden; text-overflow: ellipsis; }
.notepadia-document-list-active-mark { width: 8px; height: 8px; border-radius: 50%; flex: none; background: transparent; }
.notepadia-document-list-entry.dirty .notepadia-document-list-active-mark { background: var(--theia-notificationsWarningIcon-foreground, #cca700); }
`;

    protected readonly filterInput: HTMLInputElement;
    protected readonly listNode: HTMLDivElement;
    protected readonly emptyNode: HTMLDivElement;
    protected readonly saveableSubscriptions: Map<Widget, DisposableCollection> = new Map();
    protected filterText = '';

    constructor(
        @inject(ApplicationShell) protected readonly shell: ApplicationShell,
        @inject(EditorManager) protected readonly editorManager: EditorManager
    ) {
        super();
        this.id = NotepadiaDocumentListWidget.ID;
        this.title.label = NotepadiaDocumentListWidget.LABEL;
        this.title.caption = 'List of all open documents, Notepad++ style';
        this.title.closable = true;
        this.title.iconClass = 'codicon codicon-files';
        this.addClass('notepadia-document-list');
        this.injectStyle();

        this.filterInput = document.createElement('input');
        this.filterInput.type = 'text';
        this.filterInput.placeholder = 'Filter...';
        this.filterInput.addEventListener('input', () => {
            this.filterText = this.filterInput.value.toLocaleLowerCase();
            this.update();
        });
        this.filterInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.activateFirstVisible();
            }
        });
        const filterArea = document.createElement('div');
        filterArea.className = 'notepadia-document-list-filter';
        filterArea.appendChild(this.filterInput);
        this.node.appendChild(filterArea);

        this.listNode = document.createElement('div');
        this.listNode.className = 'notepadia-document-list-entries';
        this.node.appendChild(this.listNode);

        this.emptyNode = document.createElement('div');
        this.emptyNode.className = 'notepadia-document-list-empty';
        this.node.appendChild(this.emptyNode);

        this.listNode.addEventListener('click', event => {
            const item = (event.target as HTMLElement).closest<HTMLElement>('.notepadia-document-list-entry');
            const widgetId = item?.dataset.widgetId;
            if (widgetId) {
                void this.shell.activateWidget(widgetId);
            }
        });
    }

    protected onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        this.wireListeners();
    }

    protected onAfterShow(msg: Message): void {
        super.onAfterShow(msg);
        this.filterInput.focus();
    }

    protected onUpdateRequest(msg: Message): void {
        super.onUpdateRequest(msg);
        this.renderList();
    }

    protected wireListeners(): void {
        this.toDispose.push(this.shell.onDidAddWidget(widget => {
            if (NavigatableWidget.is(widget)) {
                this.watchDirty(widget);
                this.update();
            }
        }));
        this.toDispose.push(this.shell.onDidRemoveWidget(widget => {
            if (NavigatableWidget.is(widget)) {
                const subscriptions = this.saveableSubscriptions.get(widget);
                if (subscriptions) {
                    subscriptions.dispose();
                    this.saveableSubscriptions.delete(widget);
                }
            }
            this.update();
        }));
        this.toDispose.push(this.shell.onDidChangeCurrentWidget(() => this.update()));
        this.toDispose.push(this.editorManager.onCurrentEditorChanged(() => this.update()));
        for (const widget of this.openWidgets()) {
            this.watchDirty(widget);
        }
    }

    protected watchDirty(widget: NavigatableWidget): void {
        if (this.saveableSubscriptions.has(widget)) {
            return;
        }
        const subscriptions = new DisposableCollection();
        const saveable = Saveable.get(widget);
        if (saveable) {
            subscriptions.push(saveable.onDirtyChanged(() => this.update()));
        }
        this.saveableSubscriptions.set(widget, subscriptions);
        this.toDispose.push(subscriptions);
    }

    protected openWidgets(): NavigatableWidget[] {
        const result: NavigatableWidget[] = [];
        for (const widget of this.shell.widgets) {
            if (NavigatableWidget.is(widget)) {
                result.push(widget);
            }
        }
        return result;
    }

    protected labelFor(widget: NavigatableWidget): string {
        const uri = NavigatableWidget.getUri(widget);
        const label = uri ? uri.path.base : widget.title.label;
        return label || widget.id;
    }

    protected detailFor(widget: NavigatableWidget): string {
        const uri = NavigatableWidget.getUri(widget);
        return uri ? uri.path.toString() : widget.id;
    }

    protected renderList(): void {
        const widgets = this.openWidgets()
            .filter(widget => this.labelFor(widget).toLocaleLowerCase().includes(this.filterText))
            .sort((a, b) => this.labelFor(a).toLocaleLowerCase().localeCompare(this.labelFor(b).toLocaleLowerCase()));
        const currentlyActive = this.shell.currentWidget?.id ?? this.editorManager.currentEditor?.id;

        this.listNode.textContent = '';
        for (const widget of widgets) {
            const entry = document.createElement('div');
            entry.className = 'notepadia-document-list-entry';
            entry.classList.toggle('active', widget.id === currentlyActive);
            entry.classList.toggle('dirty', Saveable.isDirty(widget));
            entry.dataset.widgetId = widget.id;
            entry.title = this.detailFor(widget);

            const mark = document.createElement('span');
            mark.className = 'notepadia-document-list-active-mark';
            entry.appendChild(mark);

            const label = document.createElement('span');
            label.className = 'notepadia-document-list-file-label';
            label.textContent = this.labelFor(widget);
            entry.appendChild(label);

            this.listNode.appendChild(entry);
        }

        const isEmpty = this.openWidgets().length === 0;
        const empty = isEmpty ? 'No open documents' : 'No matching documents';
        this.emptyNode.textContent = empty;
        this.emptyNode.style.display = widgets.length === 0 ? '' : 'none';
    }

    protected activateFirstVisible(): void {
        const first = this.listNode.querySelector<HTMLElement>('.notepadia-document-list-entry');
        const widgetId = first?.dataset.widgetId;
        if (widgetId) {
            void this.shell.activateWidget(widgetId);
        }
    }

    protected injectStyle(): void {
        if (document.getElementById(NotepadiaDocumentListWidget.STYLE_ID)) {
            return;
        }
        const style = document.createElement('style');
        style.id = NotepadiaDocumentListWidget.STYLE_ID;
        style.textContent = NotepadiaDocumentListWidget.STYLE_TEXT;
        document.head.appendChild(style);
    }
}