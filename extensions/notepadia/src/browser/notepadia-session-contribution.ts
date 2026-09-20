import { inject, injectable } from '@theia/core/shared/inversify';
import { URI } from '@theia/core/lib/common/uri';
import { Command, CommandContribution, CommandRegistry, MenuContribution, MenuModelRegistry } from '@theia/core/lib/common';
import { ApplicationShell, NavigatableWidget } from '@theia/core/lib/browser';
import { CommonMenus } from '@theia/core/lib/browser/common-menus';
import { AbstractDialog } from '@theia/core/lib/browser/dialogs';
import { Message } from '@theia/core/lib/browser/widgets';
import { MessageService } from '@theia/core/lib/common/message-service';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import {
    parseSessionJson,
    serializeSession,
    SESSION_EXTENSION
} from '../common/sessions';

/**
 * Notepad++ style named sessions: "File > Save Session..." persists the open
 * document list (and the active one) as a JSON file in the workspace root;
 * "File > Load Session..." reads one of those files back and reopens the
 * tabs. Entirely browser-side - the file is written through the workspace
 * filesystem.
 */
export namespace NotepadiaSessionCommands {
    export const SAVE_SESSION: Command = { id: 'notepadia.session.save', label: 'Save Session...' };
    export const LOAD_SESSION: Command = { id: 'notepadia.session.load', label: 'Load Session...' };
}

class SessionNameDialog extends AbstractDialog<string | undefined> {
    protected readonly nameInput: HTMLInputElement;

    get value(): string | undefined {
        const name = this.nameInput.value.trim();
        return name ? sanitizeSessionName(name) : undefined;
    }

    constructor(initial: string) {
        super({ title: 'Save Session As...' });
        this.appendAcceptButton('Save');
        this.appendCloseButton('Cancel');

        this.nameInput = document.createElement('input');
        this.nameInput.type = 'text';
        this.nameInput.value = initial;
        this.nameInput.style.width = '100%';
        this.nameInput.style.boxSizing = 'border-box';

        this.contentNode.appendChild(this.nameInput);
    }

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        this.nameInput.focus();
        this.nameInput.select();
    }
}

class SessionChooserDialog extends AbstractDialog<string | undefined> {
    protected readonly select: HTMLSelectElement;

    get value(): string | undefined {
        return this.select.value || undefined;
    }

    constructor(sessions: string[]) {
        super({ title: 'Load Session' });
        this.appendAcceptButton('Load');
        this.appendCloseButton('Cancel');

        this.select = document.createElement('select');
        this.select.style.width = '100%';
        this.select.style.boxSizing = 'border-box';
        if (sessions.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = '(no saved sessions)';
            this.select.append(option);
            this.select.disabled = true;
        } else {
            for (const session of sessions) {
                const option = document.createElement('option');
                option.value = session;
                option.textContent = session;
                this.select.append(option);
            }
        }

        this.contentNode.appendChild(this.select);
    }

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        this.select.focus();
    }
}

function sanitizeSessionName(name: string): string {
    const cleaned = name.replace(/[\\/:*?"<>|]/g, '_').trim();
    return cleaned || 'session';
}

function sessionFileName(name: string): string {
    return name.toLowerCase().endsWith(SESSION_EXTENSION) ? name : `${name}${SESSION_EXTENSION}`;
}

@injectable()
export class NotepadiaSessionContribution implements CommandContribution, MenuContribution {

    constructor(
        @inject(ApplicationShell) protected readonly shell: ApplicationShell,
        @inject(FileService) protected readonly fileService: FileService,
        @inject(WorkspaceService) protected readonly workspaceService: WorkspaceService,
        @inject(MessageService) protected readonly messageService: MessageService,
        @inject(EditorManager) protected readonly editorManager: EditorManager
    ) { }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(NotepadiaSessionCommands.SAVE_SESSION, { execute: () => this.saveSession() });
        commands.registerCommand(NotepadiaSessionCommands.LOAD_SESSION, { execute: () => this.loadSession() });
    }

    registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction([...CommonMenus.FILE], {
            commandId: NotepadiaSessionCommands.SAVE_SESSION.id,
            order: '0j'
        });
        menus.registerMenuAction([...CommonMenus.FILE], {
            commandId: NotepadiaSessionCommands.LOAD_SESSION.id,
            order: '0k'
        });
    }

    protected async saveSession(): Promise<void> {
        const root = this.rootUri();
        if (!root) {
            void this.messageService.warn('Open a workspace to save a session.');
            return;
        }
        const name = await new SessionNameDialog('session').open();
        if (!name) {
            return;
        }
        const uris = this.openDocumentUris();
        const activeUri = this.activeDocumentUri();
        if (uris.length === 0) {
            void this.messageService.warn('No documents are open to save.');
            return;
        }
        const fileUri = root.resolve(sessionFileName(name));
        const content = serializeSession(uris, activeUri && uris.includes(activeUri) ? activeUri : undefined);
        await this.fileService.write(fileUri, content);
        void this.messageService.info(`Session saved as ${name}`);
    }

    protected async loadSession(): Promise<void> {
        const root = this.rootUri();
        if (!root) {
            void this.messageService.warn('Open a workspace to load a session.');
            return;
        }
        const sessions = await this.listSessions(root);
        const name = await new SessionChooserDialog(sessions).open();
        if (!name) {
            return;
        }
        const text = await this.readSession(root.resolve(sessionFileName(name)));
        if (text === undefined) {
            void this.messageService.warn(`Could not read session ${name}.`);
            return;
        }
        const data = parseSessionJson(text);
        if (!data) {
            void this.messageService.warn(`${name} is not a valid session file.`);
            return;
        }
        for (const uri of data.files) {
            try {
                await this.openDocument(uri);
            } catch {
                void this.messageService.warn(`Could not open ${uri} from the session.`);
            }
        }
        if (data.activeFile && data.files.includes(data.activeFile)) {
            await this.openDocument(data.activeFile);
        }
    }

    protected async openDocument(uri: string): Promise<void> {
        const widget = await this.editorManager.open(new URI(uri), { mode: 'activate' });
        this.shell.activateWidget(widget.id);
    }

    protected rootUri(): URI | undefined {
        return this.workspaceService.workspace?.resource;
    }

    protected openDocumentUris(): string[] {
        const uris: string[] = [];
        for (const widget of this.shell.widgets) {
            if (NavigatableWidget.is(widget)) {
                const uri = NavigatableWidget.getUri(widget);
                if (uri) {
                    uris.push(uri.toString());
                }
            }
        }
        return uris;
    }

    protected activeDocumentUri(): string | undefined {
        const current = this.shell.currentWidget;
        const uri = current && NavigatableWidget.is(current) ? NavigatableWidget.getUri(current) : undefined;
        return uri?.toString();
    }

    protected async listSessions(root: URI): Promise<string[]> {
        try {
            const stat = await this.fileService.resolve(root);
            const sessions: string[] = [];
            for (const child of stat.children || []) {
                if (child.isFile && child.name.toLowerCase().endsWith(SESSION_EXTENSION)) {
                    sessions.push(child.name);
                }
            }
            return sessions.sort((a, b) => a.localeCompare(b));
        } catch {
            return [];
        }
    }

    protected async readSession(uri: URI): Promise<string | undefined> {
        try {
            return (await this.fileService.read(uri)).value;
        } catch {
            return undefined;
        }
    }
}