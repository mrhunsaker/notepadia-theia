import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';
import { inject, injectable } from '@theia/core/shared/inversify';
import {
    Command,
    CommandContribution,
    CommandRegistry,
    MessageService
} from '@theia/core/lib/common';
import { CommonCommands, ApplicationShell } from '@theia/core/lib/browser';
import { Saveable, SaveableWidget } from '@theia/core/lib/browser/saveable';
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

    export const CLOSE: Command = {
        id: 'notepadia.close',
        label: 'Close'
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

    export const ZOOM_IN: Command = {
        id: 'notepadia.zoomIn',
        label: 'Zoom In'
    };

    export const ZOOM_OUT: Command = {
        id: 'notepadia.zoomOut',
        label: 'Zoom Out'
    };

    export const ZOOM_RESET: Command = {
        id: 'notepadia.zoomReset',
        label: 'Reset Zoom'
    };

    export const TOGGLE_WHITESPACE: Command = {
        id: 'notepadia.toggleWhitespace',
        label: 'Show All Characters'
    };

    export const TAB_SIZE_2: Command = {
        id: 'notepadia.tabSize2',
        label: 'Tab Size: 2'
    };

    export const TAB_SIZE_4: Command = {
        id: 'notepadia.tabSize4',
        label: 'Tab Size: 4'
    };

    export const TAB_SIZE_8: Command = {
        id: 'notepadia.tabSize8',
        label: 'Tab Size: 8'
    };

    export const GO_TO_LINE: Command = {
        id: 'notepadia.goToLine',
        label: 'Go To Line...'
    };
}

@injectable()
export class NotepadiaContribution implements CommandContribution {
    protected closeInProgress = false;

    constructor(
        protected readonly editorManager: EditorManager,
        protected readonly shell: ApplicationShell,
        @inject(MessageService) protected readonly messageService: MessageService
    ) {}

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(NotepadiaCommands.NEW_DOCUMENT, {
            execute: () => commands.executeCommand(CommonCommands.NEW_FILE.id)
        });

        commands.registerCommand(NotepadiaCommands.CLOSE, {
            execute: () => this.closeCurrentEditor(commands)
        });

        commands.registerCommand(NotepadiaCommands.CLOSE_ALL, {
            execute: () => this.closeAllEditors(commands)
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

        commands.registerCommand(NotepadiaCommands.ZOOM_IN, {
            isEnabled: () => !!this.currentEditor,
            execute: () => this.triggerMonacoAction('editor.action.fontZoomIn')
        });
        commands.registerCommand(NotepadiaCommands.ZOOM_OUT, {
            isEnabled: () => !!this.currentEditor,
            execute: () => this.triggerMonacoAction('editor.action.fontZoomOut')
        });
        commands.registerCommand(NotepadiaCommands.ZOOM_RESET, {
            isEnabled: () => !!this.currentEditor,
            execute: () => this.triggerMonacoAction('editor.action.fontZoomReset')
        });
        commands.registerCommand(NotepadiaCommands.TOGGLE_WHITESPACE, {
            isEnabled: () => !!this.currentEditor,
            execute: () => this.triggerMonacoAction('editor.action.toggleRenderWhitespace')
        });
        commands.registerCommand(NotepadiaCommands.GO_TO_LINE, {
            isEnabled: () => !!this.currentEditor,
            execute: () => this.triggerMonacoAction('editor.action.gotoLine')
        });
        commands.registerCommand(NotepadiaCommands.TAB_SIZE_2, {
            isEnabled: () => !!this.currentEditor,
            execute: () => this.setTabSize(2)
        });
        commands.registerCommand(NotepadiaCommands.TAB_SIZE_4, {
            isEnabled: () => !!this.currentEditor,
            execute: () => this.setTabSize(4)
        });
        commands.registerCommand(NotepadiaCommands.TAB_SIZE_8, {
            isEnabled: () => !!this.currentEditor,
            execute: () => this.setTabSize(8)
        });
    }

    protected async closeCurrentEditor(commands: CommandRegistry): Promise<void> {
        if (this.closeInProgress) {
            return;
        }
        this.closeInProgress = true;
        try {
            const widget = this.editorManager.currentEditor;
            if (!widget) {
                return;
            }
            if (Saveable.isDirty(widget)) {
                const choice = await this.messageService.warn(
                    `Do you want to save the changes you made to "${widget.title.label}"?`,
                    'Save', "Don't Save", 'Cancel'
                );
                if (!choice || choice === 'Cancel') {
                    return;
                }
                if (choice === 'Save') {
                    await Saveable.save(widget);
                }
            }
            await commands.executeCommand(CommonCommands.CLOSE_TAB.id);
        } finally {
            this.closeInProgress = false;
        }
    }

    protected async closeAllEditors(commands: CommandRegistry): Promise<void> {
        if (this.closeInProgress) {
            return;
        }
        this.closeInProgress = true;
        try {
            const dirty = [...SaveableWidget.getDirty(this.shell.getWidgets('main'))];
            if (dirty.length === 0) {
                await commands.executeCommand(CommonCommands.CLOSE_ALL_TABS.id);
                return;
            }
            const choice = await this.messageService.warn(
                `There are ${dirty.length} file(s) with unsaved changes.`,
                'Save All', "Don't Save", 'Cancel'
            );
            if (!choice || choice === 'Cancel') {
                return;
            }
            if (choice === 'Save All') {
                for (const widget of dirty) {
                    await Saveable.save(widget);
                }
            }
            await commands.executeCommand(CommonCommands.CLOSE_ALL_TABS.id);
        } finally {
            this.closeInProgress = false;
        }
    }

    protected currentEditorWritable(): boolean {
        const editor = this.currentEditor;
        return !!editor && !!MonacoEditor.get(editor)?.getControl();
    }

    protected get currentEditor(): EditorWidget | undefined {
        return this.editorManager.currentEditor;
    }

    protected triggerMonacoAction(actionId: string): void {
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

    protected setTabSize(size: number): void {
        const editor = this.currentEditor;
        if (!editor) {
            return;
        }
        const control = MonacoEditor.get(editor)?.getControl();
        if (!control) {
            return;
        }
        control.updateOptions({ tabSize: size });
    }
}