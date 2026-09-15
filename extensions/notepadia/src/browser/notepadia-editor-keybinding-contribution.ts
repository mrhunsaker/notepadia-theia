import { inject, injectable } from '@theia/core/shared/inversify';
import { CommandRegistry } from '@theia/core/lib/common';
import {
    CommonCommands,
    FrontendApplicationContribution
} from '@theia/core/lib/browser';
import { EditorManager } from '@theia/editor/lib/browser';
import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';
import { StandaloneServices, StandaloneKeybindingService } from '@theia/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';
import { IKeybindingService } from '@theia/monaco-editor-core/esm/vs/platform/keybinding/common/keybinding';
import * as monaco from '@theia/monaco-editor-core';
import { NotepadiaCommands } from './notepadia-contribution';

/**
 * Bridges Notepad-style keybindings into the Monaco editor itself.
 *
 * Inside the Monaco editor, keypresses can take one of two paths:
 * the classic textarea (which fires DOM keydown events that Theia's
 * keybinding layer intercepts) or the newer native EditContext input
 * (which never dispatches keydown to the DOM, so Theia's layer cannot
 * see editor chords). Monaco-level dynamic keybindings cover both paths
 * and intentionally never double-fire: whenever Theia can dispatch the
 * event it stops propagation first; otherwise Monaco runs our handler.
 *
 * EditContext support exists in current Chromium builds, and Monaco opts
 * into it by default. Because that path hides editor chords from Theia,
 * every editor is forced back onto the classic textarea input by setting
 * the `editContext` editor option to false on each editor as it becomes
 * current.
 */
@injectable()
export class NotepadiaEditorKeybindingContribution implements FrontendApplicationContribution {

    constructor(
        @inject(CommandRegistry) protected readonly commandRegistry: CommandRegistry,
        @inject(EditorManager) protected readonly editorManager: EditorManager
    ) { }

    onStart(): void {
        this.editorManager.onCurrentEditorChanged(editor => {
            if (editor && editor.editor instanceof MonacoEditor) {
                const control = editor.editor.getControl();
                if (control) {
                    try {
                        control.updateOptions({ editContext: false });
                    } catch {
                        // editor may not be fully constructed yet
                    }
                }
            }
        });
        setTimeout(() => this.registerEditorKeybindings(), 1000);
    }

    protected registerEditorKeybindings(): void {
        try {
            const keybindingService = StandaloneServices.get(IKeybindingService);
            if (!(keybindingService instanceof StandaloneKeybindingService)) {
                setTimeout(() => this.registerEditorKeybindings(), 1000);
                return;
            }
            const add = (command: string, keybinding: number) => {
                keybindingService.addDynamicKeybinding(
                    command,
                    keybinding,
                    (_accessor: unknown, ...args: unknown[]) => this.commandRegistry.executeCommand(command, ...args),
                    undefined
                );
            };

            add(NotepadiaCommands.DUPLICATE_LINE.id, monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD);
            add(NotepadiaCommands.DELETE_LINE.id, monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyL);
            add(NotepadiaCommands.JOIN_LINES.id, monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyJ);
            add(NotepadiaCommands.UPPER_CASE.id, monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyU);
            add(NotepadiaCommands.LOWER_CASE.id, monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyU);
            add(NotepadiaCommands.FIND_NEXT.id, monaco.KeyCode.F3);
            add(NotepadiaCommands.FIND_PREVIOUS.id, monaco.KeyMod.Shift | monaco.KeyCode.F3);
            add(CommonCommands.SAVE_ALL.id, monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS);
            add(NotepadiaCommands.CLOSE_ALL.id, monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyW);
            add(NotepadiaCommands.NEW_DOCUMENT.id, monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyN);
            add(NotepadiaCommands.GO_TO_LINE.id, monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyG);
            add(NotepadiaCommands.ZOOM_IN.id, monaco.KeyMod.CtrlCmd | monaco.KeyCode.Equal);
            add(NotepadiaCommands.ZOOM_IN.id, monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Equal);
            add(NotepadiaCommands.ZOOM_OUT.id, monaco.KeyMod.CtrlCmd | monaco.KeyCode.Minus);
            add(NotepadiaCommands.ZOOM_RESET.id, monaco.KeyMod.CtrlCmd | monaco.KeyCode.Digit0);
        } catch (e) {
            setTimeout(() => this.registerEditorKeybindings(), 1000);
        }
    }
}