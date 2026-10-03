import { inject, injectable } from '@theia/core/shared/inversify';
import {
    Command,
    CommandContribution,
    CommandRegistry,
    MenuContribution,
    MenuModelRegistry
} from '@theia/core/lib/common';
import { DisposableCollection } from '@theia/core/lib/common/disposable';
import { ApplicationShell, FrontendApplicationContribution, Saveable } from '@theia/core/lib/browser';
import { AbstractDialog } from '@theia/core/lib/browser/dialogs';
import { Message } from '@theia/core/lib/browser/widgets';
import { DocumentSortKey, documentMenuLabel, sortDocuments } from '../common/open-documents';
import { NotepadiaDocument, NotepadiaOpenDocuments } from './notepadia-open-documents';

export namespace NotepadiaWindowCommands {
    export const WINDOWS: Command = {
        id: 'notepadia.window.windows',
        category: 'Window',
        label: 'Windows...'
    };
}

/** What the Windows... dialog may ask the contribution to do. */
interface WindowsDialogActions {
    activate(id: string): void;
    save(documents: readonly NotepadiaDocument[]): Promise<void>;
    close(documents: readonly NotepadiaDocument[]): Promise<void>;
}

/**
 * Notepad++'s `Window ▸ Windows...` dialog: every open document with its Name,
 * Path and Type, multi-select, and the Activate / Save / Close / Sort buttons.
 * The rows are a real listbox - arrow keys move, Space toggles, Enter activates
 * - so the dialog is usable without a mouse.
 */
class NotepadiaWindowsDialog extends AbstractDialog<undefined> {

    protected readonly documents: NotepadiaDocument[];
    protected readonly selected = new Set<string>();
    protected readonly listNode: HTMLDivElement;
    protected readonly emptyNode: HTMLDivElement;

    protected order: NotepadiaDocument[] = [];
    protected sortKey: DocumentSortKey = 'name';
    protected sortAscending = true;
    protected anchorIndex = -1;
    protected focusedIndex = -1;

    constructor(
        documents: readonly NotepadiaDocument[],
        protected readonly actions: WindowsDialogActions
    ) {
        super({ title: 'Windows' });
        this.documents = [...documents];

        // The buttons must exist before `onAfterAttach`, which is where
        // `AbstractDialog` wires the ones it knows about. These are all ours, so
        // each listener is attached here.
        this.button('Activate', true, () => this.activateSelected());
        this.button('Save', false, () => void this.actions.save(this.selectedDocuments()));
        this.button('Close', false, () => void this.closeSelected());
        this.button('Sort', false, () => this.cycleSort());

        const panel = document.createElement('div');
        panel.className = 'notepadia-windows';

        const header = document.createElement('div');
        header.className = 'notepadia-windows-header';
        header.setAttribute('role', 'row');
        for (const column of ['Name', 'Path', 'Type']) {
            const cell = document.createElement('span');
            cell.textContent = column;
            header.appendChild(cell);
        }

        this.listNode = document.createElement('div');
        this.listNode.className = 'notepadia-windows-list';
        this.listNode.tabIndex = 0;
        this.listNode.setAttribute('role', 'listbox');
        this.listNode.setAttribute('aria-label', 'Open documents');
        this.listNode.setAttribute('aria-multiselectable', 'true');

        this.emptyNode = document.createElement('div');
        this.emptyNode.className = 'notepadia-windows-empty';
        this.emptyNode.textContent = 'No open documents';

        panel.append(header, this.listNode, this.emptyNode);
        this.contentNode.appendChild(panel);

        this.listNode.addEventListener('click', event => this.onClick(event));
        this.listNode.addEventListener('dblclick', event => this.onDoubleClick(event));
        this.listNode.addEventListener('keydown', event => this.onKeyDown(event));

        this.render();
    }

    get value(): undefined {
        return undefined;
    }

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        this.listNode.focus();
    }

    /**
     * Enter activates the focused row inside the list rather than resolving the
     * dialog, so it must not also reach the overlay's default handler.
     */
    protected handleEnter(_event: KeyboardEvent): boolean {
        return false;
    }

    protected button(label: string, primary: boolean, action: () => void): void {
        const button = this.appendButton(label, primary);
        button.addEventListener('click', action);
    }

    protected render(): void {
        this.order = sortDocuments(this.documents, this.sortKey, this.sortAscending);
        this.listNode.textContent = '';
        this.order.forEach((doc, index) => {
            const row = document.createElement('div');
            row.className = 'notepadia-windows-row';
            row.dataset.docId = doc.id;
            row.dataset.index = String(index);
            row.setAttribute('role', 'option');
            row.setAttribute('aria-selected', String(this.selected.has(doc.id)));
            row.tabIndex = -1;

            const name = document.createElement('span');
            name.className = 'notepadia-windows-name';
            name.textContent = doc.name;
            const path = document.createElement('span');
            path.className = 'notepadia-windows-path';
            path.textContent = doc.path;
            path.title = doc.path;
            const type = document.createElement('span');
            type.className = 'notepadia-windows-type';
            type.textContent = doc.type;
            row.append(name, path, type);

            this.listNode.appendChild(row);
        });

        this.emptyNode.style.display = this.order.length ? 'none' : '';
    }

    protected focusRow(index: number): void {
        const rows = this.listNode.querySelectorAll<HTMLElement>('.notepadia-windows-row');
        rows[index]?.focus();
    }

    protected selectedDocuments(): NotepadiaDocument[] {
        return this.order.filter(document => this.selected.has(document.id));
    }

    protected selectRange(from: number, to: number): void {
        const start = Math.min(from, to);
        const end = Math.max(from, to);
        this.selected.clear();
        for (let index = start; index <= end; index++) {
            this.selected.add(this.order[index].id);
        }
    }

    protected moveFocus(index: number, extend: boolean): void {
        const clamped = Math.max(0, Math.min(this.order.length - 1, index));
        if (extend && this.anchorIndex >= 0) {
            this.selectRange(this.anchorIndex, clamped);
        } else {
            this.selected.clear();
            this.selected.add(this.order[clamped].id);
            this.anchorIndex = clamped;
        }
        this.focusedIndex = clamped;
        this.render();
        this.focusRow(clamped);
    }

    protected onClick(event: MouseEvent): void {
        const row = (event.target as HTMLElement).closest<HTMLElement>('.notepadia-windows-row');
        if (!row) {
            return;
        }
        const index = Number(row.dataset.index);
        if (event.shiftKey && this.anchorIndex >= 0) {
            this.selectRange(this.anchorIndex, index);
        } else if (event.ctrlKey || event.metaKey) {
            const document = this.order[index];
            if (this.selected.has(document.id)) {
                this.selected.delete(document.id);
            } else {
                this.selected.add(document.id);
            }
            this.anchorIndex = index;
        } else {
            this.selected.clear();
            this.selected.add(this.order[index].id);
            this.anchorIndex = index;
        }
        this.focusedIndex = index;
        this.render();
        this.focusRow(index);
    }

    protected onDoubleClick(event: MouseEvent): void {
        const row = (event.target as HTMLElement).closest<HTMLElement>('.notepadia-windows-row');
        if (!row) {
            return;
        }
        const document = this.order[Number(row.dataset.index)];
        if (document) {
            this.actions.activate(document.id);
            this.close();
        }
    }

    protected onKeyDown(event: KeyboardEvent): void {
        if (this.order.length === 0) {
            return;
        }
        switch (event.key) {
            case 'ArrowDown':
                this.moveFocus(this.focusedIndex + 1, event.shiftKey);
                break;
            case 'ArrowUp':
                this.moveFocus(this.focusedIndex - 1, event.shiftKey);
                break;
            case 'Home':
                this.moveFocus(0, event.shiftKey);
                break;
            case 'End':
                this.moveFocus(this.order.length - 1, event.shiftKey);
                break;
            case ' ':
                if (this.focusedIndex >= 0) {
                    const document = this.order[this.focusedIndex];
                    if (this.selected.has(document.id)) {
                        this.selected.delete(document.id);
                    } else {
                        this.selected.add(document.id);
                    }
                    this.anchorIndex = this.focusedIndex;
                    this.render();
                    this.focusRow(this.focusedIndex);
                }
                break;
            case 'Enter':
                this.activateFocused();
                break;
            default:
                return;
        }
        event.preventDefault();
        event.stopPropagation();
    }

    protected activateSelected(): void {
        const [first] = this.selectedDocuments();
        if (first) {
            this.actions.activate(first.id);
            this.close();
        }
    }

    protected activateFocused(): void {
        if (this.focusedIndex >= 0 && this.focusedIndex < this.order.length) {
            this.actions.activate(this.order[this.focusedIndex].id);
            this.close();
        }
    }

    protected async closeSelected(): Promise<void> {
        const documents = this.selectedDocuments();
        if (documents.length === 0) {
            return;
        }
        await this.actions.close(documents);
        this.close();
    }

    protected cycleSort(): void {
        const keys: DocumentSortKey[] = ['name', 'path', 'type'];
        const next = (keys.indexOf(this.sortKey) + 1) % keys.length;
        if (next === 0) {
            this.sortAscending = !this.sortAscending;
        }
        this.sortKey = keys[next];
        this.focusedIndex = -1;
        this.anchorIndex = -1;
        this.render();
    }
}

/**
 * Notepad++'s `Window` menu: the first ten open documents numbered from the
 * tab order (clicking one activates it), and `Windows...` for the dialog.
 * The numbered entries are rebuilt whenever the open set or the active
 * document changes; the submenu and `Windows...` are registered once.
 */
@injectable()
export class NotepadiaWindowMenuContribution implements CommandContribution, MenuContribution, FrontendApplicationContribution {

    static readonly WINDOW_MENU = ['menubar', '6c_window'];
    static readonly MAX_DOCUMENTS = 10;
    protected static readonly DOCUMENT_COMMAND_PREFIX = 'notepadia.window.document.';

    protected readonly documentMenuDisposables = new DisposableCollection();
    protected readonly toDispose = new DisposableCollection();
    protected rebuildTimer: number | undefined;

    constructor(
        @inject(NotepadiaOpenDocuments) protected readonly documents: NotepadiaOpenDocuments,
        @inject(ApplicationShell) protected readonly shell: ApplicationShell,
        @inject(CommandRegistry) protected readonly commandRegistry: CommandRegistry,
        @inject(MenuModelRegistry) protected readonly menuRegistry: MenuModelRegistry
    ) { }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(NotepadiaWindowCommands.WINDOWS, {
            execute: () => this.openWindowsDialog()
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        menus.registerSubmenu(NotepadiaWindowMenuContribution.WINDOW_MENU, 'Window');
        menus.registerMenuAction(NotepadiaWindowMenuContribution.WINDOW_MENU, {
            commandId: NotepadiaWindowCommands.WINDOWS.id,
            label: 'Windows...',
            order: 'zz'
        });
    }

    onStart(): void {
        this.rebuildDocumentMenu();
        this.toDispose.push(this.documents.onDidChange(() => this.scheduleRebuild()));
    }

    onStop(): void {
        if (this.rebuildTimer !== undefined) {
            window.clearTimeout(this.rebuildTimer);
            this.rebuildTimer = undefined;
        }
        this.documentMenuDisposables.dispose();
        this.toDispose.dispose();
    }

    /**
     * Rebuild on the next tick rather than inside the shell's add/remove emit:
     * each rebuild clears and refills the menu bar, which must not happen while
     * the shell is still telling its listeners that a widget appeared.
     */
    protected scheduleRebuild(): void {
        if (this.rebuildTimer !== undefined) {
            return;
        }
        this.rebuildTimer = window.setTimeout(() => {
            this.rebuildTimer = undefined;
            this.rebuildDocumentMenu();
        }, 0);
    }

    protected rebuildDocumentMenu(): void {
        this.documentMenuDisposables.dispose();
        const documents = this.documents.documents().slice(0, NotepadiaWindowMenuContribution.MAX_DOCUMENTS);
        documents.forEach((document, index) => {
            const commandId = NotepadiaWindowMenuContribution.DOCUMENT_COMMAND_PREFIX + index;
            this.documentMenuDisposables.push(this.commandRegistry.registerCommand(
                { id: commandId, label: documentMenuLabel(index, document.name) },
                { execute: () => this.documents.activate(document.id) }
            ));
            this.documentMenuDisposables.push(this.menuRegistry.registerMenuAction(
                NotepadiaWindowMenuContribution.WINDOW_MENU,
                { commandId, order: String(index).padStart(2, '0') }
            ));
        });
    }

    protected openWindowsDialog(): void {
        const dialog = new NotepadiaWindowsDialog(this.documents.documents(), {
            activate: id => this.documents.activate(id),
            save: documents => this.saveDocuments(documents),
            close: documents => this.closeDocuments(documents)
        });
        void dialog.open();
    }

    protected async saveDocuments(documents: readonly NotepadiaDocument[]): Promise<void> {
        for (const document of documents) {
            const saveable = Saveable.get(document.widget);
            if (saveable) {
                await saveable.save();
            }
        }
    }

    protected async closeDocuments(documents: readonly NotepadiaDocument[]): Promise<void> {
        for (const document of documents) {
            await this.shell.closeWidget(document.id);
        }
    }
}
