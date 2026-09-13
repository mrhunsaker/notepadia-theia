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
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import { EditorCommands } from '@theia/editor/lib/browser/editor-command';
import { notepadiaLanguageName } from './notepadia-language-contribution';

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

    constructor(
        @inject(StatusBar) protected readonly statusBar: StatusBar,
        @inject(EditorManager) protected readonly editorManager: EditorManager
    ) {}

    onStart(): void {
        this.update();

        this.editorManager.onCurrentEditorChanged(() => {
            this.toDispose.dispose();
            const editor = this.editorManager.currentEditor;
            const monaco = editor ? MonacoEditor.get(editor) : undefined;
            if (monaco) {
                this.toDispose.push(monaco.document.onDidChangeEncoding(() => this.update()));
                this.toDispose.push(monaco.document.onDidChangeContent(() => this.update()));
                this.toDispose.push(monaco.onLanguageChanged(() => this.update()));
            }
            this.update();
        });
    }

    protected update(): void {
        const editor = this.editorManager.currentEditor;
        const monaco = editor ? MonacoEditor.get(editor) : undefined;
        const control = monaco?.getControl();
        const position = control?.getPosition();
        const encoding = monaco?.getEncoding() || 'utf8';
        const eol = control?.getModel()?.getEOL();
        const languageId = monaco?.getControl().getModel()?.getLanguageId();

        this.statusBar.setElement('notepadia.language', {
            text: notepadiaLanguageName(languageId),
            tooltip: 'Change Language Mode',
            command: EditorCommands.CHANGE_LANGUAGE.id,
            alignment: StatusBarAlignment.RIGHT,
            priority: 110
        });

        this.statusBar.setElement('notepadia.position', {
            text: position
                ? `Ln ${position.lineNumber}, Col ${position.column}`
                : 'Ln 1, Col 1',
            alignment: StatusBarAlignment.RIGHT,
            priority: 100
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

        this.statusBar.setElement('notepadia.mode', {
            text: 'INS',
            alignment: StatusBarAlignment.RIGHT,
            priority: 70
        });
    }
}