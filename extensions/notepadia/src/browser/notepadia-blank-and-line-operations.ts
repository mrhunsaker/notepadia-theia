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
        register(NotepadiaBlankCommands.TAB_TO_SPACE, (lines, tabSize) => lines.map(line => NotepadiaBlankAndLineOperationsContribution.tabsToSpaces(line, tabSize)));
        register(NotepadiaBlankCommands.SPACE_TO_TAB, (lines, tabSize) => lines.map(line => NotepadiaBlankAndLineOperationsContribution.spacesToTabs(line, tabSize)));
        register(NotepadiaBlankCommands.TRIM_LEADING_TRAILING, lines => lines.map(line => line.trim()));
        register(NotepadiaBlankCommands.TRIM_TRAILING, lines => lines.map(line => line.replace(/[ \t]+$/g, '')));
        register(NotepadiaBlankCommands.EOL_TO_SPACE, lines => [lines.join(' ')]);
        register(NotepadiaBlankCommands.REMOVE_UNNECESSARY, lines => {
            const out: string[] = [];
            let previousEmpty = false;
            for (const raw of lines) {
                const line = raw.replace(/[ \t]+$/g, '');
                if (line === '') {
                    if (!previousEmpty) {
                        out.push('');
                    }
                } else {
                    out.push(line);
                }
                previousEmpty = line === '';
            }
            return out;
        });
        register(NotepadiaBlankCommands.SPLIT_LINES, lines => {
            const out: string[] = [];
            for (const line of lines) {
                out.push(...NotepadiaBlankAndLineOperationsContribution.wrapLine(line));
            }
            return out;
        });
        register(NotepadiaBlankCommands.REMOVE_CONSECUTIVE_DUPLICATES, lines => {
            const out: string[] = [];
            for (const line of lines) {
                if (line !== out[out.length - 1]) {
                    out.push(line);
                }
            }
            return out;
        });
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

    protected static tabsToSpaces(line: string, tabSize: number): string {
        let column = 0;
        const builder: string[] = [];
        for (const ch of line) {
            if (ch === '\t') {
                const nextStop = (Math.floor(column / tabSize) + 1) * tabSize;
                builder.push(' '.repeat(nextStop - column));
                column = nextStop;
            } else {
                builder.push(ch);
                column += 1;
            }
        }
        return builder.join('');
    }

    protected static spacesToTabs(line: string, tabSize: number): string {
        let index = 0;
        while (index < line.length && (line[index] === ' ' || line[index] === '\t')) {
            index++;
        }
        const leading = line.slice(0, index);
        const rest = line.slice(index);
        let spaces = 0;
        for (const ch of leading) {
            if (ch === ' ') {
                spaces += 1;
            } else {
                spaces += tabSize - (spaces % tabSize);
            }
        }
        return '\t'.repeat(Math.floor(spaces / tabSize)) + ' '.repeat(spaces % tabSize) + rest;
    }

    /**
     * Word-aware hard wrap at SPLIT_COLUMN: break at the last space at or
     * before the column; a single over-long word is broken mid-word.
     */
    protected static wrapLine(line: string): string[] {
        const width = SPLIT_COLUMN;
        const out: string[] = [];
        let rest = line;
        while (rest.length > width) {
            const slice = rest.slice(0, width);
            const breakAt = slice.lastIndexOf(' ');
            if (breakAt > 0) {
                out.push(slice.slice(0, breakAt));
                rest = rest.slice(breakAt + 1);
            } else {
                out.push(slice);
                rest = rest.slice(width);
            }
        }
        if (rest.length > 0 || out.length === 0) {
            out.push(rest);
        }
        return out;
    }
}