import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';
import { injectable } from '@theia/core/shared/inversify';
import {
    Command,
    CommandContribution,
    CommandRegistry
} from '@theia/core/lib/common';
import { CommonCommands, ApplicationShell } from '@theia/core/lib/browser';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import { EditorWidget } from '@theia/editor/lib/browser/editor-widget';

export namespace NotepadiaCommands {
    export const NEW_DOCUMENT: Command = {
        id: 'notepadia.newDocument',
        label: 'New'
    };

    export const CLOSE_ALL: Command = {
        id: 'notepadia.closeAll',
        label: 'Close All'
    };

    export const DUPLICATE_LINE: Command = {
        id: 'notepadia.duplicateLine',
        label: 'Duplicate Current Line'
    };

    export const DELETE_LINE: Command = {
        id: 'notepadia.deleteLine',
        label: 'Delete Current Line'
    };

    export const MOVE_LINE_UP: Command = {
        id: 'notepadia.moveLineUp',
        label: 'Move Current Line Up'
    };

    export const MOVE_LINE_DOWN: Command = {
        id: 'notepadia.moveLineDown',
        label: 'Move Current Line Down'
    };

    export const JOIN_LINES: Command = {
        id: 'notepadia.joinLines',
        label: 'Join Lines'
    };

    export const TRIM_TRAILING_WHITESPACE: Command = {
        id: 'notepadia.trimTrailingWhitespace',
        label: 'Trim Trailing Whitespace'
    };

    export const SORT_LINES_ASCENDING: Command = {
        id: 'notepadia.sortLinesAscending',
        label: 'Sort Lines Ascending'
    };

    export const SORT_LINES_DESCENDING: Command = {
        id: 'notepadia.sortLinesDescending',
        label: 'Sort Lines Descending'
    };

    export const REMOVE_DUPLICATE_LINES: Command = {
        id: 'notepadia.removeDuplicateLines',
        label: 'Remove Duplicate Lines'
    };

    export const REVERSE_LINES: Command = {
        id: 'notepadia.reverseLines',
        label: 'Reverse Lines'
    };

    export const INDENT: Command = {
        id: 'notepadia.indent',
        label: 'Indent'
    };

    export const UNINDENT: Command = {
        id: 'notepadia.unindent',
        label: 'Unindent'
    };

    export const UPPER_CASE: Command = {
        id: 'notepadia.upperCase',
        label: 'UPPER CASE'
    };

    export const LOWER_CASE: Command = {
        id: 'notepadia.lowerCase',
        label: 'lower case'
    };

    export const TOGGLE_COMMENT: Command = {
        id: 'notepadia.toggleComment',
        label: 'Toggle Comment'
    };

    export const FIND_NEXT: Command = {
        id: 'notepadia.findNext',
        label: 'Find Next'
    };

    export const FIND_PREVIOUS: Command = {
        id: 'notepadia.findPrevious',
        label: 'Find Previous'
    };
}

@injectable()
export class NotepadiaContribution implements CommandContribution {
    constructor(
        protected readonly editorManager: EditorManager,
        protected readonly shell: ApplicationShell
    ) {}

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(NotepadiaCommands.NEW_DOCUMENT, {
            execute: () => commands.executeCommand(CommonCommands.NEW_FILE.id)
        });

        commands.registerCommand(NotepadiaCommands.CLOSE_ALL, {
            execute: () => commands.executeCommand(CommonCommands.CLOSE_ALL_TABS.id)
        });

        commands.registerCommand(NotepadiaCommands.DUPLICATE_LINE, {
            isEnabled: () => this.currentEditorWritable(),
            execute: () => this.triggerMonacoAction('editor.action.duplicateSelection')
        });

        commands.registerCommand(NotepadiaCommands.DELETE_LINE, {
            isEnabled: () => this.currentEditorWritable(),
            execute: () => this.triggerMonacoAction('editor.action.deleteLines')
        });

        commands.registerCommand(NotepadiaCommands.MOVE_LINE_UP, {
            isEnabled: () => this.currentEditorWritable(),
            execute: () => this.triggerMonacoAction('editor.action.moveLinesUpAction')
        });

        commands.registerCommand(NotepadiaCommands.MOVE_LINE_DOWN, {
            isEnabled: () => this.currentEditorWritable(),
            execute: () => this.triggerMonacoAction('editor.action.moveLinesDownAction')
        });

        commands.registerCommand(NotepadiaCommands.JOIN_LINES, {
            isEnabled: () => this.currentEditorWritable(),
            execute: () => this.triggerMonacoAction('editor.action.joinLines')
        });

        commands.registerCommand(NotepadiaCommands.TRIM_TRAILING_WHITESPACE, {
            isEnabled: () => this.currentEditorWritable(),
            execute: () => this.triggerMonacoAction('editor.action.trimTrailingWhitespace')
        });

        commands.registerCommand(NotepadiaCommands.SORT_LINES_ASCENDING, {
            isEnabled: () => this.currentEditorWritable(),
            execute: () => this.triggerMonacoAction('editor.action.sortLinesAscending')
        });

        commands.registerCommand(NotepadiaCommands.SORT_LINES_DESCENDING, {
            isEnabled: () => this.currentEditorWritable(),
            execute: () => this.triggerMonacoAction('editor.action.sortLinesDescending')
        });

        commands.registerCommand(NotepadiaCommands.REMOVE_DUPLICATE_LINES, {
            isEnabled: () => this.currentEditorWritable(),
            execute: () => this.triggerMonacoAction('editor.action.removeDuplicateLines')
        });

        commands.registerCommand(NotepadiaCommands.REVERSE_LINES, {
            isEnabled: () => this.currentEditorWritable(),
            execute: () => this.triggerMonacoAction('editor.action.reverseLines')
        });

        commands.registerCommand(NotepadiaCommands.INDENT, {
            isEnabled: () => this.currentEditorWritable(),
            execute: () => this.triggerMonacoAction('editor.action.indentLines')
        });

        commands.registerCommand(NotepadiaCommands.UNINDENT, {
            isEnabled: () => this.currentEditorWritable(),
            execute: () => this.triggerMonacoAction('editor.action.outdentLines')
        });

        commands.registerCommand(NotepadiaCommands.UPPER_CASE, {
            isEnabled: () => this.currentEditorWritable(),
            execute: () => this.triggerMonacoAction('editor.action.transformToUppercase')
        });

        commands.registerCommand(NotepadiaCommands.LOWER_CASE, {
            isEnabled: () => this.currentEditorWritable(),
            execute: () => this.triggerMonacoAction('editor.action.transformToLowercase')
        });

        commands.registerCommand(NotepadiaCommands.TOGGLE_COMMENT, {
            isEnabled: () => this.currentEditorWritable(),
            execute: () => this.triggerMonacoAction('editor.action.commentLine')
        });

        commands.registerCommand(NotepadiaCommands.FIND_NEXT, {
            isEnabled: () => !!this.currentEditor,
            execute: () => this.triggerMonacoAction('editor.action.nextMatchFindAction')
        });

        commands.registerCommand(NotepadiaCommands.FIND_PREVIOUS, {
            isEnabled: () => !!this.currentEditor,
            execute: () => this.triggerMonacoAction('editor.action.previousMatchFindAction')
        });
    }

    protected currentEditorWritable(): boolean {
        const editor = this.currentEditor;
        return !!editor && !!MonacoEditor.get(editor)?.getControl();
    }

    protected get currentEditor(): EditorWidget | undefined {
        return this.editorManager.currentEditor;
    }

    protected triggerMonacoAction(actionId: string): void {
        console.error('NPD TRIGGER:', actionId);
        const editor = this.currentEditor;
        if (!editor) {
            return;
        }
        const control = MonacoEditor.get(editor)?.getControl();
        if (!control) {
            return;
        }
        control.trigger('notepadia', actionId, null);
    }
}