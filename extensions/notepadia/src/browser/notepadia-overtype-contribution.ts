import { inject, injectable } from '@theia/core/shared/inversify';
import { Emitter } from '@theia/core/lib/common/event';
import { DisposableCollection } from '@theia/core/lib/common/disposable';
import { Command, CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';
import * as monaco from '@theia/monaco-editor-core';

export namespace NotepadiaOvertypeCommands {
    export const TOGGLE_OVERTYPE: Command = {
        id: 'notepadia.toggleOvertype',
        label: 'Overtype Mode (INS/OVR)'
    };
}

/**
 * A real INS/OVR mode (A5). Monaco's 1.75 core exposes no overtype toggle
 * action, so this contribution implements it: the Insert key (and the status
 * bar INS/OVR element) toggles a flag; while overtype is on, printable
 * characters replace the character under the caret instead of inserting, and
 * the caret renders as a block. Monaco's own input is bypassed for those keys
 * (capture-phase keydown + stopPropagation), so the editor's undo stack still
 * records each overwrite as a single edit. Selections, multiple cursors and
 * IME composition pass through unchanged and behave as plain insert.
 */
@injectable()
export class NotepadiaOvertypeContribution implements CommandContribution, FrontendApplicationContribution {
    protected enabled = false;
    protected readonly toDispose = new DisposableCollection();
    protected readonly onDidChangeEmitter = new Emitter<boolean>();

    /** Fires with the new state after every toggle (drives the status bar). */
    readonly onDidChange = this.onDidChangeEmitter.event;

    constructor(
        @inject(EditorManager) protected readonly editorManager: EditorManager
    ) {}

    onStart(): void {
        this.editorManager.onCurrentEditorChanged(() => this.attach());
        this.attach();
    }

    isOvertypeEnabled(): boolean {
        return this.enabled;
    }

    toggle(): void {
        this.enabled = !this.enabled;
        this.attach();
        this.onDidChangeEmitter.fire(this.enabled);
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(NotepadiaOvertypeCommands.TOGGLE_OVERTYPE, {
            execute: () => this.toggle(),
            isEnabled: () => !!this.editorManager.currentEditor
        });
    }

    /** Re-apply the caret shape and (in OVR mode) the key interception to the current editor. */
    protected attach(): void {
        this.toDispose.dispose();
        const editor = this.editorManager.currentEditor;
        const control = editor ? MonacoEditor.get(editor)?.getControl() : undefined;
        if (!control) {
            return;
        }
        control.updateOptions({ cursorStyle: this.enabled ? 'block' : 'line' });
        if (this.enabled) {
            const domNode = control.getDomNode();
            if (domNode) {
                const listener = (e: KeyboardEvent) => this.onKeyDown(e, control);
                // Capture phase: run before Monaco's own keydown handler so the
                // intercepted key never reaches its input pipeline.
                domNode.addEventListener('keydown', listener, true);
                this.toDispose.push({
                    dispose: () => domNode.removeEventListener('keydown', listener, true)
                });
            }
        }
    }

    protected onKeyDown(e: KeyboardEvent, control: monaco.editor.IStandaloneCodeEditor): void {
        if (e.ctrlKey || e.altKey || e.metaKey || e.isComposing) {
            return;
        }
        if (e.key.length !== 1) {
            return;
        }
        const model = control.getModel();
        const position = control.getPosition();
        if (!model || !position) {
            return;
        }
        const selections = control.getSelections();
        if (!selections || selections.length !== 1) {
            return;
        }
        const selection = selections[0];
        if (!selection.isEmpty()) {
            return;
        }
        const lineText = model.getLineContent(position.lineNumber);
        if (position.column > lineText.length) {
            // No character to the right (end of line): let Monaco insert.
            return;
        }

        e.preventDefault();
        e.stopPropagation();
        const text = e.key;
        control.executeEdits('notepadia.overtype', [{
            range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column + 1),
            text
        }]);
        control.setPosition(new monaco.Position(position.lineNumber, position.column + text.length));
    }
}