import { inject, injectable } from '@theia/core/shared/inversify';
import {
    Command,
    CommandContribution,
    CommandRegistry,
    MenuContribution,
    MenuModelRegistry
} from '@theia/core/lib/common';
import { CommonMenus } from '@theia/core/lib/browser';
import { ConfirmDialog, SingleTextInputDialog } from '@theia/core/lib/browser/dialogs';
import { LabelProvider } from '@theia/core/lib/browser/label-provider';
import { MessageService } from '@theia/core/lib/common/message-service';
import { NavigatableWidget } from '@theia/core/lib/browser/navigatable-types';
import { Saveable } from '@theia/core/lib/browser/saveable';
import { URI } from '@theia/core/lib/common/uri';
import { FileStat } from '@theia/filesystem/lib/common/files';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import { EditorWidget } from '@theia/editor/lib/browser/editor-widget';
import { FileDialogService } from '@theia/filesystem/lib/browser/file-dialog';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';
import {
    copyNameFor,
    deleteFromDiskMessage,
    reloadFromDiskMessage,
    resolveRenameTarget
} from '../common/file-operations';

export namespace NotepadiaFileOperationCommands {
    export const RELOAD_FROM_DISK: Command = {
        id: 'notepadia.file.reloadFromDisk',
        label: 'Reload from Disk'
    };

    export const SAVE_COPY_AS: Command = {
        id: 'notepadia.file.saveCopyAs',
        label: 'Save a Copy As...'
    };

    export const RENAME: Command = {
        id: 'notepadia.file.rename',
        label: 'Rename...'
    };

    export const DELETE_FROM_DISK: Command = {
        id: 'notepadia.file.deleteFromDisk',
        label: 'Delete from Disk'
    };
}

interface DisposableWithoutSaving extends EditorWidget {
    closeWithoutSaving?: () => Promise<void>;
}

/**
 * `EditorWidget` in 1.75 has no `resource` property of its own - the URI is
 * reached through the Navigatable interface, which every editor implements.
 */
function resourceUri(editor: EditorWidget | undefined): URI | undefined {
    return NavigatableWidget.getUri(editor);
}

/**
 * C1 - the File menu entries that act on a real file.
 *
 * Theia can open, save, save-as and close a document, but it has no Reload
 * from Disk, no Save a Copy As, no Rename and no Delete from Disk - all four
 * are things a Notepad++ user reaches for without thinking, and all four are
 * destructive or surprising when they are missing. Every one of them goes
 * through FileService here, so the workspace, the file tree and the tab agree
 * afterwards instead of the bytes being changed behind Theia's back.
 *
 * The rule each of them follows: a command that can lose text asks first, and
 * the question names the file it is about to act on.
 */
@injectable()
export class NotepadiaFileOperationsContribution implements CommandContribution, MenuContribution {

    constructor(
        @inject(EditorManager) protected readonly editorManager: EditorManager,
        @inject(FileService) protected readonly fileService: FileService,
        @inject(FileDialogService) protected readonly fileDialogService: FileDialogService,
        @inject(LabelProvider) protected readonly labelProvider: LabelProvider,
        @inject(MessageService) protected readonly messageService: MessageService
    ) { }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(NotepadiaFileOperationCommands.RELOAD_FROM_DISK, {
            isEnabled: () => this.fileBackedEditor() !== undefined,
            execute: () => this.reloadFromDisk()
        });

        // A copy can be taken of anything, including an untitled document: that
        // is the one case where it is the only way to get the text out of the
        // browser at all.
        commands.registerCommand(NotepadiaFileOperationCommands.SAVE_COPY_AS, {
            isEnabled: () => this.currentModel() !== undefined,
            execute: () => this.saveCopyAs()
        });

        commands.registerCommand(NotepadiaFileOperationCommands.RENAME, {
            isEnabled: () => this.fileBackedEditor() !== undefined,
            execute: () => this.rename()
        });

        commands.registerCommand(NotepadiaFileOperationCommands.DELETE_FROM_DISK, {
            isEnabled: () => this.fileBackedEditor() !== undefined,
            execute: () => this.deleteFromDisk()
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        const file = [...CommonMenus.FILE];
        // Notepad++ order: Save As..., then Save a Copy As..., then Save All.
        menus.registerMenuAction(file, {
            commandId: NotepadiaFileOperationCommands.SAVE_COPY_AS.id,
            label: 'Save a Copy As...',
            order: '0e.2'
        });
        // These three act on the file the current tab belongs to, so they sit
        // below the session and print entries. Notepad++ keeps Rename and
        // Delete in the tab menu instead; the File menu is where a user looks
        // when the tab is not the thing they want to act on, and a browser user
        // has no file-tree habit to fall back on.
        menus.registerMenuAction(file, {
            commandId: NotepadiaFileOperationCommands.RELOAD_FROM_DISK.id,
            label: 'Reload from Disk',
            order: '0n'
        });
        menus.registerMenuAction(file, {
            commandId: NotepadiaFileOperationCommands.RENAME.id,
            label: 'Rename...',
            order: '0o'
        });
        menus.registerMenuAction(file, {
            commandId: NotepadiaFileOperationCommands.DELETE_FROM_DISK.id,
            label: 'Delete from Disk',
            order: '0p'
        });
    }

    // ------------------------------------------------------------- operations

    /**
     * Throw the buffer away and read the file again. The saveable's `revert` is
     * the only path that re-reads through the editor's own resource, so the tab
     * keeps its language, its EOL and its place in the undo history instead of
     * becoming a second, separate document.
     */
    protected async reloadFromDisk(): Promise<void> {
        const editor = this.fileBackedEditor();
        if (!editor) {
            return;
        }
        const name = this.labelProvider.getName(resourceUri(editor)!);
        if (Saveable.isDirty(editor)) {
            const confirmed = await new ConfirmDialog({
                title: 'Reload from Disk',
                msg: reloadFromDiskMessage(name, true),
                ok: 'Reload',
                cancel: 'Cancel'
            }).open();
            if (!confirmed) {
                return;
            }
        }
        try {
            await editor.saveable.revert?.();
            this.messageService.info(`Reloaded ${name} from disk.`);
        } catch (error) {
            this.messageService.error(`Could not reload ${name}: ${this.reason(error)}`);
        }
    }

    /**
     * Write the current buffer to a new file and leave the tab where it was.
     * The difference from Save As is the whole point of the Notepad++ command:
     * "Save As" moves the document, "Save a Copy As" does not, so Ctrl+S
     * afterwards still goes to the original file.
     */
    protected async saveCopyAs(): Promise<void> {
        const editor = this.currentEditor();
        const model = this.currentModel();
        if (!editor || !model) {
            return;
        }
        const source = resourceUri(editor)!;
        // The dialog opens in the document's own folder and starts on its name,
        // so the usual case is typing one new word rather than navigating. An
        // untitled document has no folder behind it, so the dialog just opens
        // wherever it normally does.
        const folder = source.scheme === 'file'
            ? await this.fileService
                .resolve(source.withPath(this.siblingPath(source.path.toString(), '')))
                .catch(() => undefined)
            : undefined;
        const target = await this.fileDialogService.showSaveDialog({
            title: 'Save a Copy As...',
            inputValue: copyNameFor(source.path.base),
            filters: { 'All Files': ['*'] }
        }, folder as FileStat | undefined);
        if (!target) {
            return;
        }
        if (!await this.confirmOverwrite(target)) {
            return;
        }
        try {
            // The text API rather than a buffer, so the copy keeps the
            // document's encoding instead of being forced to UTF-8. `create`
            // for a new file and `write` for an existing one, because the
            // provider underneath will not write a path that is not there.
            const text = model.getValue();
            const encoding = MonacoEditor.get(editor)?.getEncoding();
            if (await this.fileService.exists(target)) {
                await this.fileService.write(target, text, { encoding });
            } else {
                await this.fileService.create(target, text, { encoding });
            }
            this.messageService.info(`Saved a copy as ${this.labelProvider.getName(target)}.`);
        } catch (error) {
            this.messageService.error(`Could not save a copy: ${this.reason(error)}`);
        }
    }

    /**
     * Move the file and keep the tab on it, which is the part that is easy to
     * get wrong: an editor whose resource no longer exists still looks fine on
     * screen and then saves to a path the user never chose.
     */
    protected async rename(): Promise<void> {
        const editor = this.fileBackedEditor();
        if (!editor) {
            return;
        }
        const source = resourceUri(editor)!;
        // The URI path, not the filesystem path: it is already '/'-separated and
        // carries no drive letter, so the resolved path is the new URI path.
        const current = source.path.toString();
        const entered = await new SingleTextInputDialog({
            title: 'Rename',
            initialValue: source.path.base,
            confirmButtonLabel: 'Rename',
            // A `DialogError` string is "the message to show": the empty string
            // is the valid result (`getResult` returns !error.length), which is
            // why an accepted name returns '' rather than undefined.
            validate: value => {
                const result = resolveRenameTarget(current, value);
                return result.ok ? '' : result.reason;
            }
        }).open();
        if (!entered) {
            return;
        }
        const resolved = resolveRenameTarget(current, entered);
        if (!resolved.ok) {
            this.messageService.warn(resolved.reason);
            return;
        }
        const target = source.withPath(resolved.path);
        if (await this.fileService.exists(target) && !await this.confirmReplace(target)) {
            return;
        }
        // Hold on to the text: if the tab has to be re-pointed rather than
        // following the move, an unsaved buffer must not be dropped on the way.
        const text = this.currentModel()?.getValue();
        try {
            await this.fileService.move(source, target, { overwrite: true });
        } catch (error) {
            this.messageService.error(`Could not rename: ${this.reason(error)}`);
            return;
        }
        await this.repointEditor(editor, target, text);
        this.messageService.info(`Renamed to ${this.labelProvider.getName(target)}.`);
    }

    /**
     * Delete the file and close the tab. The editor is closed without saving
     * because the resource it is bound to is about to stop existing; leaving the
     * prompt up would offer to save a file that is already gone.
     */
    protected async deleteFromDisk(): Promise<void> {
        const editor = this.fileBackedEditor();
        if (!editor) {
            return;
        }
        const uri = resourceUri(editor)!;
        const name = this.labelProvider.getName(uri);
        const confirmed = await new ConfirmDialog({
            title: 'Delete from Disk',
            msg: deleteFromDiskMessage(name, Saveable.isDirty(editor)),
            ok: 'Delete',
            cancel: 'Cancel'
        }).open();
        if (!confirmed) {
            return;
        }
        try {
            await this.fileService.delete(uri);
        } catch (error) {
            this.messageService.error(`Could not delete ${name}: ${this.reason(error)}`);
            return;
        }
        const discardable = editor as DisposableWithoutSaving;
        if (typeof discardable.closeWithoutSaving === 'function') {
            await discardable.closeWithoutSaving();
        } else {
            editor.dispose();
        }
        this.messageService.info(`Deleted ${name} from disk.`);
    }

    // --------------------------------------------------------------- internals

    protected async confirmOverwrite(target: URI): Promise<boolean> {
        if (!await this.fileService.exists(target)) {
            return true;
        }
        return Boolean(await new ConfirmDialog({
            title: 'Overwrite',
            msg: `${this.labelProvider.getName(target)} already exists. Overwrite it?`,
            ok: 'Overwrite',
            cancel: 'Cancel'
        }).open());
    }

    protected confirmReplace(target: URI): Promise<boolean> {
        return new ConfirmDialog({
            title: 'Rename',
            msg: `${this.labelProvider.getName(target)} already exists. Replace it?`,
            ok: 'Replace',
            cancel: 'Cancel'
        }).open().then(answer => Boolean(answer));
    }

    /**
     * Put the open tab on the renamed file.
     *
     * Theia does not re-target an editor when the file underneath it is moved:
     * the tab would keep pointing at the old path and the next save would
     * recreate the file the user just renamed away. So the new resource is
     * opened and the text that was on screen is re-applied to it before the
     * stale tab is dropped, which is what keeps a rename from costing the user
     * unsaved text.
     *
     * `tab-replace` is deliberately not used: by the time the move has
     * happened the old widget is no longer a usable reference in the shell
     * layout, and asking for it throws "Reference widget is not in the
     * layout".
     */
    protected async repointEditor(editor: EditorWidget, target: URI, text: string | undefined): Promise<void> {
        if (resourceUri(editor)?.toString() === target.toString()) {
            return;
        }
        const replacement = await this.editorManager.getByUri(target)
            ?? await this.editorManager.open(target, { mode: 'activate' });
        if (text !== undefined) {
            const model = MonacoEditor.get(replacement)?.getControl()?.getModel();
            if (model && model.getValue() !== text) {
                model.pushEditOperations([], [{ range: model.getFullModelRange(), text }], () => null);
            }
        }
        editor.dispose();
    }

    protected currentEditor(): EditorWidget | undefined {
        return this.editorManager.currentEditor ?? undefined;
    }

    protected currentModel() {
        const editor = this.currentEditor();
        return editor ? MonacoEditor.get(editor)?.getControl()?.getModel() : undefined;
    }

    /** The current editor, but only when a real file is behind it. */
    protected fileBackedEditor(): EditorWidget | undefined {
        const editor = this.currentEditor();
        if (!editor || !Saveable.isSource(editor) || resourceUri(editor)!.scheme !== 'file') {
            return undefined;
        }
        return editor;
    }

    protected siblingPath(path: string, name: string): string {
        const slash = path.lastIndexOf('/');
        return slash < 0 ? `/${name}` : `${path.slice(0, slash)}/${name}`;
    }

    protected reason(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}
