import * as React from '@theia/core/shared/react';
import { inject, injectable } from '@theia/core/shared/inversify';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';
import { NotepadiaClipboardHistoryState } from './notepadia-clipboard-history-state';
import { clipboardEntryPreview, CLIPBOARD_HISTORY_LIMIT } from '../common/clipboard-history';

export const NOTEPADIA_CLIPBOARD_HISTORY_ID = 'notepadia.clipboardHistory';

/**
 * The Notepad++ Clipboard History panel: what was copied, newest first, with
 * one click to put an entry back at the caret.
 *
 * A ReactWidget rather than hand-built DOM because the whole surface is a list
 * that re-renders on every copy, which is the one thing hand-rolled lists end
 * up getting wrong. Each entry is a real `<button>` with the full text as its
 * `title`, so the truncated label is never the only copy of the content, and
 * the panel is a listbox so a screen reader announces the count and the
 * position of each entry.
 */
@injectable()
export class NotepadiaClipboardHistoryWidget extends ReactWidget {

    static readonly ID = NOTEPADIA_CLIPBOARD_HISTORY_ID;

    protected static readonly STYLE_ID = 'notepadia-clipboard-history-style';
    protected static readonly STYLE_TEXT = `
.notepadia-clipboard-history { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.notepadia-clipboard-history-header { display: flex; align-items: center; justify-content: space-between; padding: 4px 8px; border-bottom: 1px solid var(--theia-editorGroup-border); }
.notepadia-clipboard-history-title { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.notepadia-clipboard-history-list { flex: 1 1 auto; min-height: 0; overflow-y: auto; margin: 0; padding: 0; list-style: none; }
.notepadia-clipboard-history-entry { display: block; width: 100%; text-align: left; padding: 4px 8px; border: 0; background: transparent; color: var(--theia-foreground); cursor: pointer; font-family: var(--theia-ui-font-family); font-size: var(--theia-ui-font-size1); white-space: pre; overflow: hidden; text-overflow: ellipsis; }
.notepadia-clipboard-history-entry:hover, .notepadia-clipboard-history-entry:focus { background: var(--theia-list-hoverBackground); outline: none; }
.notepadia-clipboard-history-clear { padding: 2px 8px; border: 0; background: transparent; color: var(--theia-foreground); cursor: pointer; font-family: var(--theia-ui-font-family); font-size: var(--theia-ui-font-size1); }
.notepadia-clipboard-history-clear:hover, .notepadia-clipboard-history-clear:focus { background: var(--theia-list-hoverBackground); outline: none; }
.notepadia-clipboard-history-clear[disabled] { opacity: 0.5; cursor: default; background: transparent; }
.notepadia-clipboard-history-empty { padding: 8px; opacity: 0.7; }
`;

    protected entries: string[] = [];

    constructor(
        @inject(NotepadiaClipboardHistoryState) protected readonly history: NotepadiaClipboardHistoryState,
        @inject(EditorManager) protected readonly editorManager: EditorManager
    ) {
        super();
        this.id = NotepadiaClipboardHistoryWidget.ID;
        this.title.label = 'Clipboard History';
        this.title.caption = 'Insert something you copied earlier';
        this.title.closable = true;
        this.title.iconClass = 'codicon codicon-clippy';
        this.addClass('notepadia-clipboard-history');
        this.injectStyle();

        this.entries = history.getEntries();
        this.toDispose.push(history.onDidChange(() => {
            this.entries = history.getEntries();
            this.update();
        }));
        // A getOrCreateWidget-then-activate cycle can show the shell around the
        // widget before its first update pass is delivered, which leaves the
        // panel open but blank until a copy happens. Render the initial state
        // eagerly so the header (and the "nothing yet" row) are there on the
        // first open.
        this.update();
    }

    protected override onAfterShow(msg: Message): void {
        super.onAfterShow(msg);
        this.node.querySelector<HTMLElement>('.notepadia-clipboard-history-entry')?.focus();
    }

    protected renderEntry(text: string, index: number): React.ReactNode {
        return (
            <li key={`${index}-${text.length}-${text.slice(0, 8)}`} role="presentation">
                <button
                    type="button"
                    className="notepadia-clipboard-history-entry"
                    role="option"
                    aria-selected={false}
                    title={text}
                    onClick={() => this.insert(text)}
                >
                    {clipboardEntryPreview(text)}
                </button>
            </li>
        );
    }

    protected render(): React.ReactNode {
        const count = this.entries.length;
        return (
            <>
                <div className="notepadia-clipboard-history-header">
                    <span className="notepadia-clipboard-history-title">
                        {`Clipboard History (${count}/${CLIPBOARD_HISTORY_LIMIT})`}
                    </span>
                    <button
                        type="button"
                        className="notepadia-clipboard-history-clear"
                        disabled={count === 0}
                        onClick={() => this.history.clear()}
                    >
                        Clear
                    </button>
                </div>
                {count === 0
                    ? <div className="notepadia-clipboard-history-empty">Nothing has been copied yet.</div>
                    : (
                        <ul
                            className="notepadia-clipboard-history-list"
                            role="listbox"
                            aria-label="Clipboard history"
                        >
                            {this.entries.map((text, index) => this.renderEntry(text, index))}
                        </ul>
                    )}
            </>
        );
    }

    /** Put an entry at every caret, as one undoable edit. */
    protected insert(text: string): void {
        const editor = this.editorManager.currentEditor;
        const control = editor ? MonacoEditor.get(editor)?.getControl() : undefined;
        if (!control) {
            return;
        }
        const selections = control.getSelections() ?? [];
        if (selections.length === 0) {
            return;
        }
        control.pushUndoStop();
        control.executeEdits('notepadia.clipboard-history',
            selections.map(selection => ({ range: selection, text })));
        control.pushUndoStop();
        control.focus();
    }

    protected injectStyle(): void {
        if (document.getElementById(NotepadiaClipboardHistoryWidget.STYLE_ID)) {
            return;
        }
        const style = document.createElement('style');
        style.id = NotepadiaClipboardHistoryWidget.STYLE_ID;
        style.textContent = NotepadiaClipboardHistoryWidget.STYLE_TEXT;
        document.head.appendChild(style);
    }
}
