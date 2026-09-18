import { inject, injectable } from '@theia/core/shared/inversify';
import * as monaco from '@theia/monaco-editor-core';
import { DisposableCollection } from '@theia/core/lib/common/disposable';
import {
    Command,
    CommandContribution,
    CommandRegistry
} from '@theia/core/lib/common/command';
import {
    MenuContribution,
    MenuModelRegistry
} from '@theia/core/lib/common/menu';
import {
    StatusBar,
    StatusBarAlignment
} from '@theia/core/lib/browser/status-bar/status-bar-types';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';

/**
 * Notepad++ style macro recording and playback. A macro is the ordered list
 * of text the user typed and deleted while recording; playing it back repeats
 * that sequence from the current cursor position, which is the classic
 * Notepad++ macro behaviour.
 *
 * Recording captures the editor's content changes (typed characters,
 * pastes, Enter/Backspace, and the text produced by edit commands). Undo,
 * redo, EOL-only and wholesale (flush) changes are not recorded. Cursor
 * movement and selections are intentionally not captured - a macro replays
 * against wherever the cursor happens to be, exactly like Notepad++.
 */
export namespace NotepadiaMacroCommands {
    export const START: Command = { id: 'notepadia.macro.start', label: 'Record Macro...' };
    export const STOP: Command = { id: 'notepadia.macro.stop', label: 'Stop Recording' };
    export const RUN: Command = { id: 'notepadia.macro.run', label: 'Run Macro' };
    export const DISCARD: Command = { id: 'notepadia.macro.discard', label: 'Discard Recording' };
    export const CLEAR: Command = { id: 'notepadia.macro.clear', label: 'Clear Macro' };
}

export type MacroStep =
    | { kind: 'type'; text: string }
    | { kind: 'delete'; count: number };

const PLAYBACK_DELAY_MS = 10;

@injectable()
export class NotepadiaMacroContribution implements CommandContribution, MenuContribution {

    protected recording = false;
    protected playing = false;
    protected steps: MacroStep[] = [];
    protected recordingDisposables = new DisposableCollection();

    constructor(
        @inject(EditorManager) protected readonly editorManager: EditorManager,
        @inject(StatusBar) protected readonly statusBar: StatusBar
    ) { }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(NotepadiaMacroCommands.START, {
            isEnabled: () => !this.recording && !this.playing && this.currentEditor() !== undefined,
            isToggled: () => this.recording,
            execute: () => this.start()
        });
        commands.registerCommand(NotepadiaMacroCommands.STOP, {
            isEnabled: () => this.recording && !this.playing,
            execute: () => this.stop()
        });
        commands.registerCommand(NotepadiaMacroCommands.DISCARD, {
            isEnabled: () => this.recording && !this.playing,
            execute: () => this.discard()
        });
        commands.registerCommand(NotepadiaMacroCommands.RUN, {
            isEnabled: () => !this.recording && !this.playing && this.steps.length > 0 && this.currentEditor() !== undefined,
            execute: () => this.run()
        });
        commands.registerCommand(NotepadiaMacroCommands.CLEAR, {
            isEnabled: () => !this.playing && this.steps.length > 0,
            execute: () => this.clear()
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        const macros = ['menubar', '6b_macros'];
        menus.registerSubmenu(macros, 'Macros');
        menus.registerMenuAction(macros, { commandId: NotepadiaMacroCommands.START.id, order: 'a0' });
        menus.registerMenuAction(macros, { commandId: NotepadiaMacroCommands.STOP.id, order: 'a1' });
        menus.registerMenuAction(macros, { commandId: NotepadiaMacroCommands.DISCARD.id, order: 'a2' });
        menus.registerMenuAction(macros, { commandId: NotepadiaMacroCommands.RUN.id, order: 'b' });
        menus.registerMenuAction(macros, { commandId: NotepadiaMacroCommands.CLEAR.id, order: 'c' });
    }

    protected currentEditor(): MonacoEditor | undefined {
        const widget = this.editorManager.currentEditor;
        return widget ? MonacoEditor.get(widget) : undefined;
    }

    protected start(): void {
        const editor = this.currentEditor();
        const control = editor?.getControl();
        const model = control?.getModel();
        if (!editor || !control || !model) {
            return;
        }
        this.recording = true;
        this.steps = [];
        this.playbackModel(control, model, this.steps);
        void this.statusBar.setElement('notepadia.macro', {
            text: 'REC',
            tooltip: 'Recording macro - Macros > Stop Recording to finish',
            alignment: StatusBarAlignment.RIGHT,
            priority: 60
        });
    }

    protected playbackModel(
        control: monaco.editor.ICodeEditor,
        model: monaco.editor.ITextModel,
        target: MacroStep[]
    ): void {
        this.recordingDisposables.dispose();
        this.recordingDisposables.push(model.onDidChangeContent(e => {
            if (this.playing || !this.recording) {
                return;
            }
            if (e.isUndoing || e.isRedoing || e.isFlush || e.isEolChange) {
                return;
            }
            for (const change of e.changes) {
                if (change.rangeLength > 0) {
                    target.push({ kind: 'delete', count: change.rangeLength });
                }
                if (change.text.length > 0) {
                    target.push({ kind: 'type', text: change.text });
                }
            }
        }));
    }

    protected stop(): void {
        if (!this.recording) {
            return;
        }
        this.recording = false;
        this.recordingDisposables.dispose();
        void this.statusBar.removeElement('notepadia.macro');
    }

    protected discard(): void {
        this.stop();
        this.steps = [];
    }

    protected clear(): void {
        this.steps = [];
    }

    protected async run(): Promise<void> {
        const editor = this.currentEditor();
        const control = editor?.getControl();
        if (!editor || !control || this.steps.length === 0 || this.playing) {
            return;
        }
        this.playing = true;
        try {
            control.focus();
            for (const step of this.steps) {
                if (step.kind === 'type') {
                    if (step.text) {
                        control.trigger('notepadia.macro', 'type', { text: step.text });
                    }
                } else {
                    for (let i = 0; i < step.count; i++) {
                        control.trigger('notepadia.macro', 'deleteLeft', {});
                    }
                }
                await this.delay();
            }
        } finally {
            this.playing = false;
        }
    }

    protected delay(): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, PLAYBACK_DELAY_MS));
    }
}