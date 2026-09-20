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
import { extendedToLiteral } from '../common/extended-search';

/**
 * Notepad++ style Search > Mark: color every occurrence of the current
 * search term in the document (configurable palette of 5 styles, one per
 * Mark action), clear them, or extend the selection to the next occurrence.
 * The "Use Extended Search Mode" toggle below the Mark entries makes the
 * term interpret \n, \t, \r, \\ literals (Notepad++ escape mode), applied to
 * Mark / Mark All / Select and Find Next.
 */
export namespace NotepadiaSearchMarkCommands {
    export const MARK: Command = { id: 'notepadia.search.mark', label: 'Mark' };
    export const MARK_ALL: Command = { id: 'notepadia.search.markAll', label: 'Mark All' };
    export const CLEAR: Command = { id: 'notepadia.search.clearMarks', label: 'Clear Marks' };
    export const SELECT_FIND_NEXT: Command = { id: 'notepadia.search.selectFindNext', label: 'Select and Find Next' };
    export const EXTENDED_MODE: Command = { id: 'notepadia.search.extendedMode', label: 'Use Extended Search Mode' };
    export const MODE_NORMAL: Command = { id: 'notepadia.search.mode.normal', label: 'Search Mode: Normal' };
    export const MODE_EXTENDED: Command = { id: 'notepadia.search.mode.extended', label: 'Search Mode: Extended' };
    export const MODE_REGEX: Command = { id: 'notepadia.search.mode.regex', label: 'Search Mode: Regular Expression' };
}

export type SearchMode = 'normal' | 'extended' | 'regex';

/**
 * Term transformation used by every Mark-family action, mirroring Notepad++'s
 * search mode radio group:
 *  - normal: the term is used verbatim, following the Find widget's own
 *    regex / match-case flags;
 *  - extended: the term is decoded with the Notepad++ escape table and then
 *    searched as a literal string;
 *  - regex: the term is passed through untouched as a regular expression.
 */
function resolvedTerm(term: string, mode: SearchMode, findIsRegex: boolean): { term: string; isRegex: boolean } {
    switch (mode) {
        case 'extended':
            return { term: extendedToLiteral(term), isRegex: false };
        case 'regex':
            return { term, isRegex: true };
        default:
            return { term, isRegex: findIsRegex };
    }
}

// Class-name slot palette; the colors live in style/notepadia-marks.css so no
// TypeScript file carries a hard-coded color string.
const STYLES: ReadonlyArray<{ readonly className: string }> = [
    { className: 'notepadia-mark-0' },
    { className: 'notepadia-mark-1' },
    { className: 'notepadia-mark-2' },
    { className: 'notepadia-mark-3' },
    { className: 'notepadia-mark-4' }
];

interface FindStateLike {
    searchString?: string;
    matchCase?: boolean;
    isRegex?: boolean;
}

const MODE_KEY = 'notepadia.search.mode';

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
        // The .notepadia-mark-N rules were moved out of a document.head
        // <style> injection into style/notepadia-marks.css (imported by the
        // frontend module through style/index.css).
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
        commands.registerCommand(NotepadiaSearchMarkCommands.EXTENDED_MODE, {
            isToggled: () => this.searchMode() === 'extended',
            execute: () => this.setSearchMode(this.searchMode() === 'extended' ? 'normal' : 'extended')
        });
        commands.registerCommand(NotepadiaSearchMarkCommands.MODE_NORMAL, {
            isToggled: () => this.searchMode() === 'normal',
            execute: () => this.setSearchMode('normal')
        });
        commands.registerCommand(NotepadiaSearchMarkCommands.MODE_EXTENDED, {
            isToggled: () => this.searchMode() === 'extended',
            execute: () => this.setSearchMode('extended')
        });
        commands.registerCommand(NotepadiaSearchMarkCommands.MODE_REGEX, {
            isToggled: () => this.searchMode() === 'regex',
            execute: () => this.setSearchMode('regex')
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        const mark = ['menubar', '3_search', 'notepadia-mark'];
        menus.registerSubmenu(mark, 'Mark');
        menus.registerMenuAction(mark, { commandId: NotepadiaSearchMarkCommands.MARK.id, order: 'a' });
        menus.registerMenuAction(mark, { commandId: NotepadiaSearchMarkCommands.MARK_ALL.id, order: 'b' });
        menus.registerMenuAction(mark, { commandId: NotepadiaSearchMarkCommands.CLEAR.id, order: 'c' });
        menus.registerMenuAction(mark, { commandId: NotepadiaSearchMarkCommands.SELECT_FIND_NEXT.id, order: 'd' });
        menus.registerMenuAction(mark, { commandId: NotepadiaSearchMarkCommands.EXTENDED_MODE.id, order: 'e' });
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
        const rawTerm = this.searchTerm(control);
        if (!rawTerm) {
            return;
        }
        const findState = this.findState(control);
        const { term, isRegex } = resolvedTerm(rawTerm, this.searchMode(), !!findState?.isRegex);
        const matches = model.findMatches(
            term,
            true,
            isRegex,
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
        const rawTerm = this.searchTerm(control);
        if (!rawTerm) {
            return;
        }
        const findState = this.findState(control);
        const { term, isRegex } = resolvedTerm(rawTerm, this.searchMode(), !!findState?.isRegex);
        const selections = control.getSelections() || [];
        const last = selections[selections.length - 1];
        const from = last ? last.getEndPosition() : { lineNumber: 1, column: 1 };
        const match = model.findNextMatch(term, from, isRegex, !!findState?.matchCase, null, false);
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
        // Notepad++ semantics: Mark / Select and Find Next operate on the term
        // in the Find box. Only fall back to the current selection when the
        // Find box is empty (the selection is what the Find widget seeds the
        // box with). Preferring the selection over the Find box caused stale
        // selections (e.g. the caret left behind by a previous interaction) to
        // silently override what the user typed.
        const fromFind = this.findState(control)?.searchString;
        if (fromFind) {
            return fromFind;
        }
        const selection = control.getSelection();
        if (selection && !selection.isEmpty()) {
            return control.getModel()?.getValueInRange(new monaco.Range(
                selection.startLineNumber, selection.startColumn,
                selection.endLineNumber, selection.endColumn
            ));
        }
        return undefined;
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

    protected searchMode(): SearchMode {
        const stored = window.localStorage.getItem(MODE_KEY);
        if (stored === 'extended' || stored === '1') {
            return 'extended';
        }
        if (stored === 'regex') {
            return 'regex';
        }
        return 'normal';
    }

    protected setSearchMode(mode: SearchMode): void {
        window.localStorage.setItem(MODE_KEY, mode);
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