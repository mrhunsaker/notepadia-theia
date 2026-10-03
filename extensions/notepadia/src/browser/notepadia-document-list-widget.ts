import { inject, injectable } from '@theia/core/shared/inversify';
import { Message } from '@theia/core/shared/@lumino/messaging';
import { DisposableCollection } from '@theia/core/lib/common/disposable';
import { BaseWidget, Saveable } from '@theia/core/lib/browser';
import { NotepadiaDocument, NotepadiaOpenDocuments } from './notepadia-open-documents';

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
.notepadia-document-list-entry.dirty .notepadia-document-list-active-mark { background: var(--theia-notificationsWarningIcon-foreground); }
`;

    protected readonly filterInput: HTMLInputElement;
    protected readonly listNode: HTMLDivElement;
    protected readonly emptyNode: HTMLDivElement;
    protected readonly saveableSubscriptions: Map<string, DisposableCollection> = new Map();
    protected filterText = '';

    constructor(
        @inject(NotepadiaOpenDocuments) protected readonly documents: NotepadiaOpenDocuments
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
            const documentId = item?.dataset.documentId;
            if (documentId) {
                this.documents.activate(documentId);
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
        this.toDispose.push(this.documents.onDidChange(() => {
            this.watchDirty();
            this.update();
        }));
        this.toDispose.push(this.documents.onDidChangeActive(() => this.update()));
        this.watchDirty();
    }

    /** Keep one dirty subscription per open document, driven by the shared model. */
    protected watchDirty(): void {
        const documents = this.documents.documents();
        const openIds = new Set(documents.map(document => document.id));
        for (const [id, subscriptions] of this.saveableSubscriptions) {
            if (!openIds.has(id)) {
                subscriptions.dispose();
                this.saveableSubscriptions.delete(id);
            }
        }
        for (const document of documents) {
            if (this.saveableSubscriptions.has(document.id)) {
                continue;
            }
            const subscriptions = new DisposableCollection();
            const saveable = Saveable.get(document.widget);
            if (saveable) {
                subscriptions.push(saveable.onDirtyChanged(() => this.update()));
            }
            this.saveableSubscriptions.set(document.id, subscriptions);
            this.toDispose.push(subscriptions);
        }
    }

    protected matches(document: NotepadiaDocument): boolean {
        return document.name.toLocaleLowerCase().includes(this.filterText);
    }

    protected renderList(): void {
        const documents = this.documents.documents();
        const visible = documents
            .filter(document => this.matches(document))
            .sort((a, b) => a.name.toLocaleLowerCase().localeCompare(b.name.toLocaleLowerCase()));
        const currentlyActive = this.documents.activeId;

        this.listNode.textContent = '';
        for (const doc of visible) {
            const entry = document.createElement('div');
            entry.className = 'notepadia-document-list-entry';
            entry.classList.toggle('active', doc.id === currentlyActive);
            entry.classList.toggle('dirty', doc.dirty);
            entry.dataset.documentId = doc.id;
            entry.title = doc.path || doc.id;

            const mark = document.createElement('span');
            mark.className = 'notepadia-document-list-active-mark';
            entry.appendChild(mark);

            const label = document.createElement('span');
            label.className = 'notepadia-document-list-file-label';
            label.textContent = doc.name;
            entry.appendChild(label);

            this.listNode.appendChild(entry);
        }

        const empty = documents.length === 0 ? 'No open documents' : 'No matching documents';
        this.emptyNode.textContent = empty;
        this.emptyNode.style.display = visible.length === 0 ? '' : 'none';
    }

    protected activateFirstVisible(): void {
        const first = this.listNode.querySelector<HTMLElement>('.notepadia-document-list-entry');
        const documentId = first?.dataset.documentId;
        if (documentId) {
            this.documents.activate(documentId);
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
