import * as React from '@theia/core/shared/react';
import { inject, injectable } from '@theia/core/shared/inversify';
import { ApplicationShell, OpenerService, ReactWidget, open } from '@theia/core/lib/browser';
import { NavigatableWidget } from '@theia/core/lib/browser/navigatable-types';
import { URI } from '@theia/core/lib/common/uri';
import { EditorWidget } from '@theia/editor/lib/browser';
import * as monaco from '@theia/monaco-editor-core';
import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';

/**
 * Notepad++'s Search Results window (F7), as a bottom-area view.
 *
 * The window is an append-only stack of searches: every Find All adds a
 * collapsible group on top and nothing is ever removed behind the user's back,
 * which is why the groups outlive the searches that produced them and why
 * Clear All is an explicit command rather than a side effect of a new search.
 *
 * The three producers are the Find dialog's "Find All in Current Document",
 * "Find All in All Opened Documents" and the Find in Files tab. They hand over
 * plain data ({@link NotepadiaSearchInput}) rather than reaching into this
 * widget's DOM, so the widget owns the whole presentation.
 */

export interface NotepadiaSearchHitInput {
    /** 1-based line number, as both Monaco and the search backend count. */
    line: number;
    /** 1-based column of the first matched character. */
    column: number;
    /** Length of the match in characters. */
    length: number;
    /** The full text of the line, used to render the row. */
    text: string;
}

export interface NotepadiaSearchFileInput {
    uri: string;
    /** Name shown on the per-file header. */
    name: string;
    hits: NotepadiaSearchHitInput[];
}

export interface NotepadiaSearchInput {
    term: string;
    /**
     * Where the search ran, rendered into the group header. Notepad++ does not
     * show this; it is kept because "12 hits" means something different when it
     * covers one document than when it covers a workspace.
     */
    scope: string;
    files: NotepadiaSearchFileInput[];
    /**
     * How many files were searched, for the "of N searched" tail of the header.
     * The search backend does not report it, so a workspace search that cannot
     * state it leaves this undefined and the header omits the tail rather than
     * printing a number that is wrong.
     */
    filesSearched?: number;
}

interface NotepadiaSearchHit extends NotepadiaSearchHitInput {
    uri: string;
    key: string;
}

interface NotepadiaSearchFile {
    uri: string;
    name: string;
    hits: NotepadiaSearchHit[];
}

interface NotepadiaSearchGroup {
    id: string;
    term: string;
    scope: string;
    files: NotepadiaSearchFile[];
    hits: number;
    filesSearched?: number;
}

type NotepadiaSearchRow =
    | { kind: 'group'; id: string; group: NotepadiaSearchGroup }
    | { kind: 'file'; id: string; group: NotepadiaSearchGroup; file: NotepadiaSearchFile }
    | { kind: 'hit'; id: string; group: NotepadiaSearchGroup; file: NotepadiaSearchFile; hit: NotepadiaSearchHit };

@injectable()
export class NotepadiaSearchResultsWidget extends ReactWidget {

    static readonly ID = 'notepadia.searchResults';
    static readonly LABEL = 'Search Results';

    protected readonly styleId = 'notepadia-search-results-style';
    protected readonly styleText = `
.notepadia-search-results-host { height: 100%; overflow: hidden; }
.notepadia-search-results { display: flex; flex-direction: column; height: 100%; min-height: 0; font-size: var(--theia-ui-font-size); }
.notepadia-search-results-toolbar { display: flex; gap: 4px; padding: 4px 6px; border-bottom: 1px solid var(--theia-editorGroup-border); flex: none; }
.notepadia-search-results-toolbar .theia-button { padding: 1px 8px; }
.notepadia-search-results-live { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.notepadia-search-results-tree { flex: 1; overflow: auto; padding: 2px 0; }
.notepadia-search-results-tree:focus { outline: none; }
.notepadia-search-results-row { display: flex; align-items: center; gap: 6px; padding: 1px 8px; cursor: pointer; white-space: nowrap; }
.notepadia-search-results-row:hover { background: var(--theia-list-hoverBackground); }
.notepadia-search-results-row.selected { background: var(--theia-list-activeSelectionBackground); color: var(--theia-list-activeSelectionForeground); }
.notepadia-search-results-twisty { width: 12px; flex: none; text-align: center; }
.notepadia-search-results-label { overflow: hidden; text-overflow: ellipsis; }
.notepadia-search-results-group .notepadia-search-results-label { font-weight: 600; }
.notepadia-search-results-row .theia-button { padding: 0 6px; flex: none; }
.notepadia-search-results-file .notepadia-search-results-label { font-weight: 500; }
.notepadia-search-results-hit .notepadia-search-results-label { font-family: var(--theia-editor-font-family); }
.notepadia-search-results-line { color: var(--theia-descriptionForeground); flex: none; }
.notepadia-search-results-match { background: var(--theia-editor-selectionBackground); color: var(--theia-editor-selectionForeground); font-weight: 600; }
.notepadia-search-results-empty { padding: 8px; color: var(--theia-descriptionForeground); }
`;

    protected groups: NotepadiaSearchGroup[] = [];
    /** Collapsed groups and collapsed files, keyed by their row id. */
    protected readonly collapsed: Set<string> = new Set();
    /** The focused row, used for aria-activedescendant and Enter. */
    protected cursor: string | undefined;
    protected announcement = '';
    protected groupCounter = 0;

    constructor(
        @inject(ApplicationShell) protected readonly shell: ApplicationShell,
        @inject(OpenerService) protected readonly openerService: OpenerService
    ) {
        super();
        this.id = NotepadiaSearchResultsWidget.ID;
        this.title.label = NotepadiaSearchResultsWidget.LABEL;
        this.title.caption = 'Notepad++ Search Results window';
        this.title.closable = true;
        this.title.iconClass = 'codicon codicon-search';
        this.node.tabIndex = -1;
        this.node.classList.add('notepadia-search-results-host');
        this.injectStyle();
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

    // ---------------------------------------------------------------- publish

    /**
     * Appends one search as a new group and reveals the window, which is what
     * Notepad++ does on every Find All. The window is revealed rather than
     * focused so that a Find All from inside the Find dialog leaves the dialog
     * usable.
     */
    addSearch(input: NotepadiaSearchInput): void {
        const id = `g${++this.groupCounter}`;
        const files: NotepadiaSearchFile[] = input.files.map(file => ({
            uri: file.uri,
            name: file.name,
            hits: file.hits.map(hit => ({
                ...hit,
                uri: file.uri,
                key: `${id}::${file.uri}::${hit.line}::${hit.column}`
            }))
        }));
        const hits = files.reduce((count, file) => count + file.hits.length, 0);
        this.groups.push({
            id,
            term: input.term,
            scope: input.scope,
            files,
            hits,
            filesSearched: input.filesSearched
        });
        this.announcement = hits === 0
            ? `No results for "${input.term}"`
            : `${hits} hit${hits === 1 ? '' : 's'} in ${files.length} file${files.length === 1 ? '' : 's'} for "${input.term}"`;
        this.update();
        this.reveal();
    }

    /** Notepad++'s Search Results window context menu, as panel buttons. */
    collapseAll(): void {
        for (const row of this.visibleCollapsibleRows(false)) {
            this.collapsed.add(row);
        }
        this.update();
    }

    expandAll(): void {
        this.collapsed.clear();
        this.update();
    }

    clearAll(): void {
        this.groups = [];
        this.collapsed.clear();
        this.cursor = undefined;
        this.announcement = 'Search results cleared';
        this.update();
    }

    /** Drops a single group, which is the per-group "Clear" button. */
    clearGroup(groupId: string): void {
        this.groups = this.groups.filter(group => group.id !== groupId);
        if (this.belongsTo(this.cursor, groupId)) {
            this.cursor = undefined;
        }
        this.update();
    }

    /**
     * Collapsing a group is enough to hide everything under it, because a row is
     * only drawn when every ancestor is expanded.
     */
    collapseGroup(groupId: string): void {
        this.collapsed.add(`group:${groupId}`);
        this.update();
    }

    /** Expands the group and leaves any other group as it was. */
    expandGroup(groupId: string): void {
        for (const id of Array.from(this.collapsed)) {
            if (this.belongsTo(id, groupId)) {
                this.collapsed.delete(id);
            }
        }
        this.update();
    }

    /** A row id belongs to a group if it is the group or hangs under it. */
    protected belongsTo(rowId: string | undefined, groupId: string): boolean {
        return rowId !== undefined && (rowId === `group:${groupId}`
            || rowId.startsWith(`file:${groupId}::`)
            || rowId.startsWith(`${groupId}::`));
    }

    protected async reveal(): Promise<void> {
        await this.open();
    }

    /**
     * Adds the window to the bottom area on first use and shows it.
     *
     * getOrCreateWidget only builds the widget; the shell decides where it
     * lives, and Notepad++ keeps this window docked at the bottom under the
     * editor rather than as another tab in the main area.
     */
    async open(): Promise<void> {
        if (!this.isAttached) {
            await this.shell.addWidget(this, { area: 'bottom' });
        }
        this.show();
        await this.shell.activateWidget(this.id);
    }

    // ------------------------------------------------------------- navigation

    /**
     * Steps to the next hit across every group, in group, file and line order,
     * wrapping at the end. Notepad++ binds this to F4 so that stepping through
     * results never requires the results window to have focus.
     */
    async nextResult(): Promise<void> {
        await this.stepResult(1);
    }

    async previousResult(): Promise<void> {
        await this.stepResult(-1);
    }

    protected async stepResult(direction: 1 | -1): Promise<void> {
        const hits = this.groups.flatMap(group => group.files.flatMap(file => file.hits.map(hit => ({ hit }))));
        if (hits.length === 0) {
            return;
        }
        const hit = hits[this.stepIndex(hits, direction)].hit;
        this.cursor = hit.key;
        this.update();
        await this.revealHit(hit, true);
    }

    /**
     * Where a step starts: from the row the user last chose in the window, and
     * otherwise from the caret, which is what Notepad++'s Next/Previous Search
     * Result do - they move relative to where you are, not relative to the
     * window. Stepping past either end wraps, so a keypress always moves.
     */
    protected stepIndex(hits: { hit: NotepadiaSearchHit }[], direction: 1 | -1): number {
        const chosen = hits.findIndex(entry => entry.hit.key === this.cursor);
        if (chosen !== -1) {
            return (chosen + direction + hits.length) % hits.length;
        }
        const position = this.editorPosition();
        if (position) {
            // Only hits in the caret's own document can be compared to it; with
            // the caret in another file there is no ordering to respect, so the
            // whole list is the pool and the first/last hit wins.
            const here = hits.filter(entry => entry.hit.uri === position.uri);
            const pool = here.length > 0 ? here : hits;
            const beyond = (entry: { hit: NotepadiaSearchHit }): boolean =>
                entry.hit.line > position.line
                || (entry.hit.line === position.line && entry.hit.column > position.column);
            const before = (entry: { hit: NotepadiaSearchHit }): boolean =>
                entry.hit.line < position.line
                || (entry.hit.line === position.line && entry.hit.column < position.column);
            const ordered = direction === 1 ? pool : [...pool].reverse();
            const found = ordered.find(entry => (direction === 1 ? beyond(entry) : before(entry)));
            if (found) {
                return hits.indexOf(found);
            }
        }
        return direction === 1 ? 0 : hits.length - 1;
    }

    /** The focused editor's document and caret, if the shell has one. */
    protected editorPosition(): { uri: string; line: number; column: number } | undefined {
        const current = this.shell.currentWidget;
        const control = current ? MonacoEditor.get(current as EditorWidget)?.getControl() : undefined;
        const model = control?.getModel();
        const position = control?.getPosition();
        if (!model || !position) {
            return undefined;
        }
        return { uri: model.uri.toString(), line: position.lineNumber, column: position.column };
    }

    /**
     * Opens the hit's document, scrolls the line into view and selects the
     * match. `focusEditor` is the double-click behaviour: a single click leaves
     * the cursor in the results window so that Enter can walk onward, while a
     * double click hands focus to the editor.
     */
    protected async revealHit(hit: NotepadiaSearchHit, focusEditor: boolean): Promise<void> {
        const uri = new URI(hit.uri);
        const widget = await open(this.openerService, uri);
        if (!NavigatableWidget.is(widget)) {
            return;
        }
        const editor = widget as EditorWidget;
        const control = MonacoEditor.get(editor)?.getControl();
        if (!control) {
            return;
        }
        const selection = new monaco.Selection(
            hit.line, hit.column, hit.line, hit.column + hit.length);
        control.revealLineInCenter(hit.line);
        control.setSelection(selection);
        if (focusEditor) {
            this.cursor = hit.key;
            this.update();
            await this.shell.activateWidget(editor.id);
            control.focus();
        }
    }

    // ----------------------------------------------------------------- render

    protected render(): React.ReactNode {
        return (
            <div className="notepadia-search-results">
                {this.renderToolbar()}
                <div className="notepadia-search-results-live" role="status" aria-live="polite">
                    {this.announcement}
                </div>
                {this.groups.length === 0
                    ? <div className="notepadia-search-results-empty">No searches yet. Use Find All or press F7.</div>
                    : this.renderTree()}
            </div>
        );
    }

    protected renderToolbar(): React.ReactNode {
        return (
            <div className="notepadia-search-results-toolbar">
                <button type="button" className="theia-button" onClick={() => this.collapseAll()}>Collapse All</button>
                <button type="button" className="theia-button" onClick={() => this.expandAll()}>Expand All</button>
                <button type="button" className="theia-button" onClick={() => this.clearAll()}>Clear All</button>
            </div>
        );
    }

    protected renderTree(): React.ReactNode {
        return (
            <div
                className="notepadia-search-results-tree"
                role="tree"
                aria-label="Search Results"
                tabIndex={0}
                aria-activedescendant={this.cursor}
                onKeyDown={event => this.onTreeKeyDown(event)}
            >
                {this.groups.map(group => this.renderGroup(group))}
            </div>
        );
    }

    protected renderGroup(group: NotepadiaSearchGroup): React.ReactNode {
        const id = `group:${group.id}`;
        const expanded = !this.collapsed.has(id);
        return (
            <div key={group.id}>
                <div
                    id={id}
                    data-notepadia-search-row="group"
                    data-hits={group.hits}
                    data-files={group.files.length}
                    data-searched={group.filesSearched}
                    role="treeitem"
                    aria-level={1}
                    aria-expanded={expanded}
                    aria-selected={this.cursor === id}
                    className={`notepadia-search-results-row notepadia-search-results-group${this.cursor === id ? ' selected' : ''}`}
                    onClick={() => this.toggle(id)}
                >
                    <span className="notepadia-search-results-twisty" aria-hidden="true">{expanded ? '▾' : '▸'}</span>
                    <span className="notepadia-search-results-label">{this.groupLabel(group)}</span>
                    <button type="button" className="theia-button" onClick={event => { event.stopPropagation(); this.collapseGroup(group.id); }}>Collapse All</button>
                    <button type="button" className="theia-button" onClick={event => { event.stopPropagation(); this.expandGroup(group.id); }}>Expand All</button>
                    <button type="button" className="theia-button" onClick={event => { event.stopPropagation(); this.clearGroup(group.id); }}>Clear</button>
                </div>
                {expanded && group.files.map(file => this.renderFile(group, file))}
            </div>
        );
    }

    protected renderFile(group: NotepadiaSearchGroup, file: NotepadiaSearchFile): React.ReactNode {
        const id = `file:${group.id}::${file.uri}`;
        const expanded = !this.collapsed.has(id);
        return (
            <div key={id}>
                <div
                    id={id}
                    data-notepadia-search-row="file"
                    role="treeitem"
                    aria-level={2}
                    aria-expanded={expanded}
                    aria-selected={this.cursor === id}
                    className={`notepadia-search-results-row notepadia-search-results-file${this.cursor === id ? ' selected' : ''}`}
                    onClick={() => this.toggle(id)}
                >
                    <span className="notepadia-search-results-twisty" aria-hidden="true">{expanded ? '▾' : '▸'}</span>
                    <span className="notepadia-search-results-label">{file.name}</span>
                </div>
                {expanded && file.hits.map(hit => this.renderHit(file, hit))}
            </div>
        );
    }

    protected renderHit(file: NotepadiaSearchFile, hit: NotepadiaSearchHit): React.ReactNode {
        const id = hit.key;
        const selected = this.cursor === id;
        return (
            <div
                key={id}
                id={id}
                data-notepadia-search-row="hit"
                data-uri={hit.uri}
                data-line={hit.line}
                data-column={hit.column}
                role="treeitem"
                aria-level={3}
                aria-selected={selected}
                className={`notepadia-search-results-row notepadia-search-results-hit${selected ? ' selected' : ''}`}
                onClick={() => { this.cursor = id; this.update(); this.revealHit(hit, false); }}
                onDoubleClick={() => this.revealHit(hit, true)}
            >
                <span className="notepadia-search-results-twisty" aria-hidden="true" />
                <span className="notepadia-search-results-line">{`Line ${hit.line}: `}</span>
                <span className="notepadia-search-results-label">{this.renderLine(hit)}</span>
            </div>
        );
    }

    /**
     * The line text with the match wrapped. The row keeps Notepad++'s
     * "Line N: " prefix as a separate span so that e2e can read the whole row
     * text and still find the line number.
     */
    protected renderLine(hit: NotepadiaSearchHit): React.ReactNode {
        const before = hit.text.slice(0, Math.max(0, hit.column - 1));
        const match = hit.text.slice(Math.max(0, hit.column - 1), hit.column - 1 + hit.length);
        const after = hit.text.slice(hit.column - 1 + hit.length);
        return (
            <>
                {before}
                <span className="notepadia-search-results-match">{match}</span>
                {after}
            </>
        );
    }

    /** Notepad++'s exact header: Search "foo" (12 hits in 3 files of 8 searched). */
    protected groupLabel(group: NotepadiaSearchGroup): string {
        const files = `${group.files.length} file${group.files.length === 1 ? '' : 's'}`;
        const searched = group.filesSearched === undefined
            ? ''
            : ` of ${group.filesSearched} searched`;
        return `Search "${group.term}" (${group.hits} hit${group.hits === 1 ? '' : 's'} in ${files}${searched})`;
    }

    // -------------------------------------------------------------- keyboard

    protected onTreeKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
        const rows = this.visibleRows();
        if (rows.length === 0) {
            return;
        }
        const index = rows.findIndex(row => row.id === this.cursor);
        const move = (target: number): void => {
            const row = rows[Math.max(0, Math.min(rows.length - 1, target))];
            this.cursor = row.id;
            this.update();
        };
        switch (event.key) {
            case 'ArrowDown':
                move(index + 1);
                break;
            case 'ArrowUp':
                move(index - 1);
                break;
            case 'Home':
                move(0);
                break;
            case 'End':
                move(rows.length - 1);
                break;
            case 'ArrowRight':
                // Collapsed rows expand first, which is what a tree owes the
                // user; an expanded row moves into its children.
                if (index >= 0 && rows[index].kind !== 'hit' && this.collapsed.has(rows[index].id)) {
                    this.collapsed.delete(rows[index].id);
                    this.update();
                } else {
                    move(index + 1);
                }
                break;
            case 'ArrowLeft':
                if (index >= 0 && rows[index].kind !== 'hit' && !this.collapsed.has(rows[index].id)) {
                    this.collapsed.add(rows[index].id);
                    this.update();
                } else {
                    move(this.parentOf(rows[index]));
                }
                break;
            case 'Enter': {
                const row = index >= 0 ? rows[index] : undefined;
                if (!row) {
                    break;
                }
                if (row.kind === 'hit') {
                    this.revealHit(row.hit, true);
                } else {
                    this.toggle(row.id);
                }
                event.preventDefault();
                break;
            }
            default:
                return;
        }
        event.preventDefault();
    }

    protected parentOf(row: NotepadiaSearchRow | undefined): number {
        if (!row) {
            return 0;
        }
        if (row.kind === 'hit') {
            const index = this.visibleRows().findIndex(candidate => candidate.id === `file:${row.group.id}::${row.file.uri}`);
            return index;
        }
        if (row.kind === 'file') {
            return this.visibleRows().findIndex(candidate => candidate.id === `group:${row.group.id}`);
        }
        return 0;
    }

    protected toggle(id: string): void {
        if (this.collapsed.has(id)) {
            this.collapsed.delete(id);
        } else {
            this.collapsed.add(id);
        }
        this.update();
    }

    /** Every row currently rendered, in visual order, for arrow-key movement. */
    protected visibleRows(): NotepadiaSearchRow[] {
        const rows: NotepadiaSearchRow[] = [];
        for (const group of this.groups) {
            const groupId = `group:${group.id}`;
            rows.push({ kind: 'group', id: groupId, group });
            if (this.collapsed.has(groupId)) {
                continue;
            }
            for (const file of group.files) {
                const fileId = `file:${group.id}::${file.uri}`;
                rows.push({ kind: 'file', id: fileId, group, file });
                if (this.collapsed.has(fileId)) {
                    continue;
                }
                for (const hit of file.hits) {
                    rows.push({ kind: 'hit', id: hit.key, group, file, hit });
                }
            }
        }
        return rows;
    }

    /** Collapsible row ids, filtered by their current state for the two buttons. */
    protected visibleCollapsibleRows(collapsed: boolean): string[] {
        return this.visibleRows()
            .filter(row => row.kind !== 'hit' && this.collapsed.has(row.id) === collapsed)
            .map(row => row.id);
    }
}