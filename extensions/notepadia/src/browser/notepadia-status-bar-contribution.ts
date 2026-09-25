import * as monaco from '@theia/monaco-editor-core';
import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';
import { inject, injectable } from '@theia/core/shared/inversify';
import { DisposableCollection } from '@theia/core/lib/common/disposable';
import {
    FrontendApplicationContribution
} from '@theia/core/lib/browser';
import {
    StatusBar,
    StatusBarAlignment
} from '@theia/core/lib/browser/status-bar/status-bar-types';
import { PreferenceService } from '@theia/core/lib/common/preferences';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import { EditorCommands } from '@theia/editor/lib/browser/editor-command';
import { notepadiaLanguageName } from './notepadia-language-contribution';
import { formatCaret, formatLength, formatSelection } from '../common/status-fields';
import {
    NotepadiaOvertypeCommands,
    NotepadiaOvertypeContribution
} from './notepadia-overtype-contribution';

const ENCODING_LABELS: Record<string, string> = {
    utf8: 'UTF-8',
    utf8bom: 'UTF-8 BOM',
    utf16le: 'UTF-16 LE',
    utf16be: 'UTF-16 BE',
    windows1252: 'ANSI'
};

function eolLabel(eol?: string): string {
    switch (eol) {
        case '\r\n': return 'CRLF';
        case '\r': return 'CR';
        default: return 'LF';
    }
}

@injectable()
export class NotepadiaStatusBarContribution implements FrontendApplicationContribution {
    protected readonly toDispose = new DisposableCollection();
    protected scheduled = false;

    constructor(
        @inject(StatusBar) protected readonly statusBar: StatusBar,
        @inject(EditorManager) protected readonly editorManager: EditorManager,
        @inject(PreferenceService) protected readonly preferences: PreferenceService,
        @inject(NotepadiaOvertypeContribution) protected readonly overtype: NotepadiaOvertypeContribution
    ) {}

    onStart(): void {
        this.update();

        this.preferences.onPreferenceChanged(change => {
            if (change.preferenceName === 'editor.insertSpaces'
                || change.preferenceName === 'editor.tabSize'
                || change.preferenceName === 'editor.detectIndentation') {
                this.update();
            }
        });

        this.overtype.onDidChange(() => this.update());

        this.editorManager.onCurrentEditorChanged(() => {
            this.toDispose.dispose();
            const editor = this.editorManager.currentEditor;
            const monaco = editor ? MonacoEditor.get(editor) : undefined;
            if (monaco) {
                this.toDispose.push(monaco.document.onDidChangeEncoding(() => this.update()));
                this.toDispose.push(monaco.document.onDidChangeContent(() => this.update()));
                this.toDispose.push(monaco.onLanguageChanged(() => this.update()));
                const control = monaco.getControl();
                this.toDispose.push(control.onDidChangeCursorPosition(() => this.update()));
                this.toDispose.push(control.onDidChangeCursorSelection(() => this.update()));
                const model = control.getModel();
                if (model) {
                    this.toDispose.push(model.onDidChangeOptions(() => this.update()));
                }
            }
            this.update();
        });
    }

    /** Coalesce bursts (keystrokes, cursor moves) into one render per frame. */
    protected update(): void {
        if (this.scheduled) {
            return;
        }
        this.scheduled = true;
        requestAnimationFrame(() => {
            this.scheduled = false;
            this.render();
        });
    }

    protected render(): void {
        const editor = this.editorManager.currentEditor;
        const monaco = editor ? MonacoEditor.get(editor) : undefined;
        const control = monaco?.getControl();
        const position = control?.getPosition();
        const model: monaco.editor.ITextModel | null | undefined = control?.getModel();
        const encoding = monaco?.getEncoding() || 'utf8';
        const eol = model?.getEOL();
        const languageId = model?.getLanguageId();

        this.statusBar.setElement('notepadia.language', {
            text: notepadiaLanguageName(languageId),
            tooltip: 'Change Language Mode',
            command: EditorCommands.CHANGE_LANGUAGE.id,
            alignment: StatusBarAlignment.RIGHT,
            priority: 110
        });

        this.statusBar.setElement('notepadia.position', {
            text: position && model
                ? formatCaret(position.lineNumber, position.column, model.getOffsetAt(position))
                : 'Ln : 1  Col : 1  Pos : 0',
            alignment: StatusBarAlignment.RIGHT,
            priority: 100
        });

        this.statusBar.setElement('notepadia.selection', {
            text: this.selectionText(control),
            alignment: StatusBarAlignment.RIGHT,
            priority: 97
        });

        this.statusBar.setElement('notepadia.length', {
            text: model
                ? formatLength(model.getValueLength(), model.getLineCount())
                : 'length : 0  lines : 0',
            alignment: StatusBarAlignment.RIGHT,
            priority: 95
        });

        this.statusBar.setElement('notepadia.encoding', {
            text: ENCODING_LABELS[encoding] || encoding,
            tooltip: 'Change File Encoding',
            command: EditorCommands.CHANGE_ENCODING.id,
            alignment: StatusBarAlignment.RIGHT,
            priority: 90
        });

        this.statusBar.setElement('notepadia.eol', {
            text: eolLabel(eol),
            tooltip: 'Change Line Endings',
            command: 'notepadia.lineEndings.convert',
            alignment: StatusBarAlignment.RIGHT,
            priority: 80
        });

        const modelOptions = model?.getOptions();
        const insertSpaces = modelOptions?.insertSpaces;
        const tabSize = modelOptions?.tabSize;
        this.statusBar.setElement('notepadia.indent', {
            text: insertSpaces === undefined || tabSize === undefined
                ? 'Spaces: 4'
                : `${insertSpaces ? 'Spaces' : 'Tabs'}: ${tabSize}`,
            tooltip: 'View > Tab Size: Insert Spaces / Use Tabs',
            alignment: StatusBarAlignment.RIGHT,
            priority: 75
        });

        this.statusBar.setElement('notepadia.mode', {
            text: this.overtype.isOvertypeEnabled() ? 'OVR' : 'INS',
            tooltip: 'Toggle Overtype Mode (Insert)',
            command: NotepadiaOvertypeCommands.TOGGLE_OVERTYPE.id,
            alignment: StatusBarAlignment.RIGHT,
            priority: 70
        });
    }

    /** 'Sel : chars | lines' summing the char and line span of every cursor selection. */
    protected selectionText(control?: monaco.editor.IStandaloneCodeEditor): string {
        const fmt = formatSelection(0, 0);
        const model = control?.getModel();
        const selections = control?.getSelections();
        if (!model || !selections) {
            return fmt;
        }
        let chars = 0;
        let lines = 0;
        for (const selection of selections) {
            if (selection.isEmpty()) {
                continue;
            }
            chars += model.getValueLengthInRange(selection);
            lines += Math.abs(selection.endLineNumber - selection.startLineNumber) + 1;
        }
        return formatSelection(chars, lines);
    }
}