import { inject, injectable, optional } from '@theia/core/shared/inversify';
import {
    Command,
    CommandContribution,
    CommandRegistry,
    MenuContribution,
    MenuModelRegistry,
    MessageService
} from '@theia/core/lib/common';
import { DisposableCollection } from '@theia/core/lib/common/disposable';
import { PreferenceService } from '@theia/core/lib/common/preferences';
import { AbstractDialog } from '@theia/core/lib/browser/dialogs';
import { Message } from '@theia/core/lib/browser/widgets';
import { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application-contribution';
import { StorageService } from '@theia/core/lib/browser/storage-service';
import { NavigatableWidget } from '@theia/core/lib/browser/navigatable-types';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';
import { directoryOf, expandRunVariables, RunVariableContext } from '../common/run-variables';
import { NotepadiaRunService } from '../common/notepadia-run-protocol';

export namespace NotepadiaRunCommands {
    export const RUN: Command = {
        id: 'notepadia.run.run',
        category: 'Run',
        label: 'Run...'
    };
    export const MANAGE: Command = {
        id: 'notepadia.run.manage',
        category: 'Run',
        label: 'Modify Shortcut/Delete Command...'
    };
}

/**
 * A Run command the user has named and kept. Notepad++ stores these next to the
 * editor so they survive a restart; here they are persisted through
 * `StorageService` and listed in the Run menu. The dialog keeps Notepad++'s
 * label, `Modify Shortcut/Delete Command...`, but a saved entry carries no
 * shortcut: Notepad++ stores one alongside the command, and without one the
 * label would promise a step the app does not take. Shortcut assignment is
 * left to the global keybinding preferences rather than faked here.
 */
export interface SavedRunCommand {
    readonly name: string;
    readonly command: string;
}

export const NOTEPADIA_RUN_ALLOW_PROCESS_PREFERENCE = 'notepadia.run.allowProcessLaunch';

const RUN_MENU = ['menubar', '6bb_run'];
const SAVED_COMMAND_PREFIX = 'notepadia.run.saved.';
const MAX_SAVED_IN_MENU = 10;
const URL_COMMAND = /^https?:\/\//i;

interface RunDialogActions {
    run(command: string, name: string): void;
    save(name: string, command: string): void;
}

interface ManageDialogActions {
    run(command: string): void;
    delete(names: readonly string[]): void;
}

/** Notepad++'s `Run...` dialog: a command box, an optional saved name, and Run / Save. */
class NotepadiaRunDialog extends AbstractDialog<undefined> {

    protected readonly commandInput: HTMLInputElement;
    protected readonly nameInput: HTMLInputElement;

    constructor(initialCommand: string, protected readonly actions: RunDialogActions) {
        super({ title: 'Run' });

        const panel = document.createElement('div');
        panel.className = 'notepadia-run';

        const commandLabel = document.createElement('label');
        commandLabel.className = 'notepadia-run-label';
        commandLabel.htmlFor = 'notepadia-run-command';
        commandLabel.textContent = 'Command to run';

        this.commandInput = document.createElement('input');
        this.commandInput.type = 'text';
        this.commandInput.id = 'notepadia-run-command';
        this.commandInput.className = 'theia-input';
        this.commandInput.value = initialCommand;
        this.commandInput.setAttribute('aria-label', 'Command to run');

        const nameLabel = document.createElement('label');
        nameLabel.className = 'notepadia-run-label';
        nameLabel.htmlFor = 'notepadia-run-name';
        nameLabel.textContent = 'Save as (optional)';

        this.nameInput = document.createElement('input');
        this.nameInput.type = 'text';
        this.nameInput.id = 'notepadia-run-name';
        this.nameInput.className = 'theia-input';
        this.nameInput.placeholder = 'Name for the Run menu';
        this.nameInput.setAttribute('aria-label', 'Name for the saved command');

        const hint = document.createElement('div');
        hint.className = 'notepadia-run-hint';
        hint.textContent = 'Notepad++ variables such as $(FULL_CURRENT_PATH), $(FILE_NAME), ' +
            '$(CURRENT_DIRECTORY), $(CURRENT_WORD), $(CURRENT_LINE), $(CURRENT_LINESTR) and ' +
            '$(CURRENT_COLUMN) are expanded before the command runs. A command that starts with ' +
            'http:// or https:// opens in a new tab; anything else needs the Notepad desktop build.';

        panel.append(commandLabel, this.commandInput, nameLabel, this.nameInput, hint);

        this.button('Run', true, () => this.submitRun());
        this.button('Save', false, () => this.submitSave());
        this.button('Cancel', false, () => this.close());
        this.contentNode.appendChild(panel);
    }

    get value(): undefined {
        return undefined;
    }

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        this.commandInput.focus();
        this.commandInput.select();
    }

    /**
     * Enter runs the command. The dialog overlay already routes Enter here for
     * every focus position in the dialog, so there is deliberately no second
     * Enter handler on the input - that would run the command twice. Returning
     * false also stops the overlay's own default from resolving the dialog.
     */
    protected handleEnter(_event: KeyboardEvent): boolean {
        this.submitRun();
        return false;
    }

    protected button(label: string, primary: boolean, action: () => void): void {
        this.appendButton(label, primary).addEventListener('click', action);
    }

    protected submitRun(): void {
        const command = this.commandInput.value.trim();
        if (!command) {
            this.commandInput.focus();
            return;
        }
        const name = this.nameInput.value.trim();
        // Close first: saving a named command rebuilds the Run menu, which must
        // not happen while this dialog is still up.
        this.close();
        this.actions.run(command, name);
    }

    protected submitSave(): void {
        const command = this.commandInput.value.trim();
        const name = this.nameInput.value.trim();
        if (!command) {
            this.commandInput.focus();
            return;
        }
        if (!name) {
            this.nameInput.focus();
            return;
        }
        this.close();
        this.actions.save(name, command);
    }
}

/** `Modify Shortcut/Delete Command...`: list the saved Run commands, run or delete one. */
class NotepadiaManageRunDialog extends AbstractDialog<undefined> {

    protected readonly listNode: HTMLDivElement;
    protected readonly emptyNode: HTMLDivElement;
    protected readonly deleteButton: HTMLButtonElement;
    protected readonly runButton: HTMLButtonElement;
    protected selectedIndex = -1;

    constructor(
        protected readonly entries: readonly SavedRunCommand[],
        protected readonly actions: ManageDialogActions
    ) {
        super({ title: 'Modify Shortcut/Delete Command' });

        this.runButton = this.button('Run', true, () => this.runSelected());
        this.deleteButton = this.button('Delete', false, () => this.deleteSelected());
        this.button('Close', false, () => this.close());

        const panel = document.createElement('div');
        panel.className = 'notepadia-run';

        this.listNode = document.createElement('div');
        this.listNode.className = 'notepadia-run-list';
        this.listNode.tabIndex = 0;
        this.listNode.setAttribute('role', 'listbox');
        this.listNode.setAttribute('aria-label', 'Saved Run commands');
        this.listNode.setAttribute('aria-multiselectable', 'false');

        this.emptyNode = document.createElement('div');
        this.emptyNode.className = 'notepadia-run-empty';
        this.emptyNode.textContent = 'No saved Run commands yet. Name one in Run... and press Save.';

        panel.append(this.listNode, this.emptyNode);
        this.contentNode.appendChild(panel);

        this.listNode.addEventListener('click', event => this.onClick(event));
        this.listNode.addEventListener('dblclick', () => this.runSelected());
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

    protected handleEnter(_event: KeyboardEvent): boolean {
        this.runSelected();
        return false;
    }

    protected button(label: string, primary: boolean, action: () => void): HTMLButtonElement {
        const button = this.appendButton(label, primary);
        button.addEventListener('click', action);
        return button;
    }

    protected render(): void {
        this.listNode.textContent = '';
        this.entries.forEach((entry, index) => {
            const row = document.createElement('div');
            row.className = 'notepadia-run-row';
            row.dataset.index = String(index);
            row.setAttribute('role', 'option');
            row.setAttribute('aria-selected', String(index === this.selectedIndex));
            row.tabIndex = -1;

            const name = document.createElement('span');
            name.className = 'notepadia-run-name';
            name.textContent = entry.name;
            const command = document.createElement('span');
            command.className = 'notepadia-run-command';
            command.textContent = entry.command;
            command.title = entry.command;
            row.append(name, command);

            this.listNode.appendChild(row);
        });
        this.emptyNode.style.display = this.entries.length ? 'none' : '';
        const hasSelection = this.selectedIndex >= 0;
        this.runButton.disabled = !hasSelection;
        this.deleteButton.disabled = !hasSelection;
    }

    protected select(index: number): void {
        this.selectedIndex = index;
        this.render();
        this.focusRow(index);
    }

    protected focusRow(index: number): void {
        this.listNode.querySelectorAll<HTMLElement>('.notepadia-run-row')[index]?.focus();
    }

    protected onClick(event: MouseEvent): void {
        const row = (event.target as HTMLElement).closest<HTMLElement>('.notepadia-run-row');
        if (row) {
            this.select(Number(row.dataset.index));
        }
    }

    protected onKeyDown(event: KeyboardEvent): void {
        if (this.entries.length === 0) {
            return;
        }
        switch (event.key) {
            case 'ArrowDown':
                this.select(Math.min(this.entries.length - 1, this.selectedIndex + 1));
                break;
            case 'ArrowUp':
                this.select(Math.max(0, this.selectedIndex - 1));
                break;
            case 'Home':
                this.select(0);
                break;
            case 'End':
                this.select(this.entries.length - 1);
                break;
            case 'Delete':
                this.deleteSelected();
                break;
            case 'Enter':
                this.runSelected();
                break;
            default:
                return;
        }
        event.preventDefault();
        event.stopPropagation();
    }

    protected runSelected(): void {
        const entry = this.entries[this.selectedIndex];
        if (entry) {
            this.actions.run(entry.command);
            this.close();
        }
    }

    protected deleteSelected(): void {
        const entry = this.entries[this.selectedIndex];
        if (entry) {
            this.actions.delete([entry.name]);
            this.close();
        }
    }
}

/**
 * Notepad++'s Run menu.
 *
 * The browser is the shipping target and a page cannot start a process, so the
 * menu is honest about that instead of being a dead end: a `http://`/`https://`
 * command opens in a new tab, and anything else says plainly that launching a
 * program needs the desktop build. The desktop build can actually launch, but
 * only behind the `notepadia.run.allowProcessLaunch` preference, because running
 * an arbitrary saved command is a genuine security surface.
 *
 * The menu is registered only when there is at least one thing it can do, so a
 * browser user never sees a Run menu that only ever apologizes.
 */
@injectable()
export class NotepadiaRunContribution implements CommandContribution, MenuContribution, FrontendApplicationContribution {

    protected static readonly STORAGE_KEY = 'notepadia.run.commands';
    protected static readonly MENU = RUN_MENU;
    protected static readonly COMMAND_PREFIX = SAVED_COMMAND_PREFIX;
    protected static readonly MAX_SAVED_IN_MENU = MAX_SAVED_IN_MENU;
    protected static readonly ALLOW_PROCESS_PREFERENCE = NOTEPADIA_RUN_ALLOW_PROCESS_PREFERENCE;

    protected saved: SavedRunCommand[] = [];
    protected lastCommand = '';
    protected readonly savedMenuDisposables = new DisposableCollection();
    protected readonly toDispose = new DisposableCollection();

    constructor(
        @inject(EditorManager) protected readonly editorManager: EditorManager,
        @inject(CommandRegistry) protected readonly commandRegistry: CommandRegistry,
        @inject(MenuModelRegistry) protected readonly menuRegistry: MenuModelRegistry,
        @inject(StorageService) protected readonly storageService: StorageService,
        @inject(MessageService) protected readonly messageService: MessageService,
        @inject(PreferenceService) protected readonly preferenceService: PreferenceService,
        @inject(NotepadiaRunService) @optional() protected readonly runService?: NotepadiaRunService
    ) { }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(NotepadiaRunCommands.RUN, {
            execute: () => this.openRunDialog()
        });
        commands.registerCommand(NotepadiaRunCommands.MANAGE, {
            isEnabled: () => this.saved.length > 0,
            execute: () => this.openManageDialog()
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        if (!this.available()) {
            return;
        }
        menus.registerSubmenu(NotepadiaRunContribution.MENU, 'Run');
        menus.registerMenuAction(NotepadiaRunContribution.MENU, {
            commandId: NotepadiaRunCommands.RUN.id,
            label: 'Run...',
            order: 'a'
        });
        menus.registerMenuAction(NotepadiaRunContribution.MENU, {
            commandId: NotepadiaRunCommands.MANAGE.id,
            label: 'Modify Shortcut/Delete Command...',
            order: 'z'
        });
    }

    async onStart(): Promise<void> {
        const stored = await this.storageService.getData<{ commands?: SavedRunCommand[] }>(
            NotepadiaRunContribution.STORAGE_KEY, {});
        const commands = stored && Array.isArray(stored.commands) ? stored.commands : [];
        this.saved = commands.filter(entry =>
            !!entry && typeof entry.name === 'string' && typeof entry.command === 'string');
        this.rebuildSavedMenu();
    }

    onStop(): void {
        this.savedMenuDisposables.dispose();
        this.toDispose.dispose();
    }

    // -------------------------------------------------------------- capability

    /** A Run menu is registered only when the menu can actually do something. */
    protected available(): boolean {
        return this.canOpenUrls() || this.canSpawn();
    }

    protected canOpenUrls(): boolean {
        return typeof window !== 'undefined' && typeof window.open === 'function';
    }

    protected canSpawn(): boolean {
        return this.runService !== undefined;
    }

    protected processLaunchAllowed(): boolean {
        return this.preferenceService.get<boolean>(NotepadiaRunContribution.ALLOW_PROCESS_PREFERENCE, false);
    }

    // --------------------------------------------------------------- execution

    protected async execute(raw: string): Promise<void> {
        const expanded = expandRunVariables(raw, this.context()).trim();
        if (!expanded) {
            this.messageService.info('Enter a command to run.');
            return;
        }
        if (URL_COMMAND.test(expanded)) {
            this.openUrl(expanded);
            return;
        }
        if (this.canSpawn() && this.processLaunchAllowed()) {
            await this.spawn(expanded);
            return;
        }
        if (this.canSpawn()) {
            this.messageService.info(
                'Launching programs is turned off. Turn on "notepadia.run.allowProcessLaunch" in Settings to run commands on this computer.');
            return;
        }
        this.messageService.info(
            'A browser tab cannot launch a program. A command that starts with http:// or https:// opens in a new tab; anything else needs the Notepad desktop build.');
    }

    protected openUrl(url: string): void {
        const opened = window.open(url, '_blank', 'noopener,noreferrer');
        if (!opened) {
            this.messageService.warn('The browser blocked the new tab. Allow pop-ups for this page and try again.');
        }
    }

    protected async spawn(expanded: string): Promise<void> {
        const cwd = directoryOf(this.context().fullPath);
        const result = await this.runService!.run(expanded, cwd || undefined);
        if (!result.launched) {
            this.messageService.error(`Could not run "${expanded}": ${result.message ?? 'unknown error'}`);
            return;
        }
        const suffix = result.message ? `\n${result.message}` : '';
        this.messageService.info(`Ran: ${expanded}${suffix}`);
    }

    /**
     * The variables for the current editor. A saved file reports its real path;
     * an unsaved one reports whatever name the tab has, so `$(FILE_NAME)` still
     * produces something rather than nothing.
     */
    protected context(): RunVariableContext {
        const editor = this.editorManager.currentEditor;
        if (!editor) {
            return { fullPath: '' };
        }
        const uri = NavigatableWidget.getUri(editor);
        const fullPath = uri ? uri.path.fsPath() : '';
        const control = MonacoEditor.get(editor)?.getControl();
        const model = control?.getModel();
        if (!control || !model) {
            return { fullPath };
        }
        const position = control.getSelection()?.getPosition();
        if (!position) {
            return { fullPath };
        }
        return {
            fullPath,
            currentWord: model.getWordAtPosition(position)?.word,
            currentLine: position.lineNumber,
            currentLineString: model.getLineContent(position.lineNumber),
            currentColumn: position.column
        };
    }

    // ------------------------------------------------------------------ dialogs

    protected openRunDialog(): void {
        const dialog = new NotepadiaRunDialog(this.lastCommand, {
            run: (command, name) => {
                this.lastCommand = command;
                if (name) {
                    void this.save(name, command);
                }
                void this.execute(command);
            },
            save: (name, command) => {
                this.lastCommand = command;
                void this.save(name, command);
            }
        });
        void dialog.open();
    }

    protected openManageDialog(): void {
        const dialog = new NotepadiaManageRunDialog([...this.saved], {
            run: command => void this.execute(command),
            delete: names => void this.remove(names)
        });
        void dialog.open();
    }

    // -------------------------------------------------------------- persistence

    protected async save(name: string, command: string): Promise<void> {
        const existing = this.saved.findIndex(entry => entry.name === name);
        if (existing >= 0) {
            this.saved[existing] = { name, command };
        } else {
            this.saved.push({ name, command });
        }
        await this.persist();
        this.rebuildSavedMenu();
        this.messageService.info(`Saved the Run command "${name}".`);
    }

    protected async remove(names: readonly string[]): Promise<void> {
        this.saved = this.saved.filter(entry => !names.includes(entry.name));
        await this.persist();
        this.rebuildSavedMenu();
    }

    protected async persist(): Promise<void> {
        await this.storageService.setData(NotepadiaRunContribution.STORAGE_KEY, { commands: this.saved });
    }

    protected rebuildSavedMenu(): void {
        this.savedMenuDisposables.dispose();
        if (!this.available()) {
            return;
        }
        this.saved.slice(0, NotepadiaRunContribution.MAX_SAVED_IN_MENU).forEach((entry, index) => {
            const commandId = NotepadiaRunContribution.COMMAND_PREFIX + index;
            this.savedMenuDisposables.push(this.commandRegistry.registerCommand(
                { id: commandId, label: entry.name },
                { execute: () => void this.execute(entry.command) }
            ));
            this.savedMenuDisposables.push(this.menuRegistry.registerMenuAction(
                NotepadiaRunContribution.MENU,
                { commandId, order: 'b' + String(index).padStart(2, '0') }
            ));
        });
    }
}