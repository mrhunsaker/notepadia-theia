import * as React from '@theia/core/shared/react';
import { inject, injectable } from '@theia/core/shared/inversify';
import { ApplicationShell, ReactWidget } from '@theia/core/lib/browser';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';
import * as monaco from '@theia/monaco-editor-core';
import { Command, CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import { WidgetManager } from '@theia/core/lib/browser/widget-manager';
import { Message } from '@theia/core/shared/@lumino/messaging';
import { resolveSearch } from '../common/find-options';
import { NotepadiaFindState } from './notepadia-find-state';
import { NotepadiaSearchMarkContribution } from './notepadia-search-mark';

/**
 * B4 - Notepad++'s Incremental Search (Ctrl+Alt+I), as a slim bar docked at
 * the bottom of the editor area.
 *
 * The bar owns a single text field plus Next / Previous, a Highlight all
 * checkbox and a Match case checkbox - Notepad++'s exact layout. Searching is
 * Notepad++'s: every keystroke jumps to the next occurrence of the whole term
 * after the caret position captured when the bar opened, wrapping at the end
 * of the document, and a term with no match turns the field red. The match
 * helper factored out in B2 (`resolveSearch` in src/common/find-options.ts) is
 * the one the Find dialog and the Mark engine use, so the three search UIs
 * cannot disagree about the term, the Search Mode radios or Match case.
 */
export namespace NotepadiaIncrementalSearchCommands {
    export const TOGGLE: Command = { id: 'notepadia.incrementalSearch.toggle', label: 'Incremental Search' };
}

/** The input's error red: Notepad++ paints the whole field when nothing matches. */
const STYLE_TEXT = `
.notepadia-incremental-search { display: flex; align-items: center; gap: 6px; padding: 3px 8px; font-size: var(--theia-ui-font-size1); }
.notepadia-incremental-search-label { color: var(--theia-descriptionForeground); flex: none; font-weight: 600; }
.notepadia-incremental-search-term { flex: 0 1 200px; min-width: 120px; }
.notepadia-incremental-search.no-match .notepadia-incremental-search-term {
  background-color: var(--theia-inputValidation-errorBackground, #f48771);
  color: var(--theia-inputValidation-errorForeground, #a1260d);
}
.notepadia-incremental-search-nav { flex: none; min-width: 22px; padding: 1px 6px; }
.notepadia-incremental-search-option { display: flex; align-items: center; gap: 4px; color: var(--theia-descriptionForeground); user-select: none; }
.notepadia-incremental-search-live { min-width: 60px; color: var(--theia-descriptionForeground); font-size: var(--theia-ui-font-size0, 11px); }
.notepadia-incremental-search.no-match .notepadia-incremental-search-live { color: var(--theia-inputValidation-errorForeground, #a1260d); }
.notepadia-incremental-highlight { background-color: var(--theia-editor-findMatchHighlightBackground); }
`;

@injectable()
export class NotepadiaIncrementalSearchWidget extends ReactWidget {

    static readonly ID = 'notepadia.incrementalSearch';

    protected term = '';
    protected highlightAll = false;
    protected matchCase = false;
    protected noMatch = false;
    protected matchCount = 0;

    /** Caret position captured when the bar opened; every keystroke searches from here. */
    protected anchor: monaco.IPosition = { lineNumber: 1, column: 1 };
    protected initialSelection: monaco.Selection | undefined;

    /** True once the user confirms a match (Enter / Shift+Enter / Next / Previous). */
    protected accepted = false;

    protected readonly termRef = React.createRef<HTMLInputElement>();
    protected highlightEntry: { control: monaco.editor.ICodeEditor; collection: monaco.editor.IEditorDecorationsCollection } | undefined;
    protected styleId = '';

    constructor(
        @inject(ApplicationShell) protected readonly shell: ApplicationShell,
        @inject(EditorManager) protected readonly editorManager: EditorManager,
        @inject(NotepadiaFindState) protected readonly findState: NotepadiaFindState,
        @inject(NotepadiaSearchMarkContribution) protected readonly searchMark: NotepadiaSearchMarkContribution
    ) {
        super();
        this.id = NotepadiaIncrementalSearchWidget.ID;
        this.title.label = 'Incremental Search';
        this.title.caption = 'Search document as you type (Ctrl+Alt+I)';
        this.title.closable = true;
        this.title.iconClass = 'codicon codicon-search';
        this.addClass('notepadia-incremental-search');
        this.injectStyle();

        this.toDispose.push(this.editorManager.onCurrentEditorChanged(() => {
            if (this.isVisible) {
                this.beginSession();
            }
        }));
    }

    protected injectStyle(): void {
        this.styleId = 'notepadia-incremental-search-style';
        if (document.getElementById(this.styleId)) {
            return;
        }
        const style = document.createElement('style');
        style.id = this.styleId;
        style.textContent = STYLE_TEXT;
        document.head.appendChild(style);
    }

    // -------------------------------------------------------------- lifecycle

    /**
     * ReactWidget only paints when an update request reaches the widget, and
     * the first one arrives via the shell's (slow) activation cycle rather
     * than the mount. Rendering here puts the bar and its focused term field
     * on screen as soon as the widget lands in the bottom area.
     */
    protected onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        this.update();
    }

    /**
     * Adds the bar to the bottom area on first use and starts a fresh session:
     * the anchor is the current caret, the Match case check follows the shared
     * Find dialog state, and all exploration state is reset.
     */
    async open(): Promise<void> {
        if (!this.isAttached) {
            await this.shell.addWidget(this, { area: 'bottom' });
        }
        this.show();
        await this.shell.activateWidget(this.id);
        this.beginSession();
    }

    protected beginSession(): void {
        const control = this.currentControl();
        const selection = control?.getSelection();
        this.anchor = selection?.getStartPosition() ?? { lineNumber: 1, column: 1 };
        this.initialSelection = selection ? new monaco.Selection(
            selection.selectionStartLineNumber, selection.selectionStartColumn,
            selection.positionLineNumber, selection.positionColumn
        ) : undefined;
        this.accepted = false;
        this.term = '';
        this.highlightAll = false;
        this.matchCase = this.findState.get().caseSensitive;
        this.clearHighlights();
        this.noMatch = false;
        this.matchCount = 0;
        this.update();
        this.focusTerm();
    }

    /**
     * The term field must be focused for the bar to be usable, but it only
     * becomes focusable once the shell has revealed it - the bottom dock takes
     * a moment to become visible and focus on a hidden element is a no-op. Keep
     * requesting focus until it actually sticks so the user can start typing
     * the moment the bar appears.
     */
    protected focusTerm(attempt = 0): void {
        const input = this.termRef.current;
        if (input && input.isConnected) {
            if (document.activeElement === input) {
                return;
            }
            input.focus();
        }
        if (attempt < 200) {
            setTimeout(() => this.focusTerm(attempt + 1), 50);
        }
    }

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        const input = this.termRef.current;
        if (input && input.isConnected) {
            input.focus();
        }
    }

    /**
     * Closes the bar: if the user never accepted a match, the caret returns to
     * its pre-search position (the acceptance criterion); a search that was
     * confirmed keeps the jump. Highlight-all decorations are always dropped,
     * because they belong to the session, and focus returns to the editor.
     */
    requestClose(): void {
        const control = this.currentControl();
        if (!this.accepted && this.initialSelection && control) {
            control.setSelection(this.initialSelection);
            control.revealPositionInCenterIfOutsideViewport(this.initialSelection.getStartPosition());
        }
        this.noMatch = false;
        this.clearHighlights();
        control?.focus();
        this.shell.closeWidget(this.id).catch(() => { });
    }

    // ----------------------------------------------------------------- search

    protected currentControl(): monaco.editor.ICodeEditor | undefined {
        const editor = this.editorManager.currentEditor;
        return editor ? MonacoEditor.get(editor)?.getControl() : undefined;
    }

    /** The resolved term honours the shared B2 search mode (normal/extended/regex). */
    protected resolved(term: string): { term: string; isRegex: boolean } {
        return resolveSearch(term, this.searchMark.searchMode());
    }

    protected allMatches(control: monaco.editor.ICodeEditor, model: monaco.editor.ITextModel, term: string): monaco.editor.FindMatch[] {
        const { term: pattern, isRegex } = this.resolved(term);
        return model.findMatches(pattern, true, isRegex, this.matchCase, null, false, 10000);
    }

    /** Look up the next/previous occurrence after a position, wrapping. */
    protected findOne(control: monaco.editor.ICodeEditor, model: monaco.editor.ITextModel, backward: boolean, from: monaco.IPosition): monaco.editor.FindMatch | null {
        const { term, isRegex } = this.resolved(this.term);
        if (!term) {
            return null;
        }
        const probe = backward
            ? model.findPreviousMatch(term, from, isRegex, this.matchCase, null, false)
            : model.findNextMatch(term, from, isRegex, this.matchCase, null, false);
        return probe ?? (backward
            ? model.findPreviousMatch(term, { lineNumber: model.getLineCount() + 1, column: 1 }, isRegex, this.matchCase, null, false)
            : model.findNextMatch(term, { lineNumber: 1, column: 1 }, isRegex, this.matchCase, null, false));
    }

    protected applyMatch(control: monaco.editor.ICodeEditor, match: monaco.editor.FindMatch): void {
        control.setSelection(new monaco.Selection(
            match.range.startLineNumber, match.range.startColumn,
            match.range.endLineNumber, match.range.endColumn
        ));
        control.revealRangeInCenterIfOutsideViewport(match.range);
        this.noMatch = false;
    }

    /**
     * Live search - Notepad++'s core behaviour. Each keystroke re-searches from
     * the anchor captured when the bar opened (or the last explicit step, so
     * Enter continues from where the previous match ended), wrapping. An empty
     * term parks the caret back at the anchor, clears any count and drops the
     * red state; the monaco decorations for Highlight all follow immediately.
     */
    protected runSearch(): void {
        const control = this.currentControl();
        const model = control?.getModel();
        if (!control || !model) {
            this.noMatch = false;
            this.matchCount = 0;
            return;
        }
        if (!this.term) {
            control.setSelection({ startLineNumber: this.anchor.lineNumber, startColumn: this.anchor.column,
                endLineNumber: this.anchor.lineNumber, endColumn: this.anchor.column });
            this.noMatch = false;
            this.matchCount = 0;
            this.refreshHighlights(control, model);
            return;
        }
        const match = this.findOne(control, model, false, this.anchor);
        if (match) {
            this.applyMatch(control, match);
        } else {
            this.noMatch = true;
        }
        this.matchCount = this.allMatches(control, model, this.term).length;
        this.refreshHighlights(control, model);
        this.update();
    }

    /** Next / Previous (and Enter / Shift+Enter): step by one occurrence, wrapping. */
    protected step(backward: boolean): void {
        const control = this.currentControl();
        const model = control?.getModel();
        if (!control || !model || !this.term) {
            return;
        }
        const selection = control.getSelection();
        const currentStart = selection?.getStartPosition() ?? this.anchor;
        const from = backward
            ? currentStart
            : selection?.getEndPosition() ?? this.anchor;
        const match = this.findOne(control, model, backward, from);
        if (match) {
            this.applyMatch(control, match);
        } else {
            this.noMatch = true;
        }
        this.matchCount = this.allMatches(control, model, this.term).length;
        this.accepted = true;
        this.refreshHighlights(control, model);
        this.update();
    }

    // ------------------------------------------------------ highlight all

    protected refreshHighlights(control: monaco.editor.ICodeEditor, model: monaco.editor.ITextModel): void {
        if (!this.highlightAll || !this.term) {
            this.highlightEntry?.collection.set([]);
            return;
        }
        const decorations = this.allMatches(control, model, this.term).map(match => ({
            range: match.range,
            options: { inlineClassName: 'notepadia-incremental-highlight' }
        }));
        let entry = this.highlightEntry;
        if (!entry || entry.control !== control || entry.control.getModel() !== model) {
            entry = { control, collection: control.createDecorationsCollection([]) };
            this.highlightEntry = entry;
        }
        entry.collection.set(decorations);
    }

    protected clearHighlights(): void {
        this.highlightEntry?.collection.set([]);
        this.highlightEntry = undefined;
    }

    // ----------------------------------------------------------------- input

    protected setTerm(value: string): void {
        this.term = value;
        if (value !== '') {
            this.findState.set({ term: value, caseSensitive: this.matchCase });
        }
        this.runSearch();
        this.update();
    }

    protected onContainerKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
        // Escape dismisses the bar wherever focus sits inside it (the field, a
        // checkbox or a nav button); it must not slide on to the shell, which
        // would close some other panel or menu underneath.
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            this.requestClose();
            return;
        }
        // Enter / Shift+Enter step by one occurrence from the term field; the
        // nav buttons handle their own activation with a real click.
        if (event.key === 'Enter' && event.target === this.termRef.current) {
            event.preventDefault();
            event.stopPropagation();
            this.step(event.shiftKey);
        }
    }

    protected onMatchCaseChange(event: React.ChangeEvent<HTMLInputElement>): void {
        this.matchCase = event.target.checked;
        this.findState.set({ caseSensitive: this.matchCase });
        this.runSearch();
        this.update();
    }

    protected onHighlightAllChange(event: React.ChangeEvent<HTMLInputElement>): void {
        this.highlightAll = event.target.checked;
        const control = this.currentControl();
        const model = control?.getModel();
        if (control && model) {
            this.refreshHighlights(control, model);
        }
        this.update();
    }

    // ----------------------------------------------------------------- render

    protected get liveText(): string {
        if (!this.term) {
            return '';
        }
        return this.noMatch
            ? 'no match'
            : `${this.matchCount} ${this.matchCount === 1 ? 'match' : 'matches'}`;
    }

    protected render(): React.ReactNode {
        const containerClass = 'notepadia-incremental-search' + (this.noMatch ? ' no-match' : '');
        return (
            <div className={containerClass} onKeyDown={event => this.onContainerKeyDown(event)}>
                <label className="notepadia-incremental-search-label" htmlFor="notepadia-incremental-term">
                    Incremental Search
                </label>
                <input
                    id="notepadia-incremental-term"
                    ref={this.termRef}
                    className="theia-input notepadia-incremental-search-term"
                    type="text"
                    value={this.term}
                    autoComplete="off"
                    spellCheck={false}
                    aria-label="Incremental search term"
                    onChange={event => this.setTerm(event.target.value)}
                />
                <button
                    type="button"
                    className="theia-button notepadia-incremental-search-nav"
                    aria-label="Previous match"
                    title="Previous match (Shift+Enter)"
                    disabled={!this.term}
                    onClick={() => this.step(true)}
                >
                    ▲
                </button>
                <button
                    type="button"
                    className="theia-button notepadia-incremental-search-nav"
                    aria-label="Next match"
                    title="Next match (Enter)"
                    disabled={!this.term}
                    onClick={() => this.step(false)}
                >
                    ▼
                </button>
                <label className="notepadia-incremental-search-option">
                    <input type="checkbox" checked={this.highlightAll} onChange={event => this.onHighlightAllChange(event)} />
                    Highlight all
                </label>
                <label className="notepadia-incremental-search-option">
                    <input type="checkbox" checked={this.matchCase} onChange={event => this.onMatchCaseChange(event)} />
                    Match case
                </label>
                {/* Match state is announced through the polite region so a
                    screen reader hears "no match" instead of only seeing the
                    red field. */}
                <div className="notepadia-incremental-search-live" role="status" aria-live="polite">{this.liveText}</div>
            </div>
        );
    }
}

/**
 * B4 - the command behind Ctrl+Alt+I / Search > Incremental Search. The bar is
 * created on demand by the WidgetFactory and lives in the shell's bottom area;
 * a second Ctrl+Alt+I (or the menu entry) dismisses it again.
 */
@injectable()
export class NotepadiaIncrementalSearchContribution implements CommandContribution {

    constructor(@inject(WidgetManager) protected readonly widgetManager: WidgetManager) { }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(NotepadiaIncrementalSearchCommands.TOGGLE, {
            isToggled: () => this.isVisible(),
            execute: () => this.toggle()
        });
    }

    protected async widget(): Promise<NotepadiaIncrementalSearchWidget | undefined> {
        const widget = await this.widgetManager.getOrCreateWidget(NotepadiaIncrementalSearchWidget.ID);
        return widget instanceof NotepadiaIncrementalSearchWidget ? widget : undefined;
    }

    protected isVisible(): boolean {
        const widget = this.widgetManager.tryGetWidget(NotepadiaIncrementalSearchWidget.ID);
        return !!widget && widget.isVisible;
    }

    protected async toggle(): Promise<void> {
        const widget = await this.widget();
        if (!widget) {
            return;
        }
        if (widget.isVisible) {
            widget.requestClose();
        } else {
            await widget.open();
        }
    }
}