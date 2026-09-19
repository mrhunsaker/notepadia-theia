import { inject, injectable } from '@theia/core/shared/inversify';
import * as monaco from '@theia/monaco-editor-core';
import {
    Command,
    CommandContribution,
    CommandRegistry
} from '@theia/core/lib/common/command';
import {
    MenuContribution,
    MenuModelRegistry
} from '@theia/core/lib/common/menu';
import { CommonMenus } from '@theia/core/lib/browser/common-menus';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';
import {
    eolToSpace,
    removeConsecutiveDuplicateLines,
    removeUnnecessaryEol,
    spacesToTabs,
    splitLines,
    tabsToSpaces,
    trimLeadingAndTrailing,
    trimTrailing
} from '../common/blank-ops';

/**
 * Notepad++ style "Edit > Blank Operations" (TAB to Space, Space to TAB,
 * trims, EOL to space, remove unnecessary EOL) plus the missing
 * "Edit > Line Operations" entries (Split Lines, Remove Consecutive
 * Duplicate Lines). Empty selections operate on the whole document, exactly
 * like Notepad++; a selection restricts the operation to the lines it spans.
 */
export namespace NotepadiaBlankCommands {
    export const TAB_TO_SPACE: Command = { id: 'notepadia.blank.tabToSpace', label: 'TAB to Space' };
    export const SPACE_TO_TAB: Command = { id: 'notepadia.blank.spaceToTab', label: 'Space to TAB' };
    export const TRIM_LEADING_TRAILING: Command = { id: 'notepadia.blank.trimLeadingTrailing', label: 'Trim leading and trailing space' };
    export const TRIM_TRAILING: Command = { id: 'notepadia.blank.trimTrailing', label: 'Trim trailing space' };
    export const EOL_TO_SPACE: Command = { id: 'notepadia.blank.eolToSpace', label: 'EOL to space' };
    export const REMOVE_UNNECESSARY: Command = { id: 'notepadia.blank.removeUnnecessary', label: 'Remove unnecessary EOL and trailing spaces' };
    export const SPLIT_LINES: Command = { id: 'notepadia.line.splitLines', label: 'Split Lines' };
    export const REMOVE_CONSECUTIVE_DUPLICATES: Command = { id: 'notepadia.line.removeConsecutiveDuplicateLines', label: 'Remove Consecutive Duplicate Lines' };
}

const SPLIT_COLUMN = 80;

@injectable()
export class NotepadiaBlankAndLineOperationsContribution implements CommandContribution, MenuContribution {

    constructor(
        @inject(EditorManager) protected readonly editorManager: EditorManager
    ) { }

    registerCommands(commands: CommandRegistry): void {
        const register = (command: Command, transform: (lines: string[], tabSize: number) => string[]): void => {
            commands.registerCommand(command, {
                isEnabled: () => this.isEditable(),
                execute: () => this.applyLineTransform(transform)
            });
        };
        register(NotepadiaBlankCommands.TAB_TO_SPACE, (lines, tabSize) => lines.map(line => tabsToSpaces(line, tabSize)));
        register(NotepadiaBlankCommands.SPACE_TO_TAB, (lines, tabSize) => lines.map(line => spacesToTabs(line, tabSize)));
        register(NotepadiaBlankCommands.TRIM_LEADING_TRAILING, lines => trimLeadingAndTrailing(lines));
        register(NotepadiaBlankCommands.TRIM_TRAILING, lines => trimTrailing(lines));
        register(NotepadiaBlankCommands.EOL_TO_SPACE, lines => eolToSpace(lines));
        register(NotepadiaBlankCommands.REMOVE_UNNECESSARY, lines => removeUnnecessaryEol(lines));
        register(NotepadiaBlankCommands.SPLIT_LINES, lines => splitLines(lines, SPLIT_COLUMN));
        register(NotepadiaBlankCommands.REMOVE_CONSECUTIVE_DUPLICATES, lines => removeConsecutiveDuplicateLines(lines));
    }

    registerMenus(menus: MenuModelRegistry): void {
        const blank = [...CommonMenus.EDIT, '7_notepadia-blank'];
        menus.registerSubmenu(blank, 'Blank Operations');
        menus.registerMenuAction(blank, { commandId: NotepadiaBlankCommands.TAB_TO_SPACE.id, order: 'a' });
        menus.registerMenuAction(blank, { commandId: NotepadiaBlankCommands.SPACE_TO_TAB.id, order: 'b' });
        menus.registerMenuAction(blank, { commandId: NotepadiaBlankCommands.TRIM_LEADING_TRAILING.id, order: 'c' });
        menus.registerMenuAction(blank, { commandId: NotepadiaBlankCommands.TRIM_TRAILING.id, order: 'd' });
        menus.registerMenuAction(blank, { commandId: NotepadiaBlankCommands.EOL_TO_SPACE.id, order: 'e' });
        menus.registerMenuAction(blank, { commandId: NotepadiaBlankCommands.REMOVE_UNNECESSARY.id, order: 'f' });

        const lineOperations = [...CommonMenus.EDIT, '4_notepadia-line-operations'];
        menus.registerMenuAction(lineOperations, {
            commandId: NotepadiaBlankCommands.SPLIT_LINES.id,
            label: 'Split Lines',
            order: 'a1'
        });
        menus.registerMenuAction(lineOperations, {
            commandId: NotepadiaBlankCommands.REMOVE_CONSECUTIVE_DUPLICATES.id,
            label: 'Remove Consecutive Duplicate Lines',
            order: 'a2'
        });
    }

    protected currentEditor(): MonacoEditor | undefined {
        const widget = this.editorManager.currentEditor;
        return widget ? MonacoEditor.get(widget) : undefined;
    }

    protected isEditable(): boolean {
        const editor = this.currentEditor();
        const model = editor?.getControl().getModel();
        return !!model;
    }

    protected applyLineTransform(transform: (lines: string[], tabSize: number) => string[]): void {
        const editor = this.currentEditor();
        const control = editor?.getControl();
        const model = control?.getModel();
        if (!editor || !control || !model) {
            return;
        }
        const selection = control.getSelection();
        const wholeDocument = !selection || selection.isEmpty();
        const firstLine = wholeDocument ? 1 : selection.startLineNumber;
        const lastLine = wholeDocument ? model.getLineCount() : selection.endLineNumber;
        const range = new monaco.Range(firstLine, 1, lastLine, model.getLineMaxColumn(lastLine));
        const original = model.getValueInRange(range);
        const lines = original.split('\n');
        const tabSize = model.getOptions().tabSize;
        const transformed = transform(lines, tabSize);
        if (transformed.length === 0) {
            return;
        }
        const result = transformed.join('\n');
        if (result === original) {
            return;
        }
        control.pushUndoStop();
        control.executeEdits('notepadia.blank', [{ range, text: result }]);
        control.pushUndoStop();
        control.setPosition({ lineNumber: firstLine, column: 1 });
        control.revealLineInCenter(firstLine);
    }
}