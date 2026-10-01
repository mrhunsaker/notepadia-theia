import { inject, injectable } from '@theia/core/shared/inversify';
import {
    Command,
    CommandContribution,
    CommandRegistry
} from '@theia/core/lib/common';
import { CommonMenus } from '@theia/core/lib/browser/common-menus';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { AbstractDialog, DialogError, DialogMode } from '@theia/core/lib/browser/dialogs';
import { NavigatableWidget } from '@theia/core/lib/browser/navigatable-types';
import { MessageService } from '@theia/core/lib/common/message-service';
import { Emitter } from '@theia/core/lib/common/event';
import { Disposable, DisposableCollection } from '@theia/core/lib/common/disposable';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import { EditorWidget } from '@theia/editor/lib/browser/editor-widget';
import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';
import * as monaco from '@theia/monaco-editor-core';
import { NotepadiaClipboardHistoryState } from './notepadia-clipboard-history-state';
import {
    DATE_TIME_TOKENS,
    DEFAULT_SHORT_FORMAT,
    formatDateTime,
    isValidDateTimeFormat,
    longDateTime,
    shortDateTime
} from '../common/date-time-formats';
import { pasteAndIndent, pasteAndUnindent, plainText } from '../common/paste-special';
import { columnBlockSelections } from '../common/column-block';
import { MULTI_SELECT_NO_TARGET_MESSAGE, multiSelectTerm } from '../common/multi-select';
import { anchorSelection, isPlainNavigation, shouldExtend } from '../common/begin-end-select';

export namespace NotepadiaEditExtrasCommands {
    export const COPY_FULL_FILE_PATH: Command = {
        id: 'notepadia.edit.copyFullFilePath',
        label: 'Current Full File Path'
    };
    export const COPY_FILE_NAME: Command = {
        id: 'notepadia.edit.copyFileName',
        label: 'Current Filename'
    };
    export const COPY_DIRECTORY_PATH: Command = {
        id: 'notepadia.edit.copyDirectoryPath',
        label: 'Current Directory Path'
    };
    export const PASTE_AND_INDENT: Command = {
        id: 'notepadia.edit.pasteAndIndent',
        label: 'Paste and Indent'
    };
    export const PASTE_AND_UNINDENT: Command = {
        id: 'notepadia.edit.pasteAndUnindent',
        label: 'Paste and Unindent'
    };
    export const PASTE_UNFORMATTED: Command = {
        id: 'notepadia.edit.pasteUnformatted',
        label: 'Paste Unformatted'
    };
    export const DATE_TIME_SHORT: Command = {
        id: 'notepadia.edit.dateTimeShort',
        label: 'Date & Time (short)'
    };
    export const DATE_TIME_LONG: Command = {
        id: 'notepadia.edit.dateTimeLong',
        label: 'Date & Time (long)'
    };
    export const DATE_TIME_CUSTOM: Command = {
        id: 'notepadia.edit.dateTimeCustom',
        label: 'Date & Time (customized)...'
    };
    export const SET_READ_ONLY: Command = {
        id: 'notepadia.edit.setReadOnly',
        label: 'Set/Clear Read-Only'
    };
    export const BEGIN_END_SELECT: Command = {
        id: 'notepadia.edit.beginEndSelect',
        label: 'Begin/End Select'
    };
    export const COLUMN_MODE: Command = {
        id: 'notepadia.edit.columnMode',
        label: 'Column Mode'
    };
    export const MULTI_SELECT_ALL: Command = {
        id: 'notepadia.edit.multiSelectAll',
        label: 'Multi-Select All'
    };
    export const MULTI_SELECT_ALL_MATCH_CASE: Command = {
        id: 'notepadia.edit.multiSelectAllMatchCase',
        label: 'Multi-Select All (Match case)'
    };
    export const MULTI_SELECT_ALL_WHOLE_WORD: Command = {
        id: 'notepadia.edit.multiSelectAllWholeWord',
        label: 'Multi-Select All (Whole word)'
    };
}

/** Menu paths of the new Edit-menu submenus, in Notepad++'s order. */
export const NOTEPADIA_EDIT_MENU_PATHS = {
    copyToClipboard: [...CommonMenus.EDIT, '2b_notepadia-copy-to-clipboard'],
    pasteSpecial: [...CommonMenus.EDIT, '2c_notepadia-paste-special'],
    select: [...CommonMenus.EDIT, '3a_notepadia-select'],
    insert: [...CommonMenus.EDIT, '6_notepadia-insert'],
    clipboardHistory: [...CommonMenus.EDIT, 'b_notepadia-clipboard-history'],
    characterPanel: [...CommonMenus.EDIT, 'c_notepadia-character-panel']
};

const INVALID_DATE_TIME_FORMAT_MESSAGE =
    'Use at least one date or time token, for example yyyy-MM-dd HH:mm.';

/**
 * A cursor per match, so a common word in a large file could otherwise produce
 * tens of thousands of them and lock the editor up. The cap matches the one
 * Monaco's find widget uses, and hitting it is reported rather than passed off
 * as "that is all of them".
 */
const MULTI_SELECT_MATCH_LIMIT = 1000;

/**
 * The `Date & Time (customized)...` box. `AbstractDialog` already validates on
 * every keystroke and on accept, so the refusal happens where the user is
 * looking rather than after the text is already in the document.
 */
class NotepadiaDateTimeFormatDialog extends AbstractDialog<string | undefined> {

    protected readonly input: HTMLInputElement;

    constructor(initialFormat: string) {
        super({ title: 'Edit > Insert > Date & Time (customized)...' });
        this.appendAcceptButton('Insert');
        this.appendCloseButton('Cancel');

        this.input = document.createElement('input');
        this.input.type = 'text';
        this.input.value = initialFormat;
        this.input.style.width = '100%';
        // The base class validates on open and on accept, but a plain `<input>`
        // has nothing to translate keystrokes into its validate() cycle, so the
        // refusal only ever appeared after clicking Insert. Re-run validation on
        // each input so the message shows the moment the format stops being a
        // valid one, the same behavior as the rest of the date box.
        this.input.addEventListener('input', () => this.update());

        const label = document.createElement('label');
        label.textContent = 'Date & time format';
        label.style.display = 'block';
        label.style.marginBottom = '4px';

        const hint = document.createElement('div');
        hint.style.opacity = '0.7';
        hint.style.fontSize = 'var(--theia-ui-font-size0)';
        hint.style.marginTop = '6px';
        hint.textContent = `Tokens: ${DATE_TIME_TOKENS.join(' ')} - and put literal text in 'quotes'.`;

        this.contentNode.append(label, this.input, hint);
    }

    get value(): string | undefined {
        return this.input.value;
    }

    protected override isValid(value: string | undefined, _mode: DialogMode): DialogError {
        return isValidDateTimeFormat(value ?? '') ? true : INVALID_DATE_TIME_FORMAT_MESSAGE;
    }
}

/**
 * C2 - the Notepad++ Edit menu entries that were missing.
 *
 * The Edit menu had the block operations Notepad++ has and none of the
 * clipboard, insertion, selection or protection entries. Each group here is
 * the smallest thing that is actually useful rather than a placeholder:
 *
 *  - **Copy to Clipboard** puts the path, the name or the folder on the system
 *    clipboard, with a real fallback for the deployments where the async
 *    clipboard API is not available at all (a page served over plain http on a
 *    LAN is not a secure context, and there `navigator.clipboard` is simply
 *    absent).
 *  - **Paste Special** indents the pasted block to match the line above the
 *    caret, or strips the duplicate indent, instead of dropping the text in
 *    with no regard for the code around it.
 *  - **Insert > Date & Time** writes the current time in Notepad++'s two
 *    default formats, or in one the user types.
 *  - **Set/Clear Read-Only** is remembered per document, and the padlock the
 *    tab decorator already paints and the status bar's Read-Only text both
 *    read straight from that state.
 *  - **Begin/End Select** anchors the selection where the caret is and extends
 *    it as the caret moves, which is a mouse-free way to select a range longer
 *    than one screen.
 *  - **Multi-Select All** puts a cursor on every occurrence of the selected
 *    word, and **Column Mode** turns the selection into a block for the people
 *    who have never discovered Alt+drag.
 *  - **Clipboard History** keeps what was copied this session, and the
 *    **Character Panel** entry is finally where Notepad++ keeps it, next to
 *    the rest of the editing commands.
 *
 * The menu entries are registered by `NotepadiaMenuContribution` so that the
 * whole Edit menu keeps one ordering; this contribution owns the commands and
 * their behaviour.
 */
@injectable()
export class NotepadiaEditExtrasContribution implements CommandContribution, FrontendApplicationContribution {

    protected readonly readOnlyKeys = new Set<string>();
    protected readonly onDidChangeReadOnlyEmitter = new Emitter<void>();
    /** Fires whenever any document's read-only state changes (drives the status bar). */
    readonly onDidChangeReadOnly = this.onDidChangeReadOnlyEmitter.event;

    /** Begin/End Select anchors, one per editor, so switching tabs keeps them. */
    protected readonly anchors = new Map<string, monaco.Position>();
    /**
     * App-lifetime disposables: the editor-manager subscriptions and the
     * document-level clipboard listener. Never disposed during normal running.
     */
    protected readonly toDispose = new DisposableCollection();
    /**
     * Per-editor disposables, thrown away on every editor switch. Kept separate
     * from `toDispose` so that switching tabs cannot take the document-level
     * clipboard listener with it: sharing one collection meant the first switch
     * after startup silently ended Clipboard History capture for the session.
     */
    protected editorListeners: DisposableCollection = new DisposableCollection();
    /**
     * Guards the selection write triggered by our own anchor extension, so a
     * write cannot re-enter itself.
     */
    protected extendingSelection = false;
    /** The caret this extension last installed, echoed back by Monaco. */
    protected lastExtendedCaret: monaco.Position | undefined;
    /**
     * Set when a plain navigation key was seen while an anchor was live, so the
     * caret move it is about to cause is re-extended from the anchor.
     */
    protected pendingExtension = false;
    /**
     * Caret-moving keys that have to have the selection collapsed out of the
     * way first. Kept here rather than in `src/common` so the pure module stays
     * free of any Monaco import.
     */
    protected readonly NAVIGATION_KEY_CODES: ReadonlySet<number> = new Set([
        monaco.KeyCode.LeftArrow,
        monaco.KeyCode.RightArrow,
        monaco.KeyCode.UpArrow,
        monaco.KeyCode.DownArrow,
        monaco.KeyCode.Home,
        monaco.KeyCode.End,
        monaco.KeyCode.PageUp,
        monaco.KeyCode.PageDown
    ]);

    constructor(
        @inject(EditorManager) protected readonly editorManager: EditorManager,
        @inject(MessageService) protected readonly messageService: MessageService,
        @inject(NotepadiaClipboardHistoryState) protected readonly clipboardHistory: NotepadiaClipboardHistoryState
    ) { }

    onStart(): void {
        this.toDispose.pushAll([
            this.editorManager.onCurrentEditorChanged(editor => {
                this.applyReadOnly(editor);
                this.attachAnchor(editor);
            }),
            this.editorManager.onCreated(editor => this.applyReadOnly(editor))
        ]);
        this.applyReadOnly(this.editorManager.currentEditor);
        this.attachAnchor(this.editorManager.currentEditor);
        this.watchCopies();
    }

    registerCommands(commands: CommandRegistry): void {
        const copy = (command: Command, format: (path: string, base: string, dir: string) => string) =>
            commands.registerCommand(command, {
                isEnabled: () => this.currentUri() !== undefined,
                execute: async () => {
                    const uri = this.currentUri();
                    if (uri) {
                        await this.copyToClipboard(format(uri.path.toString(), uri.path.base, uri.path.dir.toString()));
                    }
                }
            });
        copy(NotepadiaEditExtrasCommands.COPY_FULL_FILE_PATH, (path, _base, _dir) => path);
        copy(NotepadiaEditExtrasCommands.COPY_FILE_NAME, (_path, base, _dir) => base);
        copy(NotepadiaEditExtrasCommands.COPY_DIRECTORY_PATH, (_path, _base, dir) => dir);

        commands.registerCommand(NotepadiaEditExtrasCommands.PASTE_AND_INDENT, {
            isEnabled: () => this.currentControl() !== undefined,
            execute: () => this.pasteSpecial(pasteAndIndent)
        });
        commands.registerCommand(NotepadiaEditExtrasCommands.PASTE_AND_UNINDENT, {
            isEnabled: () => this.currentControl() !== undefined,
            execute: () => this.pasteSpecial(pasteAndUnindent)
        });
        // In a plain-text editor the `text/plain` flavour of the clipboard is
        // already unformatted, so this is the identity transform rather than
        // a separate code path.
        commands.registerCommand(NotepadiaEditExtrasCommands.PASTE_UNFORMATTED, {
            isEnabled: () => this.currentControl() !== undefined,
            execute: () => this.pasteSpecial(plainText)
        });

        commands.registerCommand(NotepadiaEditExtrasCommands.DATE_TIME_SHORT, {
            isEnabled: () => this.currentControl() !== undefined,
            execute: () => this.insertDateTime(shortDateTime(new Date()))
        });
        commands.registerCommand(NotepadiaEditExtrasCommands.DATE_TIME_LONG, {
            isEnabled: () => this.currentControl() !== undefined,
            execute: () => this.insertDateTime(longDateTime(new Date()))
        });
        commands.registerCommand(NotepadiaEditExtrasCommands.DATE_TIME_CUSTOM, {
            isEnabled: () => this.currentControl() !== undefined,
            execute: () => this.insertCustomDateTime()
        });

        commands.registerCommand(NotepadiaEditExtrasCommands.SET_READ_ONLY, {
            isEnabled: () => this.currentControl() !== undefined,
            isToggled: () => this.isReadOnly(),
            execute: () => this.toggleReadOnly()
        });

        commands.registerCommand(NotepadiaEditExtrasCommands.BEGIN_END_SELECT, {
            isEnabled: () => this.currentControl() !== undefined,
            isToggled: () => this.hasAnchor(),
            execute: () => this.toggleBeginEndSelect()
        });

        commands.registerCommand(NotepadiaEditExtrasCommands.COLUMN_MODE, {
            isEnabled: () => this.currentControl() !== undefined,
            execute: () => this.columnMode()
        });

        const multiSelect = (command: Command, matchCase: boolean, wholeWord: boolean) =>
            commands.registerCommand(command, {
                isEnabled: () => this.currentControl() !== undefined,
                execute: () => this.multiSelectAll(matchCase, wholeWord)
            });
        multiSelect(NotepadiaEditExtrasCommands.MULTI_SELECT_ALL, false, false);
        multiSelect(NotepadiaEditExtrasCommands.MULTI_SELECT_ALL_MATCH_CASE, true, false);
        multiSelect(NotepadiaEditExtrasCommands.MULTI_SELECT_ALL_WHOLE_WORD, false, true);
    }

    // ------------------------------------------------------------- read-only

    /**
     * Whether the current document is read-only. The status bar asks this
     * directly, so it takes no argument and always answers about the document
     * the user is looking at.
     */
    isReadOnly(editor = this.editorManager.currentEditor): boolean {
        return editor ? this.readOnlyKeys.has(this.readOnlyKey(editor)) : false;
    }

    protected toggleReadOnly(): void {
        const editor = this.editorManager.currentEditor;
        if (!editor) {
            return;
        }
        const key = this.readOnlyKey(editor);
        if (this.readOnlyKeys.has(key)) {
            this.readOnlyKeys.delete(key);
        } else {
            this.readOnlyKeys.add(key);
        }
        this.applyReadOnly(editor);
        this.onDidChangeReadOnlyEmitter.fire();
    }

    /**
     * A document keeps its read-only state when the user comes back to it, and
     * so does a file that was closed and reopened in the same session. An
     * untitled document has no path of its own, so it is keyed by the editor
     * instead - which is exactly as long-lived as the buffer.
     */
    protected readOnlyKey(editor: EditorWidget): string {
        return NavigatableWidget.getUri(editor)?.toString() ?? `untitled:${editor.id}`;
    }

    /**
     * Only writes the option when it differs, so a tab switch does not churn
     * every editor's configuration - the tab decorator listens for exactly this
     * event to repaint the padlock.
     */
    protected applyReadOnly(editor: EditorWidget | undefined): void {
        const control = editor ? MonacoEditor.get(editor)?.getControl() : undefined;
        if (!control) {
            return;
        }
        const readOnly = this.isReadOnly(editor);
        if (control.getOption(monaco.editor.EditorOption.readOnly) !== readOnly) {
            control.updateOptions({ readOnly });
        }
    }

    // --------------------------------------------------------------- copying

    /**
     * `navigator.clipboard` needs a secure context: `http://localhost` counts,
     * but the same app reached over a LAN on `http://192.168.x.x` does not, and
     * there the property is simply missing. The old selection-based copy is the
     * fallback, and it is reported as a failure rather than swallowed - a menu
     * item that silently does nothing is worse than one that says it could not.
     */
    protected async copyToClipboard(text: string): Promise<void> {
        if (navigator.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                return;
            } catch {
                // Permission denied, or not a secure context after all: fall
                // through to the selection-based copy below.
            }
        }
        if (!this.copyWithSelection(text)) {
            this.messageService.error('Could not write to the clipboard.');
        }
    }

    protected copyWithSelection(text: string): boolean {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.top = '-1000px';
        area.style.opacity = '0';
        document.body.appendChild(area);
        const selection = document.getSelection();
        const previous = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : undefined;
        try {
            area.select();
            return document.execCommand('copy');
        } catch {
            return false;
        } finally {
            document.body.removeChild(area);
            if (selection && previous) {
                selection.removeAllRanges();
                selection.addRange(previous);
            }
        }
    }

    /**
     * Every copy the user makes, however it was made - Ctrl+C in the editor,
     * the toolbar's Copy button, the tab menu's Copy, a middle-click paste
     * somewhere else - fires a `copy` event on the document. The text is read
     * from the event where the browser provides it.
     *
     * Some builds (headless Chromium included) route the editor's copy through
     * the Web Clipboard API, whose `/write` does not populate the DOM event's
     * clipboardData - the `copy` event fires with no data at all. The
     * selection the copy came from is still intact at that point, so fall back
     * to recording exactly what is selected in the editor; it is the same
     * text.
     */
    protected watchCopies(): void {
        const listener = (event: ClipboardEvent) => {
            const text = event.clipboardData?.getData('text/plain') ?? '';
            if (text) {
                this.clipboardHistory.add(text);
                return;
            }
            const control = this.currentControl();
            const model = control?.getModel();
            const selection = control?.getSelection();
            if (control && model && selection && !selection.isEmpty()) {
                this.clipboardHistory.add(model.getValueInRange(selection));
            }
        };
        document.addEventListener('copy', listener, true);
        document.addEventListener('cut', listener, true);
        this.toDispose.push(Disposable.create(() => {
            document.removeEventListener('copy', listener, true);
            document.removeEventListener('cut', listener, true);
        }));
    }

    // ----------------------------------------------------------- paste special

    /**
     * Paste the clipboard, then reshape it: `Paste and Indent` lines the block
     * up with the line above the caret, `Paste and Unindent` removes the indent
     * they share, and `Paste Unformatted` - which is plain text in a plain-text
     * editor, so the identity here - leaves it alone.
     *
     * The clipboard is read through the API when the browser allows it, and
     * where it is not the message says so instead of pasting something else.
     */
    protected async pasteSpecial(transform: (previousLine: string, clipboard: string) => string): Promise<void> {
        const control = this.currentControl();
        const model = control?.getModel();
        const selection = control?.getSelection();
        if (!control || !model || !selection) {
            return;
        }
        const clipboard = await this.readClipboardText();
        if (clipboard === undefined) {
            this.messageService.warn(
                'This browser will not let the page read the clipboard. Use Paste, or allow clipboard access.');
            return;
        }
        const caretLine = selection.getStartPosition().lineNumber;
        const previousLine = caretLine > 1 ? model.getLineContent(caretLine - 1) : '';
        const text = transform(previousLine, clipboard);
        control.pushUndoStop();
        control.executeEdits('notepadia.paste-special', [{ range: selection, text }]);
        control.pushUndoStop();
        control.focus();
    }

    protected async readClipboardText(): Promise<string | undefined> {
        if (!navigator.clipboard?.readText) {
            return undefined;
        }
        try {
            return await navigator.clipboard.readText();
        } catch {
            return undefined;
        }
    }

    // --------------------------------------------------------- date & time

    protected insertDateTime(text: string): void {
        const control = this.currentControl();
        if (!control) {
            return;
        }
        const selections = control.getSelections();
        if (!selections || selections.length === 0) {
            return;
        }
        control.pushUndoStop();
        control.executeEdits('notepadia.date-time',
            selections.map(selection => ({ range: selection, text })));
        control.pushUndoStop();
        control.focus();
    }

    protected async insertCustomDateTime(): Promise<void> {
        const control = this.currentControl();
        if (!control) {
            return;
        }
        const format = await new NotepadiaDateTimeFormatDialog(DEFAULT_SHORT_FORMAT).open();
        if (format === undefined) {
            return;
        }
        this.insertDateTime(formatDateTime(new Date(), format));
    }

    // ------------------------------------------------------ begin/end select

    hasAnchor(editor = this.editorManager.currentEditor): boolean {
        return editor ? this.anchors.has(editor.id) : false;
    }

    /**
     * Notepad++'s Ctrl+Alt+B: the first press drops an anchor, every caret move
     * then extends the selection from it, and the second press leaves the
     * selection on screen and forgets the anchor.
     */
    protected toggleBeginEndSelect(): void {
        const editor = this.editorManager.currentEditor;
        const control = this.currentControl();
        const position = control?.getPosition();
        if (!editor || !control || !position) {
            return;
        }
        if (this.anchors.has(editor.id)) {
            this.extendToCaret(editor, control);
            this.anchors.delete(editor.id);
            this.lastExtendedCaret = undefined;
            this.pendingExtension = false;
            return;
        }
        this.anchors.set(editor.id, position);
        this.lastExtendedCaret = undefined;
        this.pendingExtension = false;
        this.extendToCaret(editor, control);
    }

    protected attachAnchor(editor: EditorWidget | undefined): void {
        this.editorListeners.dispose();
        this.editorListeners = new DisposableCollection();
        const control = editor ? MonacoEditor.get(editor)?.getControl() : undefined;
        if (!control) {
            return;
        }
        this.editorListeners.push(control.onDidChangeCursorPosition(() => {
            if (editor && this.anchors.has(editor.id)) {
                this.extendToCaret(editor, control);
            }
        }));
        // Capture phase on the window, not `control.onKeyDown`. `onKeyDown` is
        // raised by Monaco's keybinding service and does not fire for arrow
        // keys, so a listener on it never saw them. A window capture listener
        // sees the key first, before any editor handler, and is torn down with
        // the rest of the per-editor listeners.
        const onKeyDown = (event: KeyboardEvent) => {
            if (!editor || !this.anchors.has(editor.id) ||
                !isPlainNavigation({
                    keyCode: event.keyCode,
                    domKeyCode: true,
                    shiftKey: event.shiftKey,
                    navigationKeyCodes: this.NAVIGATION_KEY_CODES
                })) {
                return;
            }
            // Let Monaco move the caret first, then re-extend from the anchor.
            // Collapsing before the move is not enough on its own: Monaco's own
            // handler collapses the selection to the range's start and adopts
            // that as the caret, which is what sent the caret to the anchor
            // instead of one column along. Handling it after the move means the
            // caret is the position the user actually navigated to.
            this.pendingExtension = true;
        };
        window.addEventListener('keydown', onKeyDown, true);
        this.editorListeners.push(Disposable.create(() =>
            window.removeEventListener('keydown', onKeyDown, true)));
    }

    protected extendToCaret(editor: EditorWidget, control: monaco.editor.IStandaloneCodeEditor): void {
        const anchor = this.anchors.get(editor.id);
        const caret = control.getPosition();
        // `caret` is narrowed here rather than left to `shouldExtend`: that
        // helper answers a question, it is not a type guard, so TypeScript
        // cannot see past it.
        if (!anchor || !caret) {
            return;
        }
        // A pending navigation is a move the user made, so it extends even if
        // the caret happens to match the position we last installed. The echo
        // guard exists to swallow Monaco reporting our own write back at us;
        // this is the opposite case and must not be swallowed.
        if (!this.pendingExtension && !shouldExtend({
            anchored: true,
            extending: this.extendingSelection,
            caret,
            lastExtended: this.lastExtendedCaret
        })) {
            return;
        }
        this.pendingExtension = false;
        this.extendingSelection = true;
        try {
            const [start, end] = anchorSelection(anchor, caret);
            control.setSelection(new monaco.Selection(
                start.lineNumber, start.column, end.lineNumber, end.column));
            this.lastExtendedCaret = caret;
        } finally {
            this.extendingSelection = false;
        }
    }

    // ----------------------------------------------------------- multi-select

    protected multiSelectAll(matchCase: boolean, wholeWord: boolean): void {
        const control = this.currentControl();
        const model = control?.getModel();
        const selection = control?.getSelection();
        if (!control || !model || !selection) {
            return;
        }
        const word = model.getWordAtPosition(selection.getStartPosition());
        const term = multiSelectTerm({
            selectionText: selection.isEmpty() ? '' : model.getValueInRange(selection),
            wordAtPosition: word?.word,
            selectionIsMultiline: !selection.isEmpty() && selection.startLineNumber !== selection.endLineNumber
        });
        if (!term) {
            this.messageService.info(MULTI_SELECT_NO_TARGET_MESSAGE);
            return;
        }
        // Monaco's own find feature is the thing to copy the call from: whole
        // word is not a flag, it is the editor's word-separator set, and the
        // second argument is the search scope rather than a case flag.
        const wordSeparators = wholeWord
            ? control.getOption(monaco.editor.EditorOption.wordSeparators)
            : null;
        const matches = model.findMatches(term, false, false, matchCase, wordSeparators, false, MULTI_SELECT_MATCH_LIMIT);
        if (matches.length === 0) {
            this.messageService.info(`No other occurrence of "${term}" in this document.`);
            return;
        }
        control.pushUndoStop();
        control.setSelections(matches.map(match => monaco.Selection.fromPositions(
            match.range.getStartPosition(), match.range.getEndPosition())));
        control.pushUndoStop();
        control.focus();
        if (matches.length === MULTI_SELECT_MATCH_LIMIT) {
            this.messageService.info(
                `Stopped at ${MULTI_SELECT_MATCH_LIMIT} cursors; only that many matches were placed.`);
        }
    }

    // ------------------------------------------------------------ column mode

    /**
     * The selection as it is now becomes one selection per line over the same
     * columns. A bare caret becomes a block out to the end of its own line, so
     * there is something for Shift+Arrow to extend.
     */
    protected columnMode(): void {
        const control = this.currentControl();
        const model = control?.getModel();
        const selection = control?.getSelection();
        if (!control || !model || !selection) {
            return;
        }
        const lineMaxColumns = Array.from({ length: model.getLineCount() },
            (_, index) => model.getLineMaxColumn(index + 1));
        const block = columnBlockSelections({
            startLine: selection.startLineNumber,
            endLine: selection.endLineNumber,
            startColumn: selection.startColumn,
            endColumn: selection.endColumn,
            lineCount: model.getLineCount(),
            lineMaxColumns,
            caretOnly: selection.isEmpty()
        });
        if (block.length === 0) {
            this.messageService.info('There is nothing to make a block out of here.');
            return;
        }
        control.pushUndoStop();
        control.setSelections(block.map(entry => new monaco.Selection(
            entry.line, entry.startColumn, entry.line, entry.endColumn)));
        control.pushUndoStop();
        control.focus();
    }

    // --------------------------------------------------------------- helpers

    protected currentControl(): monaco.editor.IStandaloneCodeEditor | undefined {
        const editor = this.editorManager.currentEditor;
        return editor ? MonacoEditor.get(editor)?.getControl() : undefined;
    }

    protected currentUri() {
        return NavigatableWidget.getUri(this.editorManager.currentEditor ?? undefined);
    }
}
