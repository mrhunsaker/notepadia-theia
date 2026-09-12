import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';
import { inject, injectable } from '@theia/core/shared/inversify';
import {
    FrontendApplicationContribution
} from '@theia/core/lib/browser';
import {
    StatusBar,
    StatusBarAlignment
} from '@theia/core/lib/browser/status-bar/status-bar-types';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';

@injectable()
export class NotepadiaStatusBarContribution implements FrontendApplicationContribution {
    constructor(
        @inject(StatusBar) protected readonly statusBar: StatusBar,
        @inject(EditorManager) protected readonly editorManager: EditorManager
    ) {}

    onStart(): void {
        this.update();

        this.editorManager.onCurrentEditorChanged(() => {
            this.update();
        });
    }

    protected update(): void {
        const editor = this.editorManager.currentEditor;
        const control = editor ? MonacoEditor.get(editor)?.getControl() : undefined;
        const position = control?.getPosition();

        const encoding = 'UTF-8';

        this.statusBar.setElement('notepadia.position', {
            text: position
                ? `Ln ${position.lineNumber}, Col ${position.column}`
                : 'Ln 1, Col 1',
            alignment: StatusBarAlignment.RIGHT,
            priority: 100
        });

        this.statusBar.setElement('notepadia.encoding', {
            text: encoding || 'UTF-8',
            alignment: StatusBarAlignment.RIGHT,
            priority: 90
        });

        this.statusBar.setElement('notepadia.eol', {
            text: 'LF',
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
