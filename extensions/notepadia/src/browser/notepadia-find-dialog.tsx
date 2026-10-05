import * as React from '@theia/core/shared/react';
import { inject, injectable } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { StorageService } from '@theia/core/lib/browser/storage-service';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { WidgetManager } from '@theia/core/lib/browser/widget-manager';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';
import * as monaco from '@theia/monaco-editor-core';
import { SearchInWorkspaceWidget } from '@theia/search-in-workspace/lib/browser/search-in-workspace-widget';
import { SearchInWorkspaceService } from '@theia/search-in-workspace/lib/browser/search-in-workspace-service';
import {
    SearchInWorkspaceClient,
    SearchInWorkspaceOptions
} from '@theia/search-in-workspace/lib/common/search-in-workspace-interface';
import { URI } from '@theia/core/lib/common/uri';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { Disposable } from '@theia/core/lib/common/disposable';
import {
    addHistory,
    describeMatchCount,
    type FindOptions,
    type NotepadiaSearchMode,
    resolveSearch
} from '../common/find-options';
import { NotepadiaFindState } from './notepadia-find-state';
import { MARK_STYLE_COUNT, NotepadiaSearchMarkContribution } from './notepadia-search-mark';
import {
    NotepadiaSearchFileInput,
    NotepadiaSearchHitInput,
    NotepadiaSearchInput,
    NotepadiaSearchResultsWidget
} from './notepadia-search-results-widget';

/**
 * The Find dialog tabs, mirroring the Notepad++ "Find / Replace / Find in
 * Files / Mark" dialog.
 */
export type NotepadiaFindTab = 'find' | 'replace' | 'files' | 'mark';

const HISTORY_KEYS = {
    term: 'notepadia.find.history.term',
    replace: 'notepadia.find.history.replace'
};

interface DragState {
    readonly pointerId: number;
    readonly startX: number;
    readonly startY: number;
    readonly originLeft: number;
    readonly originTop: number;
}

/** Index of the first match whose start is at or after `position` (-1 wrapped). */
function firstIndexOfMatchFrom(matches: readonly monaco.editor.FindMatch[], position: monaco.IPosition): number {
    return matches.findIndex(m =>
        m.range.startLineNumber > position.lineNumber ||
        (m.range.startLineNumber === position.lineNumber && m.range.startColumn >= position.column)
    );
}

/** Index of the last match whose start is strictly before `position` (-1 wrapped). */
function lastIndexOfMatchBefore(matches: readonly monaco.editor.FindMatch[], position: monaco.IPosition): number {
    for (let i = matches.length - 1; i >= 0; i--) {
        const start = matches[i].range;
        if (start.startLineNumber < position.lineNumber ||
            (start.startLineNumber === position.lineNumber && start.startColumn < position.column)) {
            return i;
        }
    }
    return -1;
}

/**
 * The Notepad++ tabbed Find dialog (B2).
 *
 * The dialog is a **modeless** floating panel: it never replaces the Monaco
 * find widget (whose handler is overridden so the inline widget is also never
 * shown), the editor below stays editable while it is open, and pressing F3 /
 * Shift+F3 continues the last search even after the dialog is closed.
 *
 * State is kept in `NotepadiaFindState` so the Mark engine, the Search > Mark
 * submenu and the F3 continuation all read the same term and options.
 * Everything user-visible is keyboard operable and carries an accessible name.
 */
@injectable()
export class NotepadiaFindDialog extends ReactWidget {

    static readonly ID = 'notepadia-find-dialog';

    protected mode: NotepadiaSearchMode = 'normal';
    protected tab: NotepadiaFindTab = 'find';
    protected showReplace = false;
    protected markStyle = 0;
    protected purge = false;

    /** Find in Files tab fields (kept local to the dialog). */
    protected filesFilters = '';
    protected filesDirectory = '';
    protected includeHidden = false;

    protected termHistory: string[] = [];
    protected replaceHistory: string[] = [];
    protected status = '';

    protected inlineWidgetObserver!: MutationObserver;

    protected drag: DragState | undefined;

    constructor(
        @inject(EditorManager) protected readonly editorManager: EditorManager,
        @inject(ApplicationShell) protected readonly shell: ApplicationShell,
        @inject(WidgetManager) protected readonly widgetManager: WidgetManager,
        @inject(StorageService) protected readonly storage: StorageService,
        @inject(WorkspaceService) protected readonly workspaceService: WorkspaceService,
        @inject(NotepadiaFindState) protected readonly findState: NotepadiaFindState,
        @inject(NotepadiaSearchMarkContribution) protected readonly searchMark: NotepadiaSearchMarkContribution,
        @inject(SearchInWorkspaceService) protected readonly searchInWorkspace: SearchInWorkspaceService
    ) {
        super();
        this.id = NotepadiaFindDialog.ID;
        this.addClass('notepadia-find');
        this.title.label = 'Find';
        this.title.caption = 'Notepad++ Find dialog';
        this.title.closable = false;
        this.scrollOptions = undefined;

        this.node.classList.add('notepadia-find-host');
        this.toDispose.push(Disposable.create(() => this.node.remove()));

        this.mode = this.searchMark.searchMode();
        this.toDispose.push(this.findState.onDidChange(() => this.update()));

        // Monaco keeps reopening its inline find widget on Ctrl+F / Ctrl+H
        // through a listener our document-level capture hook cannot reach, so
        // whenever the tabbed dialog is on screen any inline find widget that
        // shows up is hidden again (and kept covered while the dialog lives).
        this.inlineWidgetObserver = new MutationObserver(() => {
            if (!this.dialogVisible()) {
                return;
            }
            requestAnimationFrame(() => this.hideInlineFindWidgets());
        });
        this.inlineWidgetObserver.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class'] });
        this.toDispose.push(Disposable.create(() => this.inlineWidgetObserver.disconnect()));

        // Notepad++ closes the Find dialog on Escape wherever the focus is,
        // including from the editor the dialog floats over. The dialog's own
        // inputs are covered by the React handler; this document-level listener
        // covers the editor, the menu bar and the rest of the workbench.
        this.toDispose.push(Disposable.create(() => document.removeEventListener('keydown', this.handleDocumentKeyDown, true)));
        document.addEventListener('keydown', this.handleDocumentKeyDown, true);

        // Load the persisted history lists lazily; nothing depends on them
        // until a field is rendered.
        this.storage.getData<string[]>(HISTORY_KEYS.term, []).then(list => {
            this.termHistory = Array.isArray(list) ? list : [];
            this.update();
        }).catch(() => { /* keep the empty default */ });
        this.storage.getData<string[]>(HISTORY_KEYS.replace, []).then(list => {
            this.replaceHistory = Array.isArray(list) ? list : [];
            this.update();
        }).catch(() => { /* keep the empty default */ });
    }

    protected override onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        this.focusPrimary();
    }

    // --- public API -------------------------------------------------------

    /** Opens the dialog, activating the given tab, and re-focuses editor after close. */
    open(tab: NotepadiaFindTab = 'find', showReplace?: boolean): void {
        // Re-seed the term from the current selection only when the dialog was
        // closed and the user activated it again - matches Notepad++ seeding.
        if (!this.dialogVisible()) {
            this.seedTermFromSelection();
        }
        this.tab = tab;
        this.showReplace = showReplace ?? (tab === 'replace');
        this.mode = this.searchMark.searchMode();
        if (this.node.parentElement !== document.body) {
            document.body.appendChild(this.node);
        }
        this.node.style.display = 'block';
        this.hideInlineFindWidgets();
        this.update();
        this.activate();
    }

    /** Whether a document is open to search in. */
    canFind(): boolean {
        return !!this.currentEditor();
    }

    /** Hides the dialog and returns focus to the editor. */
    close(): void {
        this.node.style.display = 'none';
        this.focusEditor();
    }

    /**
     * F3 / Shift+F3 continuation: perform a Find Next/Previous using the last
     * search options even when the dialog is closed.
     */
    continueFindNext(): boolean {
        return this.findNext(false);
    }

    continueFindPrevious(): boolean {
        return this.findNext(true);
    }

    /**
     * Runs a Mark action the way Notepad++ does when the entry is picked from
     * the Search menu: the dialog opens on its Mark tab and the action fires,
     * so the user sees where the marks came from and can change the style
     * before marking again.
     */
    runMarkAction(action: 'mark' | 'clear' | 'select'): void {
        this.open('mark');
        if (action === 'clear') {
            this.searchMark.clear();
            this.setStatus('Cleared all marks');
        } else if (action === 'select') {
            this.searchMark.selectFindNext();
            this.setStatus('Selected the next occurrence');
        } else {
            this.markPage();
        }
    }

    protected dialogVisible(): boolean {
        return this.node.isConnected && this.node.style.display !== 'none';
    }

    protected handleDocumentKeyDown = (event: KeyboardEvent): void => {
        if (event.key !== 'Escape' || !this.dialogVisible()) {
            return;
        }
        // Inside the dialog the React handler owns Escape; only the outside
        // world is intercepted here.
        if (event.target instanceof HTMLElement && this.node.contains(event.target)) {
            return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        this.close();
    };

    protected focusEditor(): void {
        const widget = this.editorManager.currentEditor;
        if (!widget) {
            return;
        }
        const editor = MonacoEditor.get(widget);
        window.requestAnimationFrame(() => editor?.getControl()?.focus());
    }

    /** Keeps Monaco's inline find widget out of the way while the dialog is up. */
    protected hideInlineFindWidgets(): void {
        document.querySelectorAll<HTMLElement>('.monaco-editor .find-widget').forEach(widget => {
            widget.style.setProperty('display', 'none', 'important');
            widget.style.setProperty('visibility', 'hidden', 'important');
        });
    }

    protected focusPrimary(): void {
        window.requestAnimationFrame(() => {
            const el = this.node.querySelector<HTMLElement>('[data-notepadia-find-focus]');
            el?.focus();
        });
    }

    // --- editor plumbing --------------------------------------------------

    protected currentEditor(): MonacoEditor | undefined {
        const widget = this.editorManager.currentEditor;
        return widget ? MonacoEditor.get(widget) : undefined;
    }

    protected currentControl(): monaco.editor.ICodeEditor | undefined {
        return this.currentEditor()?.getControl();
    }

    protected currentModel(): monaco.editor.ITextModel | undefined {
        return this.currentControl()?.getModel() ?? undefined;
    }

    protected selectionText(): string {
        const control = this.currentControl();
        const model = this.currentModel();
        const sel = control?.getSelection();
        if (!control || !model || !sel || sel.isEmpty()) {
            return '';
        }
        return model.getValueInRange(new monaco.Range(
            sel.startLineNumber, sel.startColumn, sel.endLineNumber, sel.endColumn
        ));
    }

    protected seedTermFromSelection(): void {
        if (this.findState.get().term) {
            return;
        }
        // Exact selection first (Notepad++ copies the selected text into the
        // Find box), otherwise the word under the caret.
        const text = this.selectionText();
        if (text) {
            this.findState.set({ term: text });
            return;
        }
        const control = this.currentControl();
        const model = this.currentModel();
        const position = control?.getPosition();
        if (control && model && position) {
            const word = model.getWordAtPosition(position);
            if (word) {
                this.findState.set({ term: word.word });
            }
        }
    }

    // --- search core ------------------------------------------------------

    protected resolved(): { term: string; isRegex: boolean } {
        return resolveSearch(this.findState.get().term, this.mode);
    }

    /** Word separators passed to Monaco when "Match whole word" is on. */
    protected wordSeparators(): string | null {
        const control = this.currentControl();
        if (!this.findState.get().wholeWord || !control) {
            return null;
        }
        return control.getOption(monaco.editor.EditorOption.wordSeparators);
    }

    /**
     * All matches for the current term, optionally restricted to a range
     * ("In selection").
     */
    protected allMatches(scope?: monaco.IRange): monaco.editor.FindMatch[] {
        const model = this.currentModel();
        const opts = this.findState.get();
        if (!model || !opts.term) {
            return [];
        }
        const { term, isRegex } = this.resolved();
        if (!term) {
            return [];
        }
        // Monaco's findMatches has two overloads: a boolean "editable range
        // only" flag, or an explicit scope range. Branch explicitly so the
        // SOW/`scope `union stays legal.
        return scope
            ? model.findMatches(term, scope, isRegex, opts.caseSensitive, this.wordSeparators(), false, 10000)
            : model.findMatches(term, true, isRegex, opts.caseSensitive, this.wordSeparators(), false, 10000);
    }

    /** Moves to the next/previous occurrence (with wrap). */
    protected findNext(backward: boolean, reveal = true): boolean {
        const control = this.currentControl();
        const model = this.currentModel();
        const opts = this.findState.get();
        if (!control || !model || !opts.term) {
            return false;
        }
        const { term, isRegex } = this.resolved();
        const wordSeparators = this.wordSeparators();
        const selection = control.getSelection();
        const anchor = backward
            ? selection?.getStartPosition() ?? { lineNumber: 1, column: 1 }
            : selection?.getEndPosition() ?? { lineNumber: 1, column: 1 };

        // "In selection": move within the selected range only.
        if (opts.inSelection && selection && !selection.isEmpty()) {
            return this.stepWithinSelection(control, model, backward, reveal);
        }

        const probe = backward
            ? model.findPreviousMatch(term, anchor, isRegex, opts.caseSensitive, wordSeparators, false)
            : model.findNextMatch(term, anchor, isRegex, opts.caseSensitive, wordSeparators, false);
        const match = probe ?? (opts.wrap
            ? (backward
                ? model.findPreviousMatch(term, { lineNumber: model.getLineCount() + 1, column: 1 }, isRegex, opts.caseSensitive, wordSeparators, false)
                : model.findNextMatch(term, { lineNumber: 1, column: 1 }, isRegex, opts.caseSensitive, wordSeparators, false))
            : null);
        if (!match) {
            this.setStatus('No results');
            return false;
        }
        return this.applyMatch(match.range, reveal);
    }

    protected stepWithinSelection(
        control: monaco.editor.ICodeEditor,
        _model: monaco.editor.ITextModel,
        backward: boolean,
        reveal: boolean
    ): boolean {
        const selection = control.getSelection();
        if (!selection) {
            return false;
        }
        const matches = this.allMatches(selection);
        if (matches.length === 0) {
            this.setStatus('No results');
            return false;
        }
        // Boundaries: step forward from the start of the (possible) current
        // match, backward from the position before it. Matches are ascending.
        const cursor = { lineNumber: selection.startLineNumber, column: backward ? selection.startColumn - 1 : selection.startColumn };
        let index = backward
            ? lastIndexOfMatchBefore(matches, cursor)
            : firstIndexOfMatchFrom(matches, cursor);
        if (index < 0) {
            index = backward ? matches.length - 1 : 0;
        }
        return this.applyMatch(matches[index].range, reveal);
    }

    /** Selects a match range, reveals it and updates the status line. */
    protected applyMatch(range: monaco.IRange, reveal: boolean): boolean {
        const control = this.currentControl();
        if (!control) {
            return false;
        }
        control.setSelection(new monaco.Range(
            range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn
        ));
        if (reveal) {
            control.revealRangeInCenterIfOutsideViewport(range);
        }
        this.setStatus(describeMatchCount(this.allMatches().length, this.currentMatchIndex(range)));
        return true;
    }

    protected currentMatchIndex(range: monaco.IRange): number {
        const matches = this.allMatches();
        const index = matches.findIndex(m =>
            m.range.startLineNumber === range.startLineNumber && m.range.startColumn === range.startColumn
        );
        return index >= 0 ? index + 1 : 0;
    }

    // --- dialog actions ---------------------------------------------------

    protected count(): void {
        const count = this.allMatches().length;
        this.setStatus(count === 0 ? 'No results' : `${count} occurrence${count === 1 ? '' : 's'}`);
    }

    protected findInCurrentDocument(): void {
        const matches = this.allMatches();
        if (matches.length === 0) {
            this.setStatus('No results');
            return;
        }
        // Notepad++ selects every hit, which is also what makes the count
        // visible in the editor rather than only in the status line.
        const control = this.currentControl();
        if (control) {
            control.setSelections(matches.map(match => new monaco.Selection(
                match.range.startLineNumber, match.range.startColumn,
                match.range.endLineNumber, match.range.endColumn
            )));
            const first = matches[0].range;
            control.revealRangeInCenterIfOutsideViewport(first);
        }
        const model = this.currentModel();
        if (model) {
            this.publishResults({
                term: this.findState.get().term,
                scope: 'Current Document',
                filesSearched: 1,
                files: [{
                    uri: model.uri.toString(),
                    name: new URI(model.uri.toString()).path.base,
                    hits: matches.map(match => this.hitFromMatch(model, match))
                }]
            });
        }
        this.setStatus(`${matches.length} result${matches.length === 1 ? '' : 's'} on current document`);
    }

    protected findInAllOpenDocuments(): void {
        let total = 0;
        let documents = 0;
        const files: NotepadiaSearchFileInput[] = [];
        for (const widget of this.editorManager.all) {
            const editor = MonacoEditor.get(widget);
            const model = editor?.getControl().getModel();
            if (!model) {
                continue;
            }
            const modelMatches = this.matchesInModel(model);
            const count = modelMatches.length;
            if (count > 0) {
                total += count;
                documents += 1;
                files.push({
                    uri: model.uri.toString(),
                    name: new URI(model.uri.toString()).path.base,
                    hits: modelMatches.map(match => this.hitFromMatch(model, match))
                });
            }
        }
        if (total === 0) {
            this.setStatus('No results');
            return;
        }
        // Reveal the first hit in the current document, if any.
        const firstHere = this.allMatches()[0];
        if (firstHere) {
            this.applyMatch(firstHere.range, true);
        }
        this.publishResults({
            term: this.findState.get().term,
            scope: 'All Opened Documents',
            filesSearched: this.editorManager.all.length,
            files
        });
        this.setStatus(`Found ${total} occurrence${total === 1 ? '' : 's'} in ${documents} document${documents === 1 ? '' : 's'}`);
    }

    /**
     * Appends one search to the Notepad++ Search Results window (B3).
     *
     * The widget is reached through WidgetManager so that the window the Find
     * dialog fills is the same instance the F7 command and the F4 navigation
     * act on; injecting the widget here would give the dialog a private one
     * with an empty group stack.
     */
    protected async publishResults(input: NotepadiaSearchInput): Promise<void> {
        const widget = await this.widgetManager.getOrCreateWidget(NotepadiaSearchResultsWidget.ID);
        if (widget instanceof NotepadiaSearchResultsWidget) {
            widget.addSearch(input);
        }
    }

    /** One Monaco match as a result row, with the line text it sits on. */
    protected hitFromMatch(model: monaco.editor.ITextModel, match: monaco.editor.FindMatch): NotepadiaSearchHitInput {
        const line = match.range.startLineNumber;
        return {
            line,
            column: match.range.startColumn,
            length: match.range.endColumn - match.range.startColumn,
            text: model.getLineContent(line)
        };
    }

    protected matchesInModel(model: monaco.editor.ITextModel): monaco.editor.FindMatch[] {
        const { term, isRegex } = this.resolved();
        const opts = this.findState.get();
        const control = this.currentControl();
        const wordSeparators = opts.wholeWord && control
            ? control.getOption(monaco.editor.EditorOption.wordSeparators)
            : null;
        return model.findMatches(term, true, isRegex, opts.caseSensitive, wordSeparators, false, 10000);
    }

    protected selectionMatches(): boolean {
        const control = this.currentControl();
        const model = this.currentModel();
        const sel = control?.getSelection();
        if (!control || !model || !sel || sel.isEmpty()) {
            return false;
        }
        const text = model.getValueInRange(new monaco.Range(
            sel.startLineNumber, sel.startColumn, sel.endLineNumber, sel.endColumn
        ));
        const { term, isRegex } = this.resolved();
        if (isRegex) {
            try {
                return new RegExp(term, this.findState.get().caseSensitive ? '' : 'i').test(text);
            } catch {
                return false;
            }
        }
        return this.findState.get().caseSensitive ? text === term : text.toLowerCase() === term.toLowerCase();
    }

    /** Replace the next occurrence (or the current match, an Npp nuance). */
    protected replaceNext(): boolean {
        const control = this.currentControl();
        const model = this.currentModel();
        const opts = this.findState.get();
        if (!control || !model || !opts.term) {
            return false;
        }
        let range: monaco.IRange;
        if (this.selectionMatches()) {
            range = control.getSelection() as monaco.IRange;
        } else {
            const moved = this.findNext(false, false);
            if (!moved) {
                return false;
            }
            range = control.getSelection() as monaco.IRange;
        }
        control.executeEdits('notepadia-replace', [{
            range,
            text: opts.replace,
            forceMoveMarkers: true
        }]);
        this.setStatus(`${opts.replace.length} character${opts.replace.length === 1 ? '' : 's'} replaced`);
        this.findNext(false);
        return true;
    }

    protected replaceAll(documents: boolean): void {
        const opts = this.findState.get();
        const current = this.currentEditor();
        if (!opts.term || !current) {
            return;
        }
        const { term, isRegex } = this.resolved();
        const control = this.currentControl();
        const wordSeparators = opts.wholeWord && control
            ? control.getOption(monaco.editor.EditorOption.wordSeparators)
            : null;
        let total = 0;
        // Without "In all open documents" the current document is the target -
        // not merely the first open one, which may well be a different editor.
        const targets = documents
            ? this.editorManager.all
            : [this.editorManager.currentEditor!];
        for (const widget of targets) {
            const editor = widget ? MonacoEditor.get(widget) : undefined;
            const targetControl = editor?.getControl();
            const model = targetControl?.getModel();
            if (!targetControl || !model) {
                continue;
            }
            const matches = model.findMatches(term, true, isRegex, opts.caseSensitive, wordSeparators, false, 10000);
            if (matches.length === 0) {
                continue;
            }
            // Execute the edits in one batch; Monaco applies them consistently
            // across the model regardless of the order given.
            const edits: monaco.editor.IIdentifiedSingleEditOperation[] = matches.map(match => ({
                range: match.range,
                text: opts.replace,
                forceMoveMarkers: true
            }));
            targetControl.executeEdits('notepadia-replace-all', edits);
            total += matches.length;
        }
        this.setStatus(total === 0
            ? 'No results'
            : `${total} replacement${total === 1 ? '' : 's'} made in ${documents ? targets.length : 1} document${documents && targets.length === 1 ? '' : 's'}`);
    }

    /**
     * The Find in Files tab is a front end over the existing
     * search-in-workspace backend rather than a second search engine: the
     * dialog's term, search mode and option checkboxes are translated into the
     * widget's own options and the results land in its panel. B3 will route
     * them into the Notepad++ Search Results window instead.
     */
    protected runFileSearch(replace = false): void {
        const opts = this.findState.get();
        if (!opts.term) {
            this.setStatus('Enter something to find');
            return;
        }
        const globs = this.fileSearchGlobs();
        if (globs === undefined) {
            this.setStatus('No workspace folder is open');
            return;
        }
        this.setStatus(replace ? 'Replacing in files...' : 'Searching in files...');
        const run = async (): Promise<void> => {
            if (!replace) {
                await this.searchInFiles(opts, globs);
                return;
            }
            const widget = await this.widgetManager.getOrCreateWidget(SearchInWorkspaceWidget.ID);
            const findWidget = widget as unknown as {
                matchCaseState: { enabled: boolean };
                wholeWordState: { enabled: boolean };
                regExpState: { enabled: boolean };
                searchInWorkspaceOptions: { include: string[]; includeIgnored: boolean };
                replaceTerm: string;
                showReplaceField: boolean;
                updateSearchTerm(term: string, showReplaceField?: boolean): void;
                performSearch(): void;
                hasResultList(): boolean;
                resultTreeWidget: { replace(preserveFocus?: boolean): void };
                update(): void;
            };
            // Search mode maps onto the backend's own flags: extended mode is a
            // literal search, regular expression turns the backend's regexp
            // option on, and the checkbox column carries the rest.
            findWidget.matchCaseState.enabled = opts.caseSensitive;
            findWidget.wholeWordState.enabled = opts.wholeWord;
            findWidget.regExpState.enabled = this.mode === 'regex';
            findWidget.searchInWorkspaceOptions.include = globs;
            findWidget.searchInWorkspaceOptions.includeIgnored = this.includeHidden;
            findWidget.showReplaceField = this.showReplace || replace;
            findWidget.replaceTerm = opts.replace;
            findWidget.updateSearchTerm(opts.term, findWidget.showReplaceField);
            findWidget.update();
            await this.shell.activateWidget(SearchInWorkspaceWidget.ID);
            await this.replaceInFiles(findWidget);
        };
        run().catch(error => this.setStatus(`Search failed: ${error.message}`));
    }

    /**
     * Notepad++'s "Find All" on the Find in Files tab fills the Search Results
     * window, not Theia's search panel, which has a different shape and
     * vocabulary from anything in Notepad++.
     *
     * The same backend does the searching: this asks the search service for
     * the results directly instead of driving the panel and scraping its tree,
     * so the rows come from structured data with the line text included. That
     * also keeps Replace All on the panel, where the replacement machinery is.
     */
    protected async searchInFiles(opts: FindOptions, globs: string[]): Promise<void> {
        const roots = this.workspaceService.tryGetRoots().map(root => root.resource.toString());
        if (roots.length === 0) {
            this.setStatus('No workspace folder is open');
            return;
        }
        const files = await this.collectFileMatches(opts.term, roots, {
            matchCase: opts.caseSensitive,
            matchWholeWord: opts.wholeWord,
            useRegExp: this.mode === 'regex',
            include: globs,
            includeIgnored: this.includeHidden
        });
        const hits = files.reduce((count, file) => count + file.hits.length, 0);
        if (hits === 0) {
            this.setStatus('No results');
            return;
        }
        this.publishResults({ term: opts.term, scope: 'Files', files });
        this.setStatus(`Found ${hits} occurrence${hits === 1 ? '' : 's'} in ${files.length} file${files.length === 1 ? '' : 's'}`);
    }

    /**
     * The search service's callback API, collected into a promise. onDone is the
     * only completion signal there is, and a failed search resolves with
     * whatever arrived rather than leaving the caller waiting.
     */
    protected collectFileMatches(term: string, roots: string[], options: SearchInWorkspaceOptions): Promise<NotepadiaSearchFileInput[]> {
        return new Promise(resolve => {
            const files: NotepadiaSearchFileInput[] = [];
            const client: SearchInWorkspaceClient = {
                onResult: (_searchId, result) => {
                    if (!result.matches || result.matches.length === 0) {
                        return;
                    }
                    files.push({
                        uri: result.fileUri,
                        name: new URI(result.fileUri).path.base,
                        hits: result.matches.map(match => ({
                            line: match.line,
                            column: match.character,
                            length: match.length,
                            // Older backends report the line as a plain string,
                            // the current one as a preview object.
                            text: typeof match.lineText === 'string'
                                ? match.lineText
                                : (match.lineText?.text ?? '')
                        }))
                    });
                },
                onDone: () => resolve(files)
            };
            this.searchInWorkspace.searchWithCallback(term, roots, client, options).catch(() => resolve(files));
        });
    }

    /**
     * Notepad++'s "Replace All" on the Find in Files tab replaces every hit of
     * the current search. The backend replaces per search result, so the search
     * is run first and the results tree is asked to replace once they land.
     */
    protected async replaceInFiles(findWidget: { performSearch(): void; hasResultList(): boolean; resultTreeWidget: { replace(preserveFocus?: boolean): void } }): Promise<void> {
        findWidget.performSearch();
        const deadline = Date.now() + 15000;
        while (Date.now() < deadline) {
            if (findWidget.hasResultList()) {
                findWidget.resultTreeWidget.replace(true);
                this.setStatus('Replaced all occurrences in the search results');
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        this.setStatus('No results to replace - run Find All first');
    }

    /**
     * Translate the dialog's Filters and Directory fields into the include
     * globs the backend understands. `undefined` means there is no workspace
     * root to resolve a directory against.
     */
    protected fileSearchGlobs(): string[] | undefined {
        const filters = this.filesFilters.split(',').map(entry => entry.trim()).filter(Boolean);
        const directory = this.filesDirectory.trim();
        if (!directory) {
            return filters;
        }
        const root = this.workspaceService.tryGetRoots()[0]?.resource;
        if (!root) {
            return undefined;
        }
        // Notepad++ treats the directory as a folder to search including its
        // sub-folders; the backend wants a glob, hence the '/**'.
        const base = root.path.toString().replace(/\/+$/, '');
        const target = `${base}/${directory.replace(/^\/+/, '')}`;
        return [`${target}/**`, ...filters];
    }


    // --- mark tab ---------------------------------------------------------

    protected markPage(): void {
        const opts = this.findState.get();
        if (!opts.term) {
            this.setStatus('Enter something to mark');
            return;
        }
        // "Purge for each search" is the only thing that removes the marks left
        // by a previous search; without it the styles accumulate, exactly as
        // they do in Notepad++.
        this.searchMark.markAll({ style: this.markStyle, purge: this.purge });
        const count = this.allMatches().length;
        this.setStatus(`Marked ${count} occurrence${count === 1 ? '' : 's'}`);
    }

    // --- state helpers ----------------------------------------------------

    protected setStatus(status: string): void {
        this.status = status;
        this.update();
    }

    protected pushTermHistory(): void {
        this.termHistory = addHistory(this.termHistory, this.findState.get().term);
        this.storage.setData(HISTORY_KEYS.term, this.termHistory).catch(() => { /* best effort */ });
    }

    protected pushReplaceHistory(): void {
        this.replaceHistory = addHistory(this.replaceHistory, this.findState.get().replace);
        this.storage.setData(HISTORY_KEYS.replace, this.replaceHistory).catch(() => { /* best effort */ });
    }

    protected setOptions(patch: Partial<FindOptions>): void {
        this.findState.set(patch);
        this.update();
    }

    protected setMode(mode: NotepadiaSearchMode): void {
        this.mode = mode;
        this.searchMark.setSearchMode(mode);
        this.setOptions({ mode });
    }

    // --- rendering --------------------------------------------------------

    protected render(): React.ReactNode {
        const opts = this.findState.get();
        return (
            <div
                className="notepadia-find-panel"
                role="dialog"
                aria-label="Find and Replace"
                aria-modal="false"
                onKeyDown={this.handleKeyDown}
            >
                <div className="notepadia-find-titlebar" onMouseDown={this.handleMouseDown}>
                    <div className="notepadia-find-tabs" role="tablist" aria-label="Find dialog tabs">
                        {this.renderTab('find', 'Find')}
                        {this.renderTab('replace', 'Replace')}
                        {this.renderTab('files', 'Find in Files')}
                        {this.renderTab('mark', 'Mark')}
                    </div>
                    <button
                        type="button"
                        className="notepadia-find-close"
                        aria-label="Close"
                        title="Close"
                        onClick={() => this.close()}
                    >
                        ×
                    </button>
                </div>
                <div className="notepadia-find-body">
                    {this.renderTabPanel(opts)}
                </div>
                <div className="notepadia-find-status" aria-live="polite">{this.status}</div>
            </div>
        );
    }

    protected renderTab(tab: NotepadiaFindTab, label: string): React.ReactNode {
        const selected = this.tab === tab;
        return (
            <button
                type="button"
                key={tab}
                role="tab"
                id={`notepadia-find-tab-${tab}`}
                aria-selected={selected}
                aria-controls={`notepadia-find-panel-${tab}`}
                tabIndex={selected ? 0 : -1}
                className={selected ? 'notepadia-find-tab notepadia-find-tab-active' : 'notepadia-find-tab'}
                onClick={() => this.switchTab(tab)}
            >
                {label}
            </button>
        );
    }

    protected switchTab(tab: NotepadiaFindTab): void {
        this.tab = tab;
        this.update();
        this.focusPrimary();
    }

    protected renderTabPanel(opts: FindOptions): React.ReactNode {
        switch (this.tab) {
            case 'replace':
                return this.renderReplacePanel(opts);
            case 'files':
                return this.renderFilesPanel(opts);
            case 'mark':
                return this.renderMarkPanel(opts);
            default:
                return this.renderFindPanel(opts);
        }
    }

    protected renderOptionsSidebar(opts: FindOptions): React.ReactNode {
        return (
            <div className="notepadia-find-options">
                <fieldset className="notepadia-find-fieldset">
                    <legend>Options</legend>
                    <label className="notepadia-find-check">
                        <input
                            type="checkbox"
                            checked={opts.backward}
                            onChange={e => this.setOptions({ backward: e.target.checked })}
                        />
                        Backward direction
                    </label>
                    <label className="notepadia-find-check">
                        <input
                            type="checkbox"
                            checked={opts.wholeWord}
                            onChange={e => this.setOptions({ wholeWord: e.target.checked })}
                        />
                        Match whole word only
                    </label>
                    <label className="notepadia-find-check">
                        <input
                            type="checkbox"
                            checked={opts.caseSensitive}
                            onChange={e => this.setOptions({ caseSensitive: e.target.checked })}
                        />
                        Match case
                    </label>
                    <label className="notepadia-find-check">
                        <input
                            type="checkbox"
                            checked={opts.wrap}
                            onChange={e => this.setOptions({ wrap: e.target.checked })}
                        />
                        Wrap around
                    </label>
                    {this.mode === 'regex' && (
                        <label
                            className="notepadia-find-check notepadia-find-check-disabled"
                            title="The editor's search engine matches within a single line, so a pattern can never span a line break here. Notepad++ supports it; this build does not."
                        >
                            <input
                                type="checkbox"
                                checked={opts.dotMatchesNewline}
                                disabled
                                aria-label=". matches newline (not supported by the editor's search engine)"
                            />
                            . matches newline
                        </label>
                    )}
                    <label className="notepadia-find-check">
                        <input
                            type="checkbox"
                            checked={opts.inSelection}
                            onChange={e => this.setOptions({ inSelection: e.target.checked })}
                        />
                        In selection
                    </label>
                </fieldset>
                <fieldset className="notepadia-find-fieldset">
                    <legend>Search Mode</legend>
                    {this.renderModeRadio('normal', 'Normal')}
                    {this.renderModeRadio('extended', 'Extended (\\n, \\r, \\t, \\0, \\x...)')}
                    {this.renderModeRadio('regex', 'Regular expression')}
                </fieldset>
            </div>
        );
    }

    protected renderModeRadio(mode: NotepadiaSearchMode, label: string): React.ReactNode {
        return (
            <label className="notepadia-find-check">
                <input
                    type="radio"
                    name="notepadia-find-mode"
                    value={mode}
                    checked={this.mode === mode}
                    onChange={() => this.setMode(mode)}
                />
                {label}
            </label>
        );
    }

    protected renderFindPanel(opts: FindOptions): React.ReactNode {
        return (
            <div className="notepadia-find-tabpanel" id="notepadia-find-panel-find" role="tabpanel" aria-labelledby="notepadia-find-tab-find">
                <div className="notepadia-find-columns">
                    <div className="notepadia-find-fields">
                        {this.renderFindWhat(opts)}
                    </div>
                    {this.renderOptionsSidebar(opts)}
                </div>
                {this.renderButtons()}
            </div>
        );
    }

    protected renderReplacePanel(opts: FindOptions): React.ReactNode {
        return (
            <div className="notepadia-find-tabpanel" id="notepadia-find-panel-replace" role="tabpanel" aria-labelledby="notepadia-find-tab-replace">
                <div className="notepadia-find-columns">
                    <div className="notepadia-find-fields">
                        {this.renderFindWhat(opts)}
                        {this.renderTextInput(
                            'notepadia-find-replace',
                            'Replace with',
                            opts.replace,
                            v => this.setOptions({ replace: v })
                        )}
                    </div>
                    {this.renderOptionsSidebar(opts)}
                </div>
                {this.renderButtons()}
            </div>
        );
    }

    protected renderFilesPanel(opts: FindOptions): React.ReactNode {
        return (
            <div className="notepadia-find-tabpanel" id="notepadia-find-panel-files" role="tabpanel" aria-labelledby="notepadia-find-tab-files">
                <div className="notepadia-find-columns">
                    <div className="notepadia-find-fields">
                        {this.renderFindWhat(opts)}
                        {this.renderTextInput('notepadia-find-replace', 'Replace with', opts.replace, v => this.setOptions({ replace: v }), true)}
                        {this.renderTextInput('notepadia-find-filters', 'Filters:', this.filesFilters, v => { this.filesFilters = v; this.update(); })}
                        {this.renderTextInput('notepadia-find-directory', 'Directory:', this.filesDirectory, v => { this.filesDirectory = v; this.update(); })}
                        <label className="notepadia-find-check">
                            <input type="checkbox" checked={this.includeHidden} onChange={e => { this.includeHidden = e.target.checked; this.update(); }} />
                            In hidden folders
                        </label>
                        <label className="notepadia-find-check" title="Directory is always searched including its sub-folders.">
                            <input type="checkbox" checked readOnly disabled aria-label="In all sub-folders (always on)" />
                            In all sub-folders
                        </label>
                    </div>
                    {this.renderOptionsSidebar(opts)}
                </div>
                <div className="notepadia-find-buttons">
                    <button type="button" className="theia-button" onClick={() => this.runFileSearch(false)}>Find All</button>
                    <button type="button" className="theia-button" onClick={() => this.runFileSearch(true)}>Replace All</button>
                </div>
            </div>
        );
    }

    protected renderMarkPanel(opts: FindOptions): React.ReactNode {
        return (
            <div className="notepadia-find-tabpanel" id="notepadia-find-panel-mark" role="tabpanel" aria-labelledby="notepadia-find-tab-mark">
                <div className="notepadia-find-columns">
                    <div className="notepadia-find-fields">
                        {this.renderFindWhat(opts)}
                        <fieldset className="notepadia-find-fieldset">
                            <legend>Marking style</legend>
                            <div className="notepadia-find-styles" role="radiogroup" aria-label="Marking style">
                                {Array.from({ length: MARK_STYLE_COUNT }, (_, i) => this.renderStyleRadio(i))}
                            </div>
                        </fieldset>
                        <label className="notepadia-find-check">
                            <input
                                type="checkbox"
                                checked={this.purge}
                                onChange={e => { this.purge = e.target.checked; this.update(); }}
                            />
                            Purge for each search
                        </label>
                    </div>
                    {this.renderOptionsSidebar(opts)}
                </div>
                <div className="notepadia-find-buttons">
                    <button type="button" className="theia-button" onClick={() => this.markPage()}>Mark All</button>
                    <button type="button" className="theia-button" onClick={() => { this.searchMark.clear(); this.setStatus('Cleared all marks'); }}>Clear All Marks</button>
                    <button type="button" className="theia-button" onClick={() => { this.searchMark.selectFindNext(); this.setStatus('Selected the next occurrence'); }}>Select and Find Next</button>
                </div>
            </div>
        );
    }

    protected renderStyleRadio(index: number): React.ReactNode {
        return (
            <label className={`notepadia-find-style notepadia-mark-${index}`} key={index}>
                <input
                    type="radio"
                    name="notepadia-find-mark-style"
                    value={index}
                    checked={this.markStyle === index}
                    onChange={() => { this.markStyle = index; this.update(); }}
                />
                <span className="notepadia-find-style-label">Style {index + 1}</span>
            </label>
        );
    }

    protected renderFindWhat(opts: FindOptions): React.ReactNode {
        return this.renderCombo(
            'notepadia-find-term',
            'Find what',
            opts.term,
            this.termHistory,
            'notepadia-find-term-history',
            v => this.setOptions({ term: v }),
            true
        );
    }

    protected renderCombo(
        id: string,
        label: string,
        value: string,
        history: string[],
        datalistId: string,
        onChange: (value: string) => void,
        primary: boolean
    ): React.ReactNode {
        return (
            <label className="notepadia-find-field">
                <span>{label}:</span>
                <input
                    id={id}
                    type="text"
                    value={value}
                    list={datalistId}
                    autoComplete="off"
                    aria-label={label}
                    data-notepadia-find-focus={primary ? 'true' : undefined}
                    onChange={e => onChange(e.target.value)}
                    onKeyDown={this.handleFieldKeyDown}
                />
                <datalist id={datalistId}>
                    {history.map(entry => <option key={entry} value={entry} />)}
                </datalist>
            </label>
        );
    }

    protected renderTextInput(
        id: string,
        label: string,
        value: string,
        onChange: (value: string) => void,
        filesOnly = false
    ): React.ReactNode {
        if (filesOnly && this.tab !== 'files') {
            return null;
        }
        return (
            <label className="notepadia-find-field">
                <span>{label}:</span>
                <input
                    id={id}
                    type="text"
                    value={value}
                    autoComplete="off"
                    aria-label={label}
                    onChange={e => onChange(e.target.value)}
                    onKeyDown={this.handleFieldKeyDown}
                />
            </label>
        );
    }

    protected renderButtons(): React.ReactNode {
        if (this.tab === 'replace') {
            return (
                <div className="notepadia-find-buttons">
                    <button type="button" className="theia-button" onClick={() => { this.replaceNext(); this.pushTermHistory(); this.pushReplaceHistory(); }}>Replace</button>
                    <button type="button" className="theia-button" onClick={() => { this.replaceAll(false); this.pushTermHistory(); this.pushReplaceHistory(); }}>Replace All</button>
                    <button type="button" className="theia-button" onClick={() => { this.replaceAll(true); this.pushTermHistory(); this.pushReplaceHistory(); }}>Replace All in All Opened Documents</button>
                    <button type="button" className="theia-button" onClick={() => this.close()}>Close</button>
                </div>
            );
        }
        return (
            <div className="notepadia-find-buttons">
                <button type="button" className="theia-button" onClick={() => { this.findNext(this.findState.get().backward); this.pushTermHistory(); }}>Find Next</button>
                <button type="button" className="theia-button" onClick={() => { this.count(); this.pushTermHistory(); }}>Count</button>
                <button type="button" className="theia-button" onClick={() => { this.findInCurrentDocument(); this.pushTermHistory(); }}>Find All in Current Document</button>
                <button type="button" className="theia-button" onClick={() => { this.findInAllOpenDocuments(); this.pushTermHistory(); }}>Find All in All Opened Documents</button>
                <button type="button" className="theia-button" onClick={() => this.close()}>Close</button>
            </div>
        );
    }

    // --- events -----------------------------------------------------------

    protected handleFieldKeyDown = (event: React.KeyboardEvent<HTMLElement>): void => {
        if (event.shiftKey && event.key === 'Enter') {
            event.preventDefault();
            this.findNext(true);
            this.pushTermHistory();
        } else if (event.key === 'Enter') {
            event.preventDefault();
            if (this.tab === 'files') {
                this.runFileSearch();
            } else {
                this.findNext(this.findState.get().backward);
                this.pushTermHistory();
            }
        }
    };

    protected handleKeyDown = (event: React.KeyboardEvent<HTMLElement>): void => {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            this.close();
        }
    };

    protected findTitlebar(target: EventTarget | null): HTMLElement | null {
        const el = target instanceof HTMLElement ? target : null;
        return el?.closest('.notepadia-find-titlebar') ?? null;
    }

    protected handleMouseDown = (event: React.MouseEvent): void => {
        // Only the titlebar drags the panel; buttons inside it (tabs, close)
        // keep their own click behaviour.
        if (!this.findTitlebar(event.target) || event.button !== 0 || this.drag) {
            return;
        }
        if (event.target instanceof HTMLElement && event.target.closest('button')) {
            return;
        }
        event.preventDefault();
        const rect = this.node.getBoundingClientRect();
        this.drag = {
            pointerId: -1,
            startX: event.clientX,
            startY: event.clientY,
            originLeft: rect.left,
            originTop: rect.top
        };
        window.addEventListener('mousemove', this.handleWindowMouseMove);
        window.addEventListener('mouseup', this.handleWindowMouseUp);
    };

    protected handleWindowMouseMove = (event: MouseEvent): void => {
        if (!this.drag) {
            return;
        }
        const dx = event.clientX - this.drag.startX;
        const dy = event.clientY - this.drag.startY;
        this.node.style.left = `${Math.max(0, this.drag.originLeft + dx)}px`;
        this.node.style.top = `${Math.max(0, this.drag.originTop + dy)}px`;
        this.node.style.right = 'auto';
    };

    protected handleWindowMouseUp = (): void => {
        this.drag = undefined;
        window.removeEventListener('mousemove', this.handleWindowMouseMove);
        window.removeEventListener('mouseup', this.handleWindowMouseUp);
    };
}