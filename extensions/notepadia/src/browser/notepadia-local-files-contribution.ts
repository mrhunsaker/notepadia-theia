import { inject, injectable } from '@theia/core/shared/inversify';
import {
    Command,
    CommandContribution,
    CommandRegistry,
    MenuContribution,
    MenuModelRegistry,
    nls
} from '@theia/core/lib/common';
import { BinaryBuffer } from '@theia/core/lib/common/buffer';
import { UNTITLED_SCHEME, UntitledResourceResolver } from '@theia/core/lib/common/resource';
import { URI } from '@theia/core/lib/common/uri';
import { MessageService } from '@theia/core/lib/common/message-service';
import {
    CommonCommands,
    CommonMenus,
    OpenerService,
    open
} from '@theia/core/lib/browser';
import { NavigatableWidget } from '@theia/core/lib/browser/navigatable-types';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { FileDialogService } from '@theia/filesystem/lib/browser/file-dialog';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import {
    LOCAL_FILE_PICKER_TYPES,
    PickerOutcome,
    classifyPickerError,
    downloadText,
    readFileAsText,
    suggestedSaveName,
    uniqueName
} from '../common/local-files';

export namespace NotepadiaLocalFileCommands {
    /** Reads a file from the user's own disk into a new tab. */
    export const OPEN_LOCAL: Command = {
        id: 'notepadia.file.openLocal',
        label: 'Open From This Computer...'
    };
    /** Writes the current tab to the user's own disk, leaving the tab alone. */
    export const SAVE_LOCAL: Command = {
        id: 'notepadia.file.saveLocal',
        label: 'Save To This Computer...'
    };
    /** Copies a file from the user's own disk into the SERVER's workspace. */
    export const UPLOAD_TO_WORKSPACE: Command = {
        id: 'notepadia.file.uploadToWorkspace',
        label: 'Upload to Workspace...'
    };
}

/**
 * The subset of the File System Access API this contribution uses. Declared
 * locally so the extension compiles without the ambient DOM lib and so the
 * picker can be feature-detected (it is Chromium-only, and requires a secure
 * context).
 */
interface FileSystemAccessWindow {
    showOpenFilePicker?: (options?: unknown) => Promise<FileSystemHandleLike[]>;
    showSaveFilePicker?: (options?: unknown) => Promise<FileSystemHandleLike>;
}

interface FileSystemHandleLike {
    readonly name: string;
    getFile(): Promise<File>;
    createWritable(): Promise<{ write(text: string): Promise<void>; close(): Promise<void> }>;
}

const LOCAL_FILE_INPUT_ID = 'notepadia-local-file-input';

/**
 * D1 - the two storages a Notepad++ user expects, made reachable in a
 * browser-hosted app.
 *
 * Notepad++'s File > Open and File > Save always mean "my own disk". A
 * Theia served over HTTP has no such notion: the only files it can name live
 * on the SERVER, so as shipped a remote user could neither read a file off
 * their laptop nor get one back. This contribution adds the missing bridge
 * with three commands whose labels say which storage they touch:
 *
 *   Open From This Computer...  user's disk  -> editor tab
 *   Save To This Computer...    editor tab   -> user's disk
 *   Upload to Workspace...      user's disk  -> server workspace
 *
 * On Chromium the round trip is lossless: the picked `FileSystemFileHandle` is
 * kept per tab, so the ordinary Ctrl+S on a tab opened this way writes straight
 * back to the same file on the same disk instead of falling through to Theia's
 * Save As dialog. On Firefox and Safari there is no handle to keep, so the
 * `<input type="file">` route opens the file and `Save To This Computer...`
 * degrades to a browser download.
 */
@injectable()
export class NotepadiaLocalFilesContribution implements CommandContribution, MenuContribution {

    protected readonly handles = new Map<string, FileSystemHandleLike>();

    constructor(
        @inject(UntitledResourceResolver) protected readonly untitledResolver: UntitledResourceResolver,
        @inject(OpenerService) protected readonly openerService: OpenerService,
        @inject(EditorManager) protected readonly editorManager: EditorManager,
        @inject(FileService) protected readonly fileService: FileService,
        @inject(FileDialogService) protected readonly fileDialogService: FileDialogService,
        @inject(WorkspaceService) protected readonly workspaceService: WorkspaceService,
        @inject(MessageService) protected readonly messageService: MessageService
    ) { }

    // ---------------------------------------------------------------- commands

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(NotepadiaLocalFileCommands.OPEN_LOCAL, {
            execute: () => this.openFromThisComputer()
        });
        commands.registerCommand(NotepadiaLocalFileCommands.SAVE_LOCAL, {
            isEnabled: () => this.currentTarget() !== undefined,
            execute: () => this.saveToThisComputer()
        });
        commands.registerCommand(NotepadiaLocalFileCommands.UPLOAD_TO_WORKSPACE, {
            execute: () => this.uploadToWorkspace()
        });

        // Ctrl+S on a tab that came from the user's own disk must go back to
        // that file, not to the server workspace. `registerHandler` puts this
        // handler first in the chain, so reporting it disabled for every other
        // tab hands the command straight on to Theia's own save handler -
        // workspace files and plain untitled documents keep their behaviour.
        commands.registerHandler(CommonCommands.SAVE.id, {
            isEnabled: () => this.currentTarget()?.handle !== undefined,
            execute: async () => {
                const target = this.currentTarget();
                if (!target?.handle) {
                    return;
                }
                await this.writeThroughHandle(target);
            }
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        const file = [...CommonMenus.FILE];
        // "Open..." (Theia's) is the SERVER workspace; these two are the
        // user's own disk and the bridge between them. Grouping them right
        // under Open... is what makes the File menu self-explanatory.
        menus.registerMenuAction(file, {
            commandId: NotepadiaLocalFileCommands.OPEN_LOCAL.id,
            label: 'Open From This Computer...',
            order: '0b.1'
        });
        menus.registerMenuAction(file, {
            commandId: NotepadiaLocalFileCommands.UPLOAD_TO_WORKSPACE.id,
            label: 'Upload to Workspace...',
            order: '0b.2'
        });
        // The local-disk write sits next to Save / Save As, which both mean the
        // server workspace.
        menus.registerMenuAction(file, {
            commandId: NotepadiaLocalFileCommands.SAVE_LOCAL.id,
            label: 'Save To This Computer...',
            order: '0e.1'
        });
    }

    // ------------------------------------------------------------------- open

    /**
     * Opens one or more files from the user's own disk, each in its own tab
     * named after the real file. When a `FileSystemFileHandle` is available it
     * is remembered for the tab so Save writes back to that same file.
     */
    protected async openFromThisComputer(): Promise<void> {
        const picked = await this.pickLocalFiles();
        if (picked === undefined) {
            return;
        }
        if (picked.length === 0) {
            return;
        }
        for (const file of picked) {
            await this.openLocalText(file.name, file.text, file.handle);
        }
    }

    protected async pickLocalFiles(): Promise<Array<{ name: string; text: string; handle?: FileSystemHandleLike }> | undefined> {
        const picker = (window as unknown as FileSystemAccessWindow).showOpenFilePicker;
        if (typeof picker === 'function') {
            try {
                const handles = await picker.call(window, {
                    multiple: true,
                    types: LOCAL_FILE_PICKER_TYPES
                });
                const files: Array<{ name: string; text: string; handle?: FileSystemHandleLike }> = [];
                for (const handle of handles ?? []) {
                    const file = await handle.getFile();
                    files.push({ name: file.name, text: await readFileAsText(file), handle });
                }
                return files;
            } catch (error) {
                if (classifyPickerError(error) === 'cancelled') {
                    return undefined;
                }
                // The API exists but did not work (insecure context, no user
                // activation, ...). Degrade to the input route rather than
                // failing the command.
            }
        }
        return this.pickLocalFilesViaInput();
    }

    /**
     * The Firefox / Safari route: a hidden `<input type="file" multiple>`.
     * Returns undefined when the user dismisses the OS dialog, which browsers
     * report either through a `cancel` event or by simply never firing
     * `change`; the input is reused so a dismissal does not leak elements.
     */
    protected pickLocalFilesViaInput(): Promise<Array<{ name: string; text: string }> | undefined> {
        const existing = document.getElementById(LOCAL_FILE_INPUT_ID) as HTMLInputElement | null;
        if (existing) {
            existing.remove();
        }
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.id = LOCAL_FILE_INPUT_ID;
        input.setAttribute('aria-hidden', 'true');
        input.tabIndex = -1;
        input.style.display = 'none';
        document.body.appendChild(input);

        return new Promise(resolve => {
            const finish = (files: File[] | undefined): void => {
                input.removeEventListener('change', onChange);
                input.removeEventListener('cancel', onCancel);
                if (input.parentNode) {
                    input.parentNode.removeChild(input);
                }
                if (!files || files.length === 0) {
                    resolve(undefined);
                    return;
                }
                Promise.all(Array.from(files).map(async file => ({
                    name: file.name,
                    text: await readFileAsText(file)
                }))).then(resolve, () => resolve(undefined));
            };
            const onChange = (): void => finish(input.files ? Array.from(input.files) : undefined);
            // `cancel` is not universal; onChange covers the browsers that do
            // not fire it.
            const onCancel = (): void => finish(undefined);
            input.addEventListener('change', onChange);
            input.addEventListener('cancel', onCancel);
            input.click();
        });
    }

    /**
     * Seeds an untitled resource with the file's text and opens it. The tab is
     * named after the real file (deduplicated against the tabs already open)
     * so the tab bar and the status bar show `notes.txt`, not `new 1`.
     */
    protected async openLocalText(name: string, text: string, handle?: FileSystemHandleLike): Promise<void> {
        const uri = this.untitledUriFor(name);
        await this.untitledResolver.createUntitledResource(text, '', uri);
        if (handle) {
            this.handles.set(uri.toString(), handle);
        }
        await open(this.openerService, uri);
    }

    protected untitledUriFor(name: string): URI {
        const taken = (candidate: string): boolean =>
            this.untitledResolver.has(new URI().resolve(candidate).withScheme(UNTITLED_SCHEME));
        return new URI().resolve(uniqueName(name, taken)).withScheme(UNTITLED_SCHEME);
    }

    // ------------------------------------------------------------------- save

    /**
     * Writes the current tab to the user's own disk without changing the tab.
     * Uses `showSaveFilePicker` where available and a Blob download
     * everywhere else.
     */
    protected async saveToThisComputer(): Promise<void> {
        const target = this.currentTarget();
        if (!target) {
            this.messageService.warn(nls.localize('notepadia/localFiles/nothingToSave', 'Open a document first.'));
            return;
        }
        if (target.handle) {
            await this.writeThroughHandle(target);
            return;
        }
        const name = suggestedSaveName(target.name);
        const outcome = await this.pickSaveTarget(target, name);
        if (outcome === 'cancelled') {
            return;
        }
        if (outcome === 'saved') {
            this.messageService.info(nls.localize('notepadia/localFiles/savedTo', 'Saved {0} to your computer.', target.name));
            return;
        }
        if (outcome !== 'unavailable') {
            // The dialog was shown and the write failed; say so instead of
            // silently falling through to a download the user never asked for.
            this.reportWriteFailure(target, outcome);
            return;
        }
        // No picker to show: hand the bytes to the browser instead, which is
        // the Firefox / Safari route.
        downloadText(name, target.text);
    }

    /**
     * Shows the OS save dialog. The picked handle is remembered against the
     * tab that was current when the dialog opened, so Save and Ctrl+S on that
     * tab keep writing to the same file afterwards.
     */
    protected async pickSaveTarget(target: LocalTarget, suggested: string): Promise<'saved' | PickerOutcome> {
        const picker = (window as unknown as FileSystemAccessWindow).showSaveFilePicker;
        if (typeof picker !== 'function') {
            return 'unavailable';
        }
        try {
            const handle = await picker.call(window, { suggestedName: suggested });
            if (!handle) {
                return 'cancelled';
            }
            const writable = await handle.createWritable();
            await writable.write(target.text);
            await writable.close();
            this.handles.set(target.uri.toString(), handle);
            return 'saved';
        } catch (error) {
            return classifyPickerError(error);
        }
    }

    /**
     * Ctrl+S / Save To on a tab that still owns its original file handle.
     *
     * A handle that was granted at open time can still be revoked later
     * (the user removes the grant, the file is moved, the tab is restored
     * after a reboot), and `createWritable()` then throws. That has to read
     * as "Notepad++ could not write that file", naming the file, instead of
     * escaping as an unhandled rejection from a keybinding.
     */
    protected async writeThroughHandle(target: LocalTarget): Promise<'written' | PickerOutcome> {
        try {
            const writable = await target.handle!.createWritable();
            await writable.write(target.text);
            await writable.close();
        } catch (error) {
            const outcome = classifyPickerError(error);
            // A silent outcome here would leave the user believing a file was
            // saved when it was not, so only a genuine cancellation is quiet.
            if (outcome !== 'cancelled') {
                this.reportWriteFailure(target, outcome);
            }
            return outcome;
        }
        this.messageService.info(nls.localize(
            'notepadia/localFiles/savedBack',
            'Saved {0} to your computer.',
            target.name
        ));
        return 'written';
    }

    protected reportWriteFailure(target: LocalTarget, outcome: PickerOutcome): void {
        if (outcome === 'denied') {
            this.messageService.error(nls.localize(
                'notepadia/localFiles/permissionDenied',
                'Notepadia was not allowed to write {0}. Allow access to that file and try again.',
                target.name
            ));
        } else {
            this.messageService.error(nls.localize(
                'notepadia/localFiles/saveFailed',
                'Could not write {0} to your computer. It may have been moved, renamed or locked.',
                target.name
            ));
        }
    }

    // --------------------------------------------------------------- upload

    /**
     * Copies a file from the user's own disk into the server workspace, where
     * the explorer, the search backend and every other workspace-aware feature
     * can see it. This is the missing counterpart of Theia's own
     * `file.upload`, which is only enabled when a node is selected in the
     * Files tree and is therefore a dead entry in the File menu.
     */
    protected async uploadToWorkspace(): Promise<void> {
        const picked = await this.pickLocalFiles();
        if (!picked || picked.length === 0) {
            return;
        }
        const root = await this.workspaceService.tryGetRoots();
        const first = root?.[0];
        if (!first) {
            this.messageService.warn(nls.localize(
                'notepadia/localFiles/noWorkspace',
                'No folder is open on the server, so there is nowhere to upload to.'
            ));
            return;
        }
        for (const file of picked) {
            const destination = first.resource.resolve(file.name);
            try {
                if (await this.fileService.exists(destination)) {
                    const confirmed = await this.fileDialogService.showSaveDialog({
                        title: `Upload ${file.name} to the workspace`,
                        inputValue: file.name
                    }, first);
                    if (!confirmed) {
                        continue;
                    }
                    await this.fileService.writeFile(confirmed, BinaryBuffer.fromString(file.text));
                } else {
                    await this.fileService.createFile(destination, BinaryBuffer.fromString(file.text));
                }
                await open(this.openerService, destination);
                this.messageService.info(nls.localize(
                    'notepadia/localFiles/uploaded',
                    'Uploaded {0} to the server workspace.',
                    file.name
                ));
            } catch (error) {
                this.messageService.error(nls.localize(
                    'notepadia/localFiles/uploadFailed',
                    'Could not upload {0} to the workspace: {1}',
                    file.name,
                    String(error)
                ));
            }
        }
    }

    // ----------------------------------------------------------------- shared

    protected currentTarget(): LocalTarget | undefined {
        const editor = this.editorManager.currentEditor;
        if (!editor) {
            return undefined;
        }
        const uri = NavigatableWidget.getUri(editor);
        const model = MonacoEditor.get(editor)?.getControl()?.getModel();
        if (!uri || !model) {
            return undefined;
        }
        // `uri.path` is a Theia Path, so `toBaseName()` is the tab's file name
        // for both workspace files and untitled tabs named after a local file.
        const name = uri.path.base;
        return {
            uri,
            name,
            text: model.getValue(),
            handle: this.handles.get(uri.toString())
        };
    }
}

interface LocalTarget {
    readonly uri: URI;
    readonly name: string;
    readonly text: string;
    readonly handle?: FileSystemHandleLike;
}
