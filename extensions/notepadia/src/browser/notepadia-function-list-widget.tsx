import * as React from '@theia/core/shared/react';
import { inject, injectable } from '@theia/core/shared/inversify';
import { Message } from '@theia/core/shared/@lumino/messaging';
import { ReactWidget } from '@theia/core/lib/browser';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';
import { Disposable } from '@theia/core/lib/common/disposable';
import * as monaco from '@theia/monaco-editor-core';
import { FunctionEntry, parseFunctionList } from '../common/function-list-rules';

/**
 * Notepad++'s Function List panel (E1), as a right-area view.
 *
 * The list is the parsed document and nothing else: no symbol provider, no
 * tree of call hierarchy, no state that survives the file. Notepad++ keeps the
 * panel's own preferences (which language's parser, the sort order, the filter)
 * per session, which is what this does too, and re-reads the document whenever
 * it changes rather than trying to follow an edit.
 *
 * Reparsing is debounced, because a function list is a whole-document regex
 * sweep and doing that on every keystroke is how a panel becomes the reason an
 * editor feels slow. A typing pause settles it.
 */

/** Notepad++'s Function List remembers both of these between files. */
export type FunctionListSort = 'document' | 'alphabetical';

/** Quiet enough that a fast typist triggers one parse, not one per character. */
export const REPARSE_DEBOUNCE_MS = 250;

@injectable()
export class NotepadiaFunctionListWidget extends ReactWidget {

    static readonly ID = 'notepadia.functionList';
    static readonly LABEL = 'Function List';

    protected readonly styleId = 'notepadia-function-list-style';
    protected readonly styleText = `
.notepadia-function-list { display: flex; flex-direction: column; height: 100%; min-height: 0; font-size: var(--theia-ui-font-size); }
.notepadia-function-list-controls { display: flex; gap: 4px; align-items: center; padding: 4px 6px; border-bottom: 1px solid var(--theia-editorGroup-border); flex: none; }
.notepadia-function-list-filter { flex: 1; min-width: 0; }
.notepadia-function-list-tree { flex: 1; overflow: auto; padding: 2px 0; }
.notepadia-function-list-tree:focus { outline: none; }
.notepadia-function-list-row { display: flex; align-items: baseline; gap: 6px; padding: 1px 8px; cursor: pointer; white-space: nowrap; }
.notepadia-function-list-row:hover { background: var(--theia-list-hoverBackground); }
.notepadia-function-list-row[aria-selected='true'] { background: var(--theia-list-activeSelectionBackground); color: var(--theia-list-activeSelectionForeground); }
.notepadia-function-list-kind { flex: none; width: 1.4em; text-align: center; color: var(--theia-descriptionForeground); }
.notepadia-function-list-name { overflow: hidden; text-overflow: ellipsis; font-family: var(--theia-editor-font-family); }
.notepadia-function-list-line { margin-left: auto; color: var(--theia-descriptionForeground); flex: none; font-variant-numeric: tabular-nums; }
.notepadia-function-list-empty { padding: 8px; color: var(--theia-descriptionForeground); white-space: normal; }
`;

    protected filter = '';
    protected sort: FunctionListSort = 'document';
    /** The row the tree cursor is on, by row id. */
    protected cursor: number | undefined;
    protected entries: FunctionEntry[] = [];
    protected parsedModel: monaco.editor.ITextModel | undefined;
    protected parsedLanguage = '';
    protected cursorOnEntry = false;

    protected reparseTimer: ReturnType<typeof setTimeout> | undefined;
    protected contentListener: Disposable | undefined;
    protected languageListener: Disposable | undefined;

    constructor(
        @inject(EditorManager) protected readonly editorManager: EditorManager
    ) {
        super();
        this.id = NotepadiaFunctionListWidget.ID;
        this.title.label = NotepadiaFunctionListWidget.LABEL;
        this.title.caption = 'Notepad++ Function List';
        this.title.closable = true;
        this.title.iconClass = 'codicon codicon-list-tree';
        this.addClass('notepadia-function-list');
        this.injectStyle();

        this.toDispose.push(this.editorManager.onCurrentEditorChanged(() => {
            this.detachModel();
            this.reparseNow();
        }));
        // Closing a file leaves the editor pointing at nothing; reparsing gives
        // the panel its empty state instead of the previous file's list.
        this.toDispose.push(this.onDidChangeVisibility(() => {
            if (this.isVisible) {
                this.reparseNow();
            }
        }));
        this.reparseNow();
    }

    protected injectStyle(): void {
        if (document.getElementById(this.styleId)) {
            return;
        }
        const style = document.createElement('style');
        style.id = this.styleId;
        style.textContent = this.styleText;
        this.node.appendChild(style);
    }

    // ----------------------------------------------------------------- parsing

    protected get model(): monaco.editor.ITextModel | undefined {
        const editor = this.editorManager.currentEditor;
        return editor ? MonacoEditor.get(editor)?.getControl().getModel() ?? undefined : undefined;
    }

    protected onAfterShow(msg: Message): void {
        super.onAfterShow(msg);
        this.reparseNow();
    }

    /** Debounced reparse, used for content changes while typing. */
    protected scheduleReparse(): void {
        if (this.reparseTimer !== undefined) {
            clearTimeout(this.reparseTimer);
        }
        this.reparseTimer = setTimeout(() => {
            this.reparseTimer = undefined;
            this.reparseNow();
        }, REPARSE_DEBOUNCE_MS);
    }

    protected reparseNow(): void {
        const model = this.model;
        const language = model ? model.getLanguageId() : '';
        if (model !== this.parsedModel || language !== this.parsedLanguage) {
            this.detachModel();
            this.parsedModel = model;
            this.parsedLanguage = language;
            if (model) {
                // Content and language are the only two things worth hearing
                // about; the rest of the model API would be noise.
                this.contentListener = model.onDidChangeContent(() => this.scheduleReparse());
                this.languageListener = model.onDidChangeLanguage(() => this.reparseNow());
                this.toDispose.push(this.contentListener);
                this.toDispose.push(this.languageListener);
            }
            // A new file or a new language invalidates the cursor by index.
            this.cursor = undefined;
            this.cursorOnEntry = false;
        }
        const text = model ? model.getValue() : '';
        this.entries = model ? parseFunctionList(text, language) : [];
        if (this.cursor !== undefined && this.cursor >= this.entries.length) {
            this.cursor = undefined;
            this.cursorOnEntry = false;
        }
        this.update();
    }

    protected detachModel(): void {
        this.contentListener?.dispose();
        this.languageListener?.dispose();
        this.contentListener = undefined;
        this.languageListener = undefined;
    }

    // ------------------------------------------------------------------- state

    setFilter(value: string): void {
        if (this.filter === value) {
            return;
        }
        this.filter = value;
        this.cursor = undefined;
        this.cursorOnEntry = false;
        this.update();
    }

    toggleSort(): void {
        this.sort = this.sort === 'document' ? 'alphabetical' : 'document';
        this.update();
    }

    // ------------------------------------------------------------------ render

    protected get visibleEntries(): FunctionEntry[] {
        const needle = this.filter.trim().toLowerCase();
        const matching = needle
            ? this.entries.filter(entry => entry.name.toLowerCase().includes(needle))
            : this.entries.slice();
        if (this.sort === 'alphabetical') {
            // Case-insensitive, so `Zoom` and `add` interleave the way a reader
            // expects; the line number breaks a tie between same-named symbols.
            matching.sort((left, right) => {
                const byName = left.name.toLowerCase().localeCompare(right.name.toLowerCase());
                return byName !== 0 ? byName : left.line - right.line;
            });
        }
        return matching;
    }

    protected navigate(entry: FunctionEntry): void {
        const editor = this.editorManager.currentEditor;
        const control = MonacoEditor.get(editor ?? undefined)?.getControl();
        if (!control) {
            return;
        }
        const line = Math.min(Math.max(entry.line, 1), control.getModel()?.getLineCount() ?? entry.line);
        const position = { lineNumber: line, column: 1 };
        control.setPosition(position);
        control.revealPositionInCenterIfOutsideViewport(position);
        control.focus();
        // Keeping the selection on the declaration's line is what makes the
        // status bar agree with the panel after a jump.
        control.setSelection({
            startLineNumber: line,
            startColumn: 1,
            endLineNumber: line,
            endColumn: control.getModel()?.getLineMaxColumn(line) ?? 1
        });
    }

    protected moveCursor(from: number | undefined, delta: number | 'home' | 'end', count: number): number | undefined {
        if (count === 0) {
            return undefined;
        }
        if (delta === 'home') {
            return 0;
        }
        if (delta === 'end') {
            return count - 1;
        }
        if (from === undefined) {
            return delta > 0 ? 0 : count - 1;
        }
        const next = from + delta;
        if (next < 0) {
            return 0;
        }
        if (next >= count) {
            return count - 1;
        }
        return next;
    }

    protected onKeyDown(event: React.KeyboardEvent<HTMLDivElement>, rows: FunctionEntry[]): void {
        let cursor: number | undefined;
        switch (event.key) {
            case 'ArrowDown': cursor = this.moveCursor(this.cursor, 1, rows.length); break;
            case 'ArrowUp': cursor = this.moveCursor(this.cursor, -1, rows.length); break;
            case 'Home': cursor = this.moveCursor(this.cursor, 'home', rows.length); break;
            case 'End': cursor = this.moveCursor(this.cursor, 'end', rows.length); break;
            case 'Enter':
                if (this.cursor !== undefined && rows[this.cursor]) {
                    event.preventDefault();
                    this.navigate(rows[this.cursor]);
                }
                return;
            default:
                return;
        }
        event.preventDefault();
        this.cursor = cursor;
        // The cursor follows the filter and the sort order, not the document, so
        // it is only meaningful once it has been placed in the current ordering.
        this.cursorOnEntry = true;
        this.update();
        this.revealRow(cursor);
    }

    /** Scrolls the cursor row into view without stealing focus from the tree. */
    protected revealRow(index: number | undefined): void {
        if (index === undefined) {
            return;
        }
        const row = this.node.querySelector<HTMLElement>(`[data-notepadia-function-index="${index}"]`);
        row?.scrollIntoView({ block: 'nearest' });
    }

    protected render(): React.ReactNode {
        const rows = this.visibleEntries;
        const language = this.parsedLanguage;
        return (
            <div className="notepadia-function-list">
                <div className="notepadia-function-list-controls">
                    <input
                        className="theia-input notepadia-function-list-filter-input"
                        type="text"
                        value={this.filter}
                        placeholder="Filter"
                        aria-label="Filter the function list"
                        onChange={event => this.setFilter(event.target.value)}
                        onKeyDown={event => {
                            if (event.key === 'Escape' && this.filter) {
                                event.stopPropagation();
                                this.setFilter('');
                            } else if (event.key === 'ArrowDown') {
                                // Down out of the box hands over to the tree,
                                // which is where the list lives.
                                this.focusTree();
                            }
                        }}
                    />
                    <button
                        type="button"
                        className="theia-button"
                        aria-pressed={this.sort === 'alphabetical'}
                        title={this.sort === 'document'
                            ? 'Sorted by document order. Click to sort alphabetically.'
                            : 'Sorted alphabetically. Click to sort by document order.'}
                        onClick={() => this.toggleSort()}
                    >
                        {this.sort === 'document' ? 'A-Z' : '1-9'}
                    </button>
                </div>
                {/* A role=status inside role=tree is not a legal child, so the
                    "nothing to list" message sits beside the tree, which stays
                    present as an empty tree naming the language it is listing. */}
                {rows.length === 0 && this.renderEmpty(language)}
                <div
                    className="notepadia-function-list-tree"
                    role="tree"
                    tabIndex={0}
                    aria-label={language ? `Function List, ${language}` : 'Function List'}
                    aria-activedescendant={this.cursorOnEntry && this.cursor !== undefined ? this.rowId(this.cursor) : undefined}
                    onKeyDown={event => this.onKeyDown(event, rows)}
                >
                    {this.renderRows(rows)}
                </div>
            </div>
        );
    }

    protected renderRows(rows: FunctionEntry[]): React.ReactNode {
        if (rows.length === 0) {
            return null;
        }
        return rows.map((entry, index) => (
            <div
                key={`${entry.name}::${entry.line}::${index}`}
                id={this.rowId(index)}
                data-notepadia-function-list-row={entry.kind}
                data-notepadia-function-index={index}
                data-notepadia-function-name={entry.name}
                data-notepadia-function-line={entry.line}
                className={
                    'notepadia-function-list-row'
                    + (this.cursorOnEntry && this.cursor === index ? '-selected' : '')
                }
                role="treeitem"
                aria-level={1}
                aria-selected={this.cursorOnEntry && this.cursor === index}
                // The name, kind and line are all in the accessible name: a
                // row that announced only "greet" would leave the reader
                // guessing which of two same-named symbols it is on.
                aria-label={`${entry.name}, ${entry.kind}, line ${entry.line}`}
                onClick={() => {
                    this.cursor = index;
                    this.cursorOnEntry = true;
                    this.update();
                    this.navigate(entry);
                }}
            >
                <span className="notepadia-function-list-kind" aria-hidden="true">
                    {entry.kind === 'function' ? 'ƒ' : entry.kind === 'class' ? 'C' : '#'}
                </span>
                <span className="notepadia-function-list-name">{entry.name}</span>
                <span className="notepadia-function-list-line" aria-hidden="true">{entry.line}</span>
            </div>
        ));
    }

    protected renderEmpty(language: string): React.ReactNode {
        const message = !language
            ? 'Open a file to list its functions.'
            : this.filter
                ? `Nothing matches "${this.filter}".`
                : `No functions found in this ${language} file.`;
        return <div className="notepadia-function-list-empty" role="status">{message}</div>;
    }

    protected rowId(index: number): string {
        return `${NotepadiaFunctionListWidget.ID}-row-${index}`;
    }

    protected focusTree(): void {
        this.node.querySelector<HTMLElement>('.notepadia-function-list-tree')?.focus();
    }
}
