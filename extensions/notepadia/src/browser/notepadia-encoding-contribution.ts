import { inject, injectable } from '@theia/core/shared/inversify';
import {
    Command,
    CommandContribution,
    CommandRegistry,
    MenuContribution,
    MenuModelRegistry
} from '@theia/core/lib/common';
import URI from '@theia/core/lib/common/uri';
import { BinaryBuffer } from '@theia/core/lib/common/buffer';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { EditorCommands } from '@theia/editor/lib/browser/editor-command';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import { EncodingMode } from '@theia/editor/lib/browser/editor';
import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';

/**
 * Notepad++-style encoding conversion. All conversions run through Theia's own
 * EncodingService (iconv-lite based) via the editor model: the model saves the
 * document with the selected encoding, so the persisted bytes on disk match the
 * menu choice (BOM included where Notepad++ writes it).
 */
export namespace NotepadiaEncodingCommands {
    export const ENCODE_UTF8: Command = { id: 'notepadia.encoding.encodeUtf8', label: 'Encode in UTF-8' };
    export const ENCODE_UTF8_BOM: Command = { id: 'notepadia.encoding.encodeUtf8Bom', label: 'Encode in UTF-8 BOM' };
    export const ENCODE_UTF16_LE: Command = { id: 'notepadia.encoding.encodeUtf16Le', label: 'Encode in UTF-16 LE' };
    export const ENCODE_UTF16_BE: Command = { id: 'notepadia.encoding.encodeUtf16Be', label: 'Encode in UTF-16 BE' };
    export const ENCODE_ANSI: Command = { id: 'notepadia.encoding.encodeAnsi', label: 'Convert to ANSI (Windows 1252)' };
    export const RELOAD_UTF8: Command = { id: 'notepadia.encoding.reloadUtf8', label: 'Reload as UTF-8' };
}

@injectable()
export class NotepadiaEncodingContribution implements CommandContribution, MenuContribution {

    constructor(
        @inject(EditorManager) protected readonly editorManager: EditorManager,
        @inject(FileService) protected readonly fileService: FileService
    ) { }

    registerCommands(commands: CommandRegistry): void {
        const encode = async (encoding: string, mode: EncodingMode) => {
            const widget = this.editorManager.currentEditor;
            if (!widget) {
                return;
            }
            const editor = MonacoEditor.get(widget);
            if (!editor) {
                return;
            }
            await editor.setEncoding(encoding, mode);
            if (encoding === 'utf8bom' && mode === EncodingMode.Encode) {
                await this.ensureUtf8Bom(widget.editor.uri);
            }
        };

        for (const [command, encoding] of [
            [NotepadiaEncodingCommands.ENCODE_UTF8, 'utf8'],
            [NotepadiaEncodingCommands.ENCODE_UTF8_BOM, 'utf8bom'],
            [NotepadiaEncodingCommands.ENCODE_UTF16_LE, 'utf16le'],
            [NotepadiaEncodingCommands.ENCODE_UTF16_BE, 'utf16be'],
            [NotepadiaEncodingCommands.ENCODE_ANSI, 'windows1252']
        ] as const) {
            commands.registerCommand(command, {
                execute: () => encode(encoding, EncodingMode.Encode)
            });
        }

        commands.registerCommand(NotepadiaEncodingCommands.RELOAD_UTF8, {
            execute: () => encode('utf8', EncodingMode.Decode)
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        const encoding = ['menubar', '5_encoding'];
        menus.registerSubmenu(encoding, 'Encoding');

        menus.registerMenuAction(encoding, {
            commandId: NotepadiaEncodingCommands.ENCODE_UTF8.id,
            order: 'a'
        });
        menus.registerMenuAction(encoding, {
            commandId: NotepadiaEncodingCommands.ENCODE_UTF8_BOM.id,
            order: 'b'
        });
        menus.registerMenuAction(encoding, {
            commandId: NotepadiaEncodingCommands.ENCODE_UTF16_LE.id,
            order: 'c'
        });
        menus.registerMenuAction(encoding, {
            commandId: NotepadiaEncodingCommands.ENCODE_UTF16_BE.id,
            order: 'd'
        });
        menus.registerMenuAction(encoding, {
            commandId: NotepadiaEncodingCommands.ENCODE_ANSI.id,
            order: 'e'
        });
        menus.registerMenuAction(encoding, {
            commandId: NotepadiaEncodingCommands.RELOAD_UTF8.id,
            order: 'g'
        });
        menus.registerMenuAction(encoding, {
            commandId: EditorCommands.CHANGE_ENCODING.id,
            label: 'Change File Encoding...',
            order: 'h'
        });
    }

    /**
     * Theia's write pipeline collapses `utf8bom` to `utf8` before deciding on
     * the BOM, so a UTF-8 BOM encode never lands on disk. Write the BOM prefix
     * explicitly until that pipeline preserves the UTF-8 BOM.
     */
    protected async ensureUtf8Bom(uri: URI): Promise<void> {
        try {
            const content = (await this.fileService.readFile(uri)).value;
            const bytes = content.buffer;
            if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
                return;
            }
            const prefixed = new Uint8Array(bytes.length + 3);
            prefixed.set([0xef, 0xbb, 0xbf]);
            prefixed.set(bytes, 3);
            await this.fileService.writeFile(uri, BinaryBuffer.wrap(prefixed));
        } catch (e) {
            console.error('Failed to write UTF-8 BOM', e);
        }
    }
}