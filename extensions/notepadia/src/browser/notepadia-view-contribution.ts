import { inject, injectable } from '@theia/core/shared/inversify';
import * as monaco from '@theia/monaco-editor-core';
import { Command, CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import { MenuContribution, MenuModelRegistry } from '@theia/core/lib/common/menu';
import { CommonMenus } from '@theia/core/lib/browser/common-menus';
import {
    ApplicationShell,
    FrontendApplication,
    FrontendApplicationContribution
} from '@theia/core/lib/browser';
import { AbstractDialog } from '@theia/core/lib/browser/dialogs';
import { Message } from '@theia/core/lib/browser/widgets';
import { DisposableCollection } from '@theia/core/lib/common/disposable';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import { EditorWidget } from '@theia/editor/lib/browser/editor-widget';
import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';
import { PreferenceService } from '@theia/core/lib/common/preferences';
import { RecursivePartial } from '@theia/core/lib/common/types';
import { Range } from 'vscode-languageserver-types';
import { Widget } from '@lumino/widgets';
import { documentStats, summaryAsStatusFields, summaryRows, DocumentStats } from '../common/document-stats';

/**
 * Notepad++'s `View` menu gaps (C3): Show Symbol, folding, the two-pane split,
 * Full Screen, Post-It and Summary.
 */

export const NOTEPADIA_SHOW_SPACE_AND_TAB_PREFERENCE = 'notepadia.view.showSpaceAndTab';
export const NOTEPADIA_SHOW_END_OF_LINE_PREFERENCE = 'notepadia.view.showEndOfLine';
export const NOTEPADIA_SHOW_INDENT_GUIDE_PREFERENCE = 'notepadia.view.showIndentGuide';

/**
 * Post-It mode.
 *
 * Declared here rather than in notepadia-preference-contribution.ts because
 * that module already imports the Show Symbol preferences from this one; defining
 * the constant there too would make the two modules import each other in a
 * cycle, and a cycle between two modules that both run at container setup can
 * leave one of them seeing a partially-initialized namespace.
 */
export const NOTEPADIA_POSTIT_PREFERENCE = 'notepadia.view.postIt';

/** Body class driving the Post-It / Distraction Free stylesheet. */
export const NOTEPADIA_POSTIT_CLASS = 'notepadia-postit';

/**
 * Notepad++ offers Fold Level 8; Monaco registers folding actions for levels
 * 1-7 only (`for (let i = 1; i <= 7; i++)` in folding.js), so level 8 is left
 * off the menu rather than mapped to something that would not fold level 8.
 */
export const MAX_MONACO_FOLD_LEVEL = 7;

/** The Monaco action id for a 1-based fold level, e.g. `editor.foldLevel3`. */
export function foldLevelCommandId(level: number): string {
    return `editor.foldLevel${level}`;
}

/** How many times to look again for a control that is not there yet. */
const MAX_WIRING_ATTEMPTS = 50;

/**
 * Monaco preferences the Show Symbol entries drive.
 *
 * Both are declared by Theia's generated editor preference schema, which is
 * what makes them safe to write from here.
 */
export const MONACO_RENDER_WHITESPACE_PREFERENCE = 'editor.renderWhitespace';
export const MONACO_INDENT_GUIDE_PREFERENCE = 'editor.guides.indentation';

/**
 * Monaco draws whitespace through `experimentalWhitespaceRendering`, whose
 * default is `svg` - markers land in an SVG overlay rather than as elements.
 * `font` is what paints `renderWhitespace` markers as `.mwh` divs, so it is
 * pinned alongside Show Space and TAB.
 */
export const MONACO_WHITESPACE_RENDERING_PREFERENCE = 'editor.experimentalWhitespaceRendering';

export namespace NotepadiaViewCommands {
    export const SHOW_SPACE_AND_TAB: Command = {
        id: 'notepadia.view.showSpaceAndTab',
        label: 'Show Space and TAB'
    };
    export const SHOW_END_OF_LINE: Command = {
        id: 'notepadia.view.showEndOfLine',
        label: 'Show End of Line'
    };
    export const SHOW_ALL_CHARACTERS: Command = {
        id: 'notepadia.view.showAllCharacters',
        label: 'Show All Characters'
    };
    export const SHOW_INDENT_GUIDE: Command = {
        id: 'notepadia.view.showIndentGuide',
        label: 'Show Indent Guide'
    };
    export const FOLD_ALL: Command = {
        id: 'notepadia.view.foldAll',
        label: 'Fold All'
    };
    export const UNFOLD_ALL: Command = {
        id: 'notepadia.view.unfoldAll',
        label: 'Unfold All'
    };
    export const CLONE_TO_OTHER_VIEW: Command = {
        id: 'notepadia.view.cloneToOtherView',
        label: 'Clone to Other View'
    };
    export const MOVE_TO_OTHER_VIEW: Command = {
        id: 'notepadia.view.moveToOtherView',
        label: 'Move to Other View'
    };
    export const FULL_SCREEN: Command = {
        id: 'notepadia.view.fullScreen',
        label: 'Full Screen'
    };
    export const POST_IT: Command = {
        id: 'notepadia.view.postIt',
        label: 'Post-It'
    };
    export const SUMMARY: Command = {
        id: 'notepadia.view.summary',
        label: 'Summary...'
    };
}

/**
 * `View > Summary...`. The counting rules live in common/document-stats.ts so
 * they are unit tested; this only lays the figures out, and shows them with the
 * status bar's own wording so the same document never reports two different
 * numbers in two places.
 */
class NotepadiaSummaryDialog extends AbstractDialog<undefined> {

    constructor(protected readonly stats: DocumentStats) {
        super({ title: 'Summary' });
        // The button has to exist before `onAfterAttach` runs: that is where
        // `AbstractDialog` looks for `this.closeButton` and binds the click that
        // closes the dialog. Appending it afterwards, as the content is, leaves
        // a Close button that does nothing.
        this.appendCloseButton('Close');
    }

    /** Summary is read-only, so there is no result to return. */
    get value(): undefined {
        return undefined;
    }

    protected onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        const wrapper = document.createElement('div');
        wrapper.className = 'notepadia-summary';

        for (const row of summaryRows(this.stats)) {
            wrapper.appendChild(NotepadiaSummaryDialog.row(row.label, row.value));
        }
        const fields = summaryAsStatusFields(this.stats);
        wrapper.appendChild(NotepadiaSummaryDialog.row('Document', fields.length));
        wrapper.appendChild(NotepadiaSummaryDialog.row('Selection', fields.selection));
        this.contentNode.appendChild(wrapper);
    }

    protected static row(label: string, value: string): HTMLElement {
        const row = document.createElement('div');
        row.className = 'notepadia-summary-row';

        const name = document.createElement('span');
        name.className = 'notepadia-summary-label';
        name.textContent = label;

        const text = document.createElement('span');
        text.className = 'notepadia-summary-value';
        text.textContent = value;

        row.appendChild(name);
        row.appendChild(text);
        return row;
    }
}

/**
 * A Monaco selection as the range `EditorOpenerOptions` expects.
 *
 * The cast is needed because the option is typed `RecursivePartial<Range>`
 * while the value is a Monaco `Selection`, whose positions are getters rather
 * than plain fields. Only the start and end are meaningful to the opener -
 * `Selection`'s extra anchors are not part of the target type.
 */
function toRange(selection: monaco.Selection | null): RecursivePartial<Range> | undefined {
    if (!selection) {
        return undefined;
    }
    const start = selection.getStartPosition();
    const end = selection.getEndPosition();
    // The option is typed in LSP terms: 0-based line and character.
    return {
        start: { line: start.lineNumber - 1, character: start.column - 1 },
        end: { line: end.lineNumber - 1, character: end.column - 1 }
    };
}

/** The editor in the pane the user is in, with its widget and Monaco control. */
interface FocusedEditor {
    widget: EditorWidget;
    editor: MonacoEditor;
    control: monaco.editor.IStandaloneCodeEditor;
}

@injectable()
export class NotepadiaViewContribution implements
    CommandContribution, MenuContribution, FrontendApplicationContribution {

    protected readonly toDispose = new DisposableCollection();

    /**
     * End-of-line decoration ids per control, so a toggle-off clears only ours.
     *
     * A WeakMap because a closed tab's control must not be kept alive by this
     * bookkeeping; ids are only ever read for a control that is still open.
     */
    protected readonly eolDecorations = new WeakMap<monaco.editor.IStandaloneCodeEditor, string[]>();

    /** Per-control line-count watcher keeping the markers in step with edits. */
    protected readonly eolWatchers = new Map<monaco.editor.IStandaloneCodeEditor, { lineCount: number; dispose(): void }>();

    /**
     * Editor widgets already wired up, so the Show Symbol settings are applied
     * to each pane exactly once.
     */
    protected readonly wiredWidgets = new Set<EditorWidget>();

    /**
     * Look-again counters, keyed by widget.
     *
     * A widget is only retried while it is an editor that has not built its
     * control yet, and only up to the cap, so a widget that never attaches
     * cannot spin.
     */
    protected readonly wiringAttempts = new Map<EditorWidget, number>();

    constructor(
        @inject(ApplicationShell) protected readonly shell: ApplicationShell,
        @inject(EditorManager) protected readonly editorManager: EditorManager,
        @inject(PreferenceService) protected readonly preferenceService: PreferenceService
    ) { }

    onStart(_app: FrontendApplication): void {
        this.toDispose.push(this.preferenceService.onPreferenceChanged(event => {
            if (event.preferenceName === NOTEPADIA_SHOW_SPACE_AND_TAB_PREFERENCE
                || event.preferenceName === NOTEPADIA_SHOW_INDENT_GUIDE_PREFERENCE) {
                this.applyToOpenEditors();
            }
            if (event.preferenceName === NOTEPADIA_SHOW_END_OF_LINE_PREFERENCE) {
                this.applyEndOfLineToOpenEditors();
            }
            // Post-It is a body class, so it only has to be re-evaluated - but
            // it has to be, or changing it in Settings would leave the window
            // chrome alone until the next reload.
            if (event.preferenceName === NOTEPADIA_POSTIT_PREFERENCE) {
                this.applyBodyClasses();
            }
        }));

        // Every editor widget gets the settings as it appears, and a closed tab
        // is forgotten again.
        this.wireUpEditorWidgets(this.shell.widgets);
        this.shell.onDidAddWidget(widget => this.wireUpEditorWidgets([widget]));
        this.shell.onDidRemoveWidget(widget => this.forgetWidget(widget as EditorWidget));

        this.applyBodyClasses();
    }

    /**
     * Hook the end-of-line marker onto each of these widgets.
     *
     * Timing is the whole problem. The shell adds a widget *before* Lumino
     * attaches it, and Theia only builds the Monaco control while attaching,
     * so `MonacoEditor.get` answers `undefined` at `onDidAddWidget` time and a
     * plain sweep of `shell.widgets` finds nothing. An editor that has not
     * built its control yet is therefore looked at again on the next tick.
     *
     * Re-opening a file reuses the widget that is already there, so no second
     * `onDidAddWidget` is coming; the model-change listener below covers that,
     * and is also what puts the marker on a brand new tab in the same pane.
     *
     * Only the marker needs any of this. The space/tab and indent-guide
     * settings ride on Monaco preferences, which Theia applies to every editor
     * by itself.
     */
    protected wireUpEditorWidgets(widgets: readonly Widget[]): void {
        for (const widget of widgets) {
            // `instanceof EditorWidget` is what keeps the retry below bounded:
            // a side bar panel or a status bar is never going to grow a Monaco
            // control, so it is not something worth looking at again.
            if (!(widget instanceof EditorWidget) || this.wiredWidgets.has(widget)) {
                continue;
            }
            if (!MonacoEditor.get(widget)) {
                this.scheduleWiring(widget);
                continue;
            }
            this.wiredWidgets.add(widget);
            this.wiringAttempts.delete(widget);
            this.wireUpAttachedWidget(widget);
        }
    }

    /** Try again on the next tick, unless the widget has been given up on. */
    protected scheduleWiring(widget: EditorWidget): void {
        const attempts = (this.wiringAttempts.get(widget) ?? 0) + 1;
        if (attempts > MAX_WIRING_ATTEMPTS) {
            this.wiringAttempts.delete(widget);
            return;
        }
        this.wiringAttempts.set(widget, attempts);
        setTimeout(() => this.wireUpEditorWidgets([widget]), 0);
    }

    /** Apply the settings to one attached editor, now and on every model swap. */
    protected wireUpAttachedWidget(widget: EditorWidget): void {
        const editor = MonacoEditor.get(widget);
        if (!editor) {
            return;
        }
        const control = editor.getControl();
        this.applyEndOfLineToControl(control);
        const listener = control.onDidChangeModel(() => {
            // Ids from the previous model mean nothing to the new one, so the
            // old markers and their line-count watcher are dropped first.
            this.forgetControl(control);
            this.applyEndOfLineToControl(control);
        });
        this.toDispose.push(listener);
    }

    /**
     * Which editor a command should act on.
     *
     * The pane containing the focused element, not `EditorManager.currentEditor`:
     * during a split those are different widgets, and Clone/Move has to follow
     * the pane the click came from rather than whichever pane was last raised.
     */
    protected focusedEditor(): FocusedEditor | undefined {
        const active = document.activeElement;
        if (active) {
            for (const widget of this.openEditorWidgets()) {
                if (!widget.node.contains(active)) {
                    continue;
                }
                const editor = MonacoEditor.get(widget);
                if (editor) {
                    return { widget, editor, control: editor.getControl() };
                }
            }
        }
        const current = this.editorManager.currentEditor;
        if (current) {
            const editor = MonacoEditor.get(current);
            if (editor) {
                return { widget: current, editor, control: editor.getControl() };
            }
        }
        return undefined;
    }

    /**
     * Editor widgets currently on screen, across every pane.
     *
     * `shell.widgets` is typed as `Widget[]` while `MonacoEditor.get` wants the
     * narrower `EditorWidget`; the cast is safe because `get` only reads
     * `.editor` off the argument.
     */
    protected openEditorWidgets(): EditorWidget[] {
        const panes: EditorWidget[] = [];
        for (const widget of this.shell.widgets) {
            if (MonacoEditor.get(widget as EditorWidget)) {
                panes.push(widget as EditorWidget);
            }
        }
        return panes;
    }

    /** Every editor's Monaco control currently on screen. */
    protected openControls(): monaco.editor.IStandaloneCodeEditor[] {
        return this.openEditorWidgets()
            .map(widget => MonacoEditor.get(widget))
            .filter((editor): editor is MonacoEditor => !!editor)
            .map(editor => editor.getControl());
    }

    /**
     * Push the Show Symbol preferences onto Monaco's own editor preferences.
     *
     * These two are written as *preferences* rather than with
     * `control.updateOptions`, and that is not a stylistic choice. Theia's
     * product configuration pins `editor.renderWhitespace` to `'none'` (the
     * Notepad++ default from an earlier task), and Theia re-applies its editor
     * preferences whenever an editor's model is set. An `updateOptions` call
     * made just before that is simply overwritten a moment later, which left
     * Show Space and TAB looking switched on while drawing nothing. Going
     * through the preference service is also what makes the setting survive a
     * new tab, a second pane and a reload without any bookkeeping here.
     */
    protected applyToOpenEditors(): void {
        this.setEditorPreference(MONACO_WHITESPACE_RENDERING_PREFERENCE, 'font');
        this.setEditorPreference(MONACO_RENDER_WHITESPACE_PREFERENCE, this.showSpaceAndTab() ? 'all' : 'none');
        this.setEditorPreference(MONACO_INDENT_GUIDE_PREFERENCE, this.preferenceService.get<boolean>(NOTEPADIA_SHOW_INDENT_GUIDE_PREFERENCE, true));
    }

    /** Write an editor preference, but only when it would actually change. */
    protected setEditorPreference(name: string, value: unknown): void {
        if (this.preferenceService.get(name) === value) {
            return;
        }
        this.preferenceService.set(name, value).catch(() => { });
    }

    protected showSpaceAndTab(): boolean {
        return this.preferenceService.get<boolean>(NOTEPADIA_SHOW_SPACE_AND_TAB_PREFERENCE, false);
    }

    protected showEndOfLine(): boolean {
        return this.preferenceService.get<boolean>(NOTEPADIA_SHOW_END_OF_LINE_PREFERENCE, false);
    }

    protected postIt(): boolean {
        return document.body.classList.contains(NOTEPADIA_POSTIT_CLASS);
    }

    /**
     * Body classes for the parts of the View menu that are CSS, not Monaco:
     * the end-of-line glyph and Post-It mode.
     */
    protected applyBodyClasses(): void {
        document.body.classList.toggle(NOTEPADIA_POSTIT_CLASS, this.postItEnabled());
    }

    protected postItEnabled(): boolean {
        return this.preferenceService.get<boolean>(NOTEPADIA_POSTIT_PREFERENCE, false);
    }

    /**
     * `View > Show Symbol > Show End of Line`.
     *
     * Monaco draws no end-of-line glyph of its own, so one is added as a
     * decoration on the last column of every line, which is what Notepad++
     * draws. Only whole lines are marked: a range ending mid-line would put the
     * marker in the middle of the text rather than at the end of the line.
     *
     * Decoration ids are tracked per control so turning the setting off clears
     * exactly the markers this added and nothing else.
     */
    protected applyEndOfLineToOpenEditors(): void {
        for (const control of this.openControls()) {
            this.applyEndOfLineToControl(control);
        }
    }

    protected applyEndOfLineToControl(control: monaco.editor.IStandaloneCodeEditor): void {
        this.updateEndOfLine(control, this.showEndOfLine());
    }

    /**
     * Apply or clear the markers on one control.
     *
     * Decoration ids are remembered per control so that turning the setting off
     * clears exactly the markers this added, leaving search hits, bookmarks and
     * anything else Theia decorates untouched.
     */
    protected updateEndOfLine(control: monaco.editor.IStandaloneCodeEditor, show: boolean): void {
        const previous = this.eolDecorations.get(control);
        if (!show) {
            if (previous) {
                control.deltaDecorations(previous, []);
                this.eolDecorations.delete(control);
            }
            return;
        }
        const model = control.getModel();
        if (!model) {
            return;
        }
        this.eolDecorations.set(control, control.deltaDecorations(previous ?? [], this.buildEndOfLineDecorations(model)));
        this.watchLineCount(control, model);
    }

    /**
     * One marker per line, at the last column.
     *
     * Only whole lines are marked: a range ending mid-line would put the marker
     * in the middle of the text rather than at the end of the line.
     */
    protected buildEndOfLineDecorations(model: monaco.editor.ITextModel): monaco.editor.IModelDeltaDecoration[] {
        const decorations: monaco.editor.IModelDeltaDecoration[] = [];
        const lineCount = model.getLineCount();
        for (let line = 1; line <= lineCount; line++) {
            const maxColumn = model.getLineMaxColumn(line);
            decorations.push({
                range: new monaco.Range(line, maxColumn, line, maxColumn),
                options: {
                    afterContentClassName: 'notepadia-eol-glyph',
                    stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
                }
            });
        }
        return decorations;
    }

    /**
     * Keep the markers matching the document as it is edited.
     *
     * A marker exists per line, so adding or removing a line has to add or
     * remove markers too. This watches the model but rebuilds only when the line
     * *count* actually changed: typing inside a line already leaves the marker on
     * that line's end (which is what `NeverGrowsWhenTypingAtEdges` is for), and
     * re-decorating a long document on every keystroke would be ruinous -
     * `buildEndOfLineDecorations` allocates one decoration per line, so on a
     * 50k-line file that is 50k objects per character typed.
     */
    protected watchLineCount(control: monaco.editor.IStandaloneCodeEditor, model: monaco.editor.ITextModel): void {
        const existing = this.eolWatchers.get(control);
        if (existing) {
            existing.lineCount = model.getLineCount();
            return;
        }
        const state: { lineCount: number; dispose(): void } = {
            lineCount: model.getLineCount(),
            dispose: () => { }
        };
        const listener = model.onDidChangeContent(() => {
            const lineCount = model.getLineCount();
            if (lineCount === state.lineCount) {
                return;
            }
            state.lineCount = lineCount;
            if (this.showEndOfLine()) {
                this.updateEndOfLine(control, true);
            }
        });
        this.eolWatchers.set(control, { lineCount: state.lineCount, dispose: () => listener.dispose() });
    }

    /** Drop the bookkeeping for a control that is going away. */
    protected forgetControl(control: monaco.editor.IStandaloneCodeEditor): void {
        this.eolWatchers.get(control)?.dispose();
        this.eolWatchers.delete(control);
        this.eolDecorations.delete(control);
    }

    /**
     * A closed tab must not stay wired: if the shell hands the same widget
     * back later it has to be hooked again from scratch.
     */
    protected forgetWidget(widget: EditorWidget): void {
        const editor = MonacoEditor.get(widget);
        if (editor) {
            this.forgetControl(editor.getControl());
        }
        this.wiredWidgets.delete(widget);
        this.wiringAttempts.delete(widget);
    }

    /**
     * Notepad++'s F11 enters full screen; the browser also owns F11, so the
     * browser will answer the key first. Mirroring `fullscreenchange` onto the
     * menu's check state keeps the menu honest whichever of the two the user
     * used - including Esc, which leaves full screen without going through us.
     */
    /**
     * The Full Screen menu entry's check mark.
     *
     * Read from `document.fullscreenElement` on every menu build, never cached
     * from the last click: full screen can be left without going through this
     * contribution - Esc, or the browser's own F11 - and a stale check mark
     * would leave the menu claiming the wrong state. Nothing is needed on the
     * `fullscreenchange` event itself; the next time the menu opens it already
     * reads the truth.
     */

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(NotepadiaViewCommands.SHOW_SPACE_AND_TAB, {
            isEnabled: () => !!this.focusedEditor(),
            isToggled: () => this.showSpaceAndTab(),
            execute: () => this.togglePreference(NOTEPADIA_SHOW_SPACE_AND_TAB_PREFERENCE, true)
        });
        commands.registerCommand(NotepadiaViewCommands.SHOW_END_OF_LINE, {
            isEnabled: () => !!this.focusedEditor(),
            isToggled: () => this.showEndOfLine(),
            execute: () => this.togglePreference(NOTEPADIA_SHOW_END_OF_LINE_PREFERENCE, false)
        });
        // Notepad++'s "Show All Characters" is the umbrella switch: checking it
        // turns on the space/tab and end-of-line markers together, which is what
        // the original's single checkbox does.
        commands.registerCommand(NotepadiaViewCommands.SHOW_ALL_CHARACTERS, {
            isEnabled: () => !!this.focusedEditor(),
            isToggled: () => this.showSpaceAndTab() && this.showEndOfLine(),
            execute: () => {
                const on = !(this.showSpaceAndTab() && this.showEndOfLine());
                this.preferenceService.set(NOTEPADIA_SHOW_SPACE_AND_TAB_PREFERENCE, on).catch(() => { });
                this.preferenceService.set(NOTEPADIA_SHOW_END_OF_LINE_PREFERENCE, on).catch(() => { });
            }
        });
        commands.registerCommand(NotepadiaViewCommands.SHOW_INDENT_GUIDE, {
            isEnabled: () => !!this.focusedEditor(),
            isToggled: () => this.preferenceService.get<boolean>(NOTEPADIA_SHOW_INDENT_GUIDE_PREFERENCE, true),
            execute: () => this.togglePreference(NOTEPADIA_SHOW_INDENT_GUIDE_PREFERENCE, true)
        });

        // Monaco's folding actions. `control.trigger` runs them against the
        // focused pane; registering the ids here is what puts them on the menu
        // and in the shortcut editor, which Monaco's own registry does not do.
        commands.registerCommand(NotepadiaViewCommands.FOLD_ALL, {
            isEnabled: () => !!this.focusedEditor(),
            execute: () => this.triggerMonacoAction('editor.foldAll')
        });
        commands.registerCommand(NotepadiaViewCommands.UNFOLD_ALL, {
            isEnabled: () => !!this.focusedEditor(),
            execute: () => this.triggerMonacoAction('editor.unfoldAll')
        });
        // Monaco's own `editor.foldLevel1`..`7` commands are deliberately *not*
        // re-registered: Monaco already owns those ids, and registering them
        // again only earns a "command is already registered" warning per level.
        // The menu and the shortcuts point straight at Monaco's ids instead.

        // Notepad++ has exactly two views. Clone creates the second pane, so it
        // is only available while there is one; Move is only available once
        // there are two. That is what keeps the user out of a grid.
        commands.registerCommand(NotepadiaViewCommands.CLONE_TO_OTHER_VIEW, {
            isEnabled: () => !!this.focusedEditor() && this.splitPaneCount() < 2,
            execute: () => this.cloneToOtherView()
        });
        commands.registerCommand(NotepadiaViewCommands.MOVE_TO_OTHER_VIEW, {
            isEnabled: () => this.splitPaneCount() === 2,
            execute: () => this.moveToOtherView()
        });

        commands.registerCommand(NotepadiaViewCommands.FULL_SCREEN, {
            isEnabled: () => !!document.fullscreenEnabled,
            isToggled: () => !!document.fullscreenElement,
            execute: () => this.toggleFullScreen()
        });
        commands.registerCommand(NotepadiaViewCommands.POST_IT, {
            isEnabled: () => !!this.focusedEditor(),
            isToggled: () => this.postIt(),
            execute: () => {
                const next = !this.postIt();
                // A preference, not just a class flip: Post-It is a view mode
                // the user expects to still be on after a reload.
                this.preferenceService.set(NOTEPADIA_POSTIT_PREFERENCE, next).catch(() => { });
                document.body.classList.toggle(NOTEPADIA_POSTIT_CLASS, next);
            }
        });

        commands.registerCommand(NotepadiaViewCommands.SUMMARY, {
            isEnabled: () => !!this.focusedEditor(),
            execute: () => this.openSummary()
        });
    }

    protected togglePreference(name: string, fallback: boolean): void {
        const value = this.preferenceService.get<boolean>(name, fallback);
        this.preferenceService.set(name, !value).catch(() => { });
    }

    protected triggerMonacoAction(actionId: string): void {
        this.focusedEditor()?.control.trigger('notepadia', actionId, undefined);
    }

    /**
     * Editor widgets whose editor is on screen right now, one per pane.
     *
     * `openEditorWidgets()` lists every editor the shell knows about, which
     * includes the tabs stacked behind the current one. A tab is not a pane, so
     * anything that reasons about the split layout has to filter those out.
     *
     * `Widget.isVisible` is Lumino's `Flag.IsVisible`, which is cleared whenever
     * a widget is hidden and so is false for every tab that is not the current
     * one in its stack. That makes it exactly the "a pane is showing this
     * editor" test.
     */
    protected visibleEditorWidgets(): EditorWidget[] {
        return this.openEditorWidgets().filter(widget => widget.isVisible);
    }

    /**
     * How many editor panes are on screen. Notepad++'s View menu is built for
     * one view or two, so this is counted rather than read off the dock layout:
     * the dock panel also holds tabs, and a tab is not a view.
     */
    protected splitPaneCount(): number {
        return this.visibleEditorWidgets().length;
    }

    /**
     * `View > Clone to Other View`: the same file in a second pane.
     *
     * `openToSide` is the same path VS Code's Split Editor takes, and unlike
     * `ApplicationShell.addWidget` it creates a genuinely separate widget for
     * the resource, which is what "clone" means - two independent views of one
     * file, each with its own cursor and scroll position. That is also what
     * makes Synchronize Scrolling (notepadia-sync-scroll.ts) meaningful.
     */
    protected async cloneToOtherView(): Promise<void> {
        const focused = this.focusedEditor();
        const uri = focused?.editor.getResourceUri();
        if (!focused || !uri) {
            return;
        }
        await this.editorManager.openToSide(uri, {
            // The clone starts where the source is, so the two views open on
            // the same line rather than at the top of the file.
            selection: toRange(focused.control.getSelection()),
            widgetOptions: { mode: 'split-right', ref: focused.widget }
        });
    }

    /**
     * `View > Move to Other View`: the file ends up in the other pane only.
     *
     * Two cases, because the split can hold either the same file twice (what
     * Clone produces) or two different files:
     *
     *  - Same file in both panes: the document is already open in the other
     *    view, so moving it is just closing the source. Nothing is reopened.
     *  - Different files: the source's document has to be opened next to the
     *    *other* pane before the source closes, otherwise closing it would just
     *    close the file and leave the user with a view of whatever the second
     *    pane happened to be showing.
     *
     * Closing one of two widgets for a resource does not prompt: Theia's own
     * save check skips a widget whose document is still open elsewhere, so the
     * unsaved text stays available rather than being offered to be thrown away.
     */
    protected async moveToOtherView(): Promise<void> {
        const focused = this.focusedEditor();
        const uri = focused?.editor.getResourceUri();
        if (!focused || !uri) {
            return;
        }
        const source = focused.widget;
        const target = this.visibleEditorWidgets()
            .find(candidate => candidate !== source);
        if (!target) {
            return;
        }
        const targetUri = MonacoEditor.get(target)?.getResourceUri();
        if (!targetUri || targetUri.isEqual(uri)) {
            // Already in the other view; the source pane is the duplicate.
            await this.shell.closeWidget(source.id);
            await this.shell.activateWidget(target.id);
            return;
        }
        // Reopen beside the target so the document lands in the other view.
        await this.editorManager.openToSide(uri, {
            selection: toRange(focused.control.getSelection()),
            widgetOptions: { mode: 'split-right', ref: target }
        });
        await this.shell.closeWidget(source.id);
        await this.shell.activateWidget(target.id);
    }

    /**
     * `View > Full Screen` on `document.documentElement`.
     *
     * The request is fire-and-forget and its rejection is swallowed on purpose:
     * browsers reject it when it is not from a user gesture, and a full screen
     * that cannot start is not an error worth a dialog - the menu item simply
     * stays unchecked.
     */
    protected toggleFullScreen(): void {
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => { });
        } else {
            document.documentElement.requestFullscreen().catch(() => { });
        }
    }

    /**
     * `View > Summary...` over the current selection.
     *
     * Only the primary selection is counted. With several cursors the figures
     * would otherwise depend on which cursor the editor happened to report
     * first, and a summary that changes when you move the mouse is not a
     * summary.
     */
    protected openSummary(): void {
        const focused = this.focusedEditor();
        const model = focused?.control.getModel();
        if (!focused || !model) {
            return;
        }
        const selection = focused.control.getSelection();
        const hasSelection = !!selection && !selection.isEmpty();
        const stats = documentStats({
            text: model.getValue(),
            lineCount: model.getLineCount(),
            selectedText: hasSelection ? model.getValueInRange(selection) : undefined,
            selectedLineCount: hasSelection
                ? Math.abs(selection!.endLineNumber - selection!.startLineNumber) + 1
                : undefined
        });
        new NotepadiaSummaryDialog(stats).open();
    }

    registerMenus(menus: MenuModelRegistry): void {
        // Notepad++'s own View order: Show Symbol, Tab Bar, Zoom, Tab Size,
        // then the folding and split entries.
        const showSymbol = [...CommonMenus.VIEW, '1_notepadia-show-symbol'];
        const foldLevel = [...CommonMenus.VIEW, '4_notepadia-fold-level'];
        menus.registerSubmenu(showSymbol, 'Show Symbol');
        menus.registerSubmenu(foldLevel, 'Fold Level');

        menus.registerMenuAction(showSymbol, {
            commandId: NotepadiaViewCommands.SHOW_SPACE_AND_TAB.id,
            order: 'a'
        });
        menus.registerMenuAction(showSymbol, {
            commandId: NotepadiaViewCommands.SHOW_ALL_CHARACTERS.id,
            order: 'b'
        });
        menus.registerMenuAction(showSymbol, {
            commandId: NotepadiaViewCommands.SHOW_END_OF_LINE.id,
            order: 'c'
        });
        menus.registerMenuAction(showSymbol, {
            commandId: NotepadiaViewCommands.SHOW_INDENT_GUIDE.id,
            order: 'd'
        });
        // Notepad++'s "Show Wrap Symbol" has no Monaco equivalent in 1.75: the
        // editor exposes no wrapping-indicator option (no `renderWordWrap`, and
        // `wordWrap` itself is only the wrap behaviour). It is left off the menu
        // rather than bound to something that would not draw the marker.
        // docs/usage.md records it under "not applicable".

        menus.registerMenuAction([...CommonMenus.VIEW], {
            commandId: NotepadiaViewCommands.FOLD_ALL.id,
            order: 'e'
        });
        menus.registerMenuAction([...CommonMenus.VIEW], {
            commandId: NotepadiaViewCommands.UNFOLD_ALL.id,
            order: 'f'
        });
        // The submenu itself needs no command of its own. Registering one would
        // add a dead "Fold Level" row inside the "Fold Level" submenu that does
        // nothing when clicked.
        for (let level = 1; level <= MAX_MONACO_FOLD_LEVEL; level++) {
            menus.registerMenuAction(foldLevel, {
                commandId: foldLevelCommandId(level),
                order: String.fromCharCode('a'.charCodeAt(0) + level - 1)
            });
        }

        menus.registerMenuAction([...CommonMenus.VIEW], {
            commandId: NotepadiaViewCommands.CLONE_TO_OTHER_VIEW.id,
            order: 'g'
        });
        menus.registerMenuAction([...CommonMenus.VIEW], {
            commandId: NotepadiaViewCommands.MOVE_TO_OTHER_VIEW.id,
            order: 'h'
        });
        menus.registerMenuAction([...CommonMenus.VIEW], {
            commandId: NotepadiaViewCommands.SUMMARY.id,
            order: 'i'
        });
        menus.registerMenuAction([...CommonMenus.VIEW], {
            commandId: NotepadiaViewCommands.FULL_SCREEN.id,
            order: 'j'
        });
        menus.registerMenuAction([...CommonMenus.VIEW], {
            commandId: NotepadiaViewCommands.POST_IT.id,
            order: 'k'
        });

        // Notepad++ also lists Function List and Project Panels in this menu.
        //
        //  - `Function List` is registered by
        //    notepadia-function-list-contribution.ts (E1), next to Document
        //    Map.
        //  - `Project Panels` is already covered by `Folder as Workspace`
        //    (registered by notepadia-shell-contribution.ts), which is what the
        //    panel step (E3) refines; a second entry would duplicate it.
    }
}