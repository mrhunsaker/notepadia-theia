import { inject, injectable } from '@theia/core/shared/inversify';
import * as monaco from '@theia/monaco-editor-core';
import { FrontendApplication, FrontendApplicationContribution } from '@theia/core/lib/browser';
import {
    Command,
    CommandContribution,
    CommandRegistry
} from '@theia/core/lib/common/command';
import {
    MenuContribution,
    MenuModelRegistry
} from '@theia/core/lib/common/menu';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';

/**
 * Notepad++ style Search > Mark: color every occurrence of the current
 * search term in the document (configurable palette of 5 styles, one per
 * Mark action), clear them, or extend the selection to the next occurrence.
 */
export namespace NotepadiaSearchMarkCommands {
    export const MARK: Command = { id: 'notepadia.search.mark', label: 'Mark' };
    export const MARK_ALL: Command = { id: 'notepadia.search.markAll', label: 'Mark All' };
    export const CLEAR: Command = { id: 'notepadia.search.clearMarks', label: 'Clear Marks' };
    export const SELECT_FIND_NEXT: Command = { id: 'notepadia.search.selectFindNext', label: 'Select and Find Next' };
}

const STYLES: ReadonlyArray<{ readonly className: string; readonly color: string }> = [
    { className: 'notepadia-mark-0', color: 'rgba(244, 67, 54, 0.35)' },
    { className: 'notepadia-mark-1', color: 'rgba(33, 150, 243, 0.35)' },
    { className: 'notepadia-mark-2', color: 'rgba(0, 150, 136, 0.35)' },
    { className: 'notepadia-mark-3', color: 'rgba(156, 39, 176, 0.3)' },
    { className: 'notepadia-mark-4', color: 'rgba(255, 152, 0, 0.4)' }
];

interface FindStateLike {
    searchString?: string;
    matchCase?: boolean;
    isRegex?: boolean;
}

@injectable()
export class NotepadiaSearchMarkContribution implements CommandContribution, MenuContribution, FrontendApplicationContribution {

    // style slot -> decorations for the current model
    protected readonly marks = new Map<string /* uri */, Array<{ generation: number; decorations: monaco.editor.IModelDeltaDecoration[] }>>();
    protected readonly collections = new Map<string, {
        control: monaco.editor.ICodeEditor;
        collection: monaco.editor.IEditorDecorationsCollection;
    }>();
    protected generation = 0;

    constructor(
        @inject(EditorManager) protected readonly editorManager: EditorManager
    ) { }

    onStart(_app: FrontendApplication): void {
        const style = document.createElement('style');
        style.id = 'notepadia-search-mark-style';
        style.textContent = STYLES
            .map(s => `.${s.className} { background: ${s.color}; }`)
            .join('\n');
        document.head.appendChild(style);
        this.editorManager.onCurrentEditorChanged(() => this.applyToCurrent());
        this.editorManager.onCreated(() => this.applyToCurrent());
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(NotepadiaSearchMarkCommands.MARK, { execute: () => this.mark() });
        commands.registerCommand(NotepadiaSearchMarkCommands.MARK_ALL, { execute: () => this.mark() });
        commands.registerCommand(NotepadiaSearchMarkCommands.CLEAR, { execute: () => this.clear() });
        commands.registerCommand(NotepadiaSearchMarkCommands.SELECT_FIND_NEXT, {
            isEnabled: () => this.currentEditor() !== undefined,
            execute: () => this.selectFindNext()
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        const mark = ['menubar', '3_search', 'notepadia-mark'];
        menus.registerSubmenu(mark, 'Mark');
        menus.registerMenuAction(mark, { commandId: NotepadiaSearchMarkCommands.MARK.id, order: 'a' });
        menus.registerMenuAction(mark, { commandId: NotepadiaSearchMarkCommands.MARK_ALL.id, order: 'b' });
        menus.registerMenuAction(mark, { commandId: NotepadiaSearchMarkCommands.CLEAR.id, order: 'c' });
        menus.registerMenuAction(mark, { commandId: NotepadiaSearchMarkCommands.SELECT_FIND_NEXT.id, order: 'd' });
    }

    protected currentEditor(): MonacoEditor | undefined {
        const widget = this.editorManager.currentEditor;
        return widget ? MonacoEditor.get(widget) : undefined;
    }

    protected mark(): void {
        const editor = this.currentEditor();
        const control = editor?.getControl();
        const model = control?.getModel();
        if (!editor || !control || !model) {
            return;
        }
        const term = this.searchTerm(control);
        if (!term) {
            return;
        }
        const findState = this.findState(control);
        const matches = model.findMatches(
            term,
            true,
            !!findState?.isRegex,
            !!findState?.matchCase,
            null,
            false,
            10000
        );
        if (matches.length === 0) {
            return;
        }
        const uri = model.uri.toString();
        const slot = STYLES[this.generation];
        const decorations: monaco.editor.IModelDeltaDecoration[] = matches.map(match => ({
            range: match.range,
            options: { inlineClassName: slot.className }
        }));
        const entries = this.marks.get(uri) || [];
        const without = entries.filter(entry => entry.generation !== this.generation);
        without.push({ generation: this.generation, decorations });
        this.marks.set(uri, without);
        this.generation = (this.generation + 1) % STYLES.length;
        this.applyTo(uri);
    }

    protected clear(): void {
        const uri = this.currentUri();
        if (!uri) {
            return;
        }
        this.marks.delete(uri);
        this.applyTo(uri);
    }

    protected selectFindNext(): void {
        const editor = this.currentEditor();
        const control = editor?.getControl();
        const model = control?.getModel();
        if (!control || !model) {
            return;
        }
        const term = this.searchTerm(control);
        if (!term) {
            return;
        }
        const findState = this.findState(control);
        const selections = control.getSelections() || [];
        const last = selections[selections.length - 1];
        const from = last ? last.getEndPosition() : { lineNumber: 1, column: 1 };
        const match = model.findNextMatch(term, from, !!findState?.isRegex, !!findState?.matchCase, null, false);
        if (!match) {
            return;
        }
        const range = match.range;
        const selection = new monaco.Selection(
            range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn
        );
        const base = last && last.isEmpty() ? selections.slice(0, -1) : selections;
        control.setSelections([...base, selection]);
        control.revealRangeInCenter(range);
    }

    protected searchTerm(control: monaco.editor.ICodeEditor): string | undefined {
        const selection = control.getSelection();
        if (selection && !selection.isEmpty()) {
            const text = control.getModel()?.getValueInRange(new monaco.Range(
                selection.startLineNumber, selection.startColumn,
                selection.endLineNumber, selection.endColumn
            ));
            if (text) {
                return text;
            }
        }
        return this.findState(control)?.searchString || undefined;
    }

    protected findState(control: monaco.editor.ICodeEditor): FindStateLike | undefined {
        try {
            const findController = (control as unknown as {
                getContribution?(id: string): unknown | null;
            }).getContribution?.('editor.contrib.findController');
            const state = findController as { getState?(): FindStateLike } | null | undefined;
            return state?.getState?.();
        } catch {
            return undefined;
        }
    }

    protected currentUri(): string | undefined {
        return this.currentEditor()?.getControl().getModel()?.uri.toString();
    }

    protected applyToCurrent(): void {
        const uri = this.currentUri();
        if (uri) {
            this.applyTo(uri);
        }
    }

    protected applyTo(uri: string): void {
        const editor = this.currentEditor();
        const control = editor?.getControl();
        const model = control?.getModel();
        if (!control || !model || model.uri.toString() !== uri) {
            return;
        }
        let entry = this.collections.get(uri);
        if (!entry || entry.control !== control || entry.control.getModel() !== model) {
            entry = { control, collection: control.createDecorationsCollection([]) };
            this.collections.set(uri, entry);
        }
        const all: monaco.editor.IModelDeltaDecoration[] = [];
        for (const stored of this.marks.get(uri) || []) {
            all.push(...stored.decorations);
        }
        entry.collection.set(all);
    }
}