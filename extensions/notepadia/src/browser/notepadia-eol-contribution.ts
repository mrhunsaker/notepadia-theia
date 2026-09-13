import { inject, injectable } from '@theia/core/shared/inversify';
import {
    Command,
    CommandContribution,
    CommandRegistry,
    MenuContribution,
    MenuModelRegistry
} from '@theia/core/lib/common';
import { QuickInputService } from '@theia/core/lib/browser';
import { CommonMenus } from '@theia/core/lib/browser/common-menus';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';

/**
 * Notepad++-style EOL conversion. LF and CRLF transform the buffer through
 * Monaco's `ITextModel.setEOL`, which keeps the change undoable on the model.
 * Classic CR is not representable as a line separator inside Monaco, so it is
 * detected and reported (status bar) but not offered as a conversion target.
 */
export namespace NotepadiaEolCommands {
    export const CONVERT: Command = { id: 'notepadia.lineEndings.convert', label: 'Change Line Endings...' };
    export const TO_LF: Command = { id: 'notepadia.lineEndings.lf', label: 'Convert to Unix Format (LF)' };
    export const TO_CRLF: Command = { id: 'notepadia.lineEndings.crlf', label: 'Convert to Windows Format (CRLF)' };
}

@injectable()
export class NotepadiaEolContribution implements CommandContribution, MenuContribution {

    constructor(
        @inject(EditorManager) protected readonly editorManager: EditorManager,
        @inject(QuickInputService) protected readonly quickInputService: QuickInputService
    ) { }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(NotepadiaEolCommands.TO_LF, {
            execute: () => this.convert(0 /* MonacoEndOfLineSequence.LF */)
        });
        commands.registerCommand(NotepadiaEolCommands.TO_CRLF, {
            execute: () => this.convert(1 /* MonacoEndOfLineSequence.CRLF */)
        });
        commands.registerCommand(NotepadiaEolCommands.CONVERT, {
            execute: () => this.pickAndConvert()
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        const eol = [...CommonMenus.EDIT, '9_notepadia-eol'];
        menus.registerSubmenu(eol, 'EOL Conversion');

        menus.registerMenuAction(eol, {
            commandId: NotepadiaEolCommands.TO_CRLF.id,
            order: 'a'
        });
        menus.registerMenuAction(eol, {
            commandId: NotepadiaEolCommands.TO_LF.id,
            order: 'b'
        });
        menus.registerMenuAction(eol, {
            commandId: NotepadiaEolCommands.CONVERT.id,
            order: 'c'
        });
    }

    protected async pickAndConvert(): Promise<void> {
        const choice = await this.quickInputService.showQuickPick([{
            label: NotepadiaEolCommands.TO_CRLF.label || 'Convert to Windows Format (CRLF)'
        }, {
            label: NotepadiaEolCommands.TO_LF.label || 'Convert to Unix Format (LF)'
        }], { placeholder: 'Select the end of line sequence' });
        if (!choice) {
            return;
        }
        await this.convert(choice.label === NotepadiaEolCommands.TO_CRLF.label
            ? 1 /* MonacoEndOfLineSequence.CRLF */
            : 0 /* MonacoEndOfLineSequence.LF */);
    }

    protected async convert(eol: 0 | 1): Promise<void> {
        const widget = this.editorManager.currentEditor;
        if (!widget) {
            return;
        }
        const editor = MonacoEditor.get(widget);
        const model = editor?.getControl().getModel();
        if (!model) {
            return;
        }
        model.setEOL(eol);
    }
}