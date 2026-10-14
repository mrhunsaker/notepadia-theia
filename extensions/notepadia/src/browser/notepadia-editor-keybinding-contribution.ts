import { inject, injectable } from '@theia/core/shared/inversify';
import { CommandRegistry } from '@theia/core/lib/common';
import { DisposableCollection } from '@theia/core/lib/common/disposable';
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
import { NotepadiaFindCommands } from './notepadia-find-contribution';

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

    /**
     * How many times to wait one second for Monaco's standalone keybinding
     * service to appear before giving up. The service is normally ready almost
     * immediately; the cap only stops a missing service from spinning a timer
     * for the life of the page.
     */
    protected static readonly MAX_REGISTER_ATTEMPTS = 30;

    protected readonly toDispose = new DisposableCollection();
    protected registerAttempts = 0;
    protected retryTimer: ReturnType<typeof setTimeout> | undefined;

    constructor(
        @inject(CommandRegistry) protected readonly commandRegistry: CommandRegistry,
        @inject(EditorManager) protected readonly editorManager: EditorManager
    ) { }

    onStart(): void {
        this.toDispose.push(this.editorManager.onCurrentEditorChanged(editor => {
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
        }));
        this.installFindKeyInterceptor();
        this.scheduleRegisterEditorKeybindings();
    }

    onStop(): void {
        if (this.retryTimer !== undefined) {
            clearTimeout(this.retryTimer);
            this.retryTimer = undefined;
        }
        this.toDispose.dispose();
    }

    protected scheduleRegisterEditorKeybindings(): void {
        if (this.registerAttempts >= NotepadiaEditorKeybindingContribution.MAX_REGISTER_ATTEMPTS) {
            return;
        }
        this.registerAttempts++;
        if (this.retryTimer !== undefined) {
            clearTimeout(this.retryTimer);
        }
        this.retryTimer = setTimeout(() => {
            this.retryTimer = undefined;
            this.registerEditorKeybindings();
        }, 1000);
    }

    /**
     * Install the capture-phase Ctrl+F / Ctrl+H interceptor exactly once.
     *
     * See registerEditorKeybindings() for why these two chords cannot go
     * through a dynamic keybinding rule. Registering here (rather than inside
     * the retried keybinding setup) means the listener is never added twice and
     * is removed again on stop.
     */
    protected installFindKeyInterceptor(): void {
        const handler = (event: KeyboardEvent): void => {
            if (!(event.ctrlKey || event.metaKey) || event.altKey) {
                return;
            }
            const key = event.key.toLowerCase();
            if (key === 'f' && !event.shiftKey) {
                event.preventDefault();
                event.stopImmediatePropagation();
                this.commandRegistry.executeCommand(CommonCommands.FIND.id);
            } else if (key === 'h' && !event.shiftKey) {
                event.preventDefault();
                event.stopImmediatePropagation();
                this.commandRegistry.executeCommand(CommonCommands.REPLACE.id);
            }
        };
        document.addEventListener('keydown', handler, true);
        this.toDispose.push({ dispose: () => document.removeEventListener('keydown', handler, true) });
    }

    protected registerEditorKeybindings(): void {
        try {
            const keybindingService = StandaloneServices.get(IKeybindingService);
            if (!(keybindingService instanceof StandaloneKeybindingService)) {
                this.scheduleRegisterEditorKeybindings();
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
            // An alias command id routes the chord to an existing Theia command.
            // `core.find` / `core.replace` are already registered in the Monaco
            // CommandsRegistry (with handlers that open the inline find widget),
            // and `CommandsRegistry.registerCommand` silently keeps the first
            // registration, so the dynamic rule must target a fresh id instead.
            const alias = (aliasId: string, command: string, keybinding: number) => {
                keybindingService.addDynamicKeybinding(
                    aliasId,
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
            add(NotepadiaCommands.MATCHING_BRACKET.id, monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyE);
            // Steal the find chords from Monaco's own inline find widget so they
            // drive the Notepad++ tabbed dialog instead. The widget grabs
            // Ctrl+F / Ctrl+H at its own DOM listener with a precedence no
            // keybinding rule can beat (it swallows the event before Theia's
            // layer ever sees it), so intercept the two chords in the document
            // capture phase - which runs before that listener - and re-dispatch
            // them as the core find / replace commands, whose handlers are
            // overridden to open the dialog. Both chords are intercepted
            // globally (Notepad++ semantics): from an editor, from one of the
            // dialog's own inputs, or from anywhere else in the workbench.
            // The interceptor itself is installed once, in
            // installFindKeyInterceptor(). Ctrl+Shift+F and Ctrl+M have no
            // competing native binding, so a plain dynamic rule suffices there.
            alias('notepadia.keybinding.findInFiles', NotepadiaFindCommands.OPEN_FILES.id, monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF);
            alias('notepadia.keybinding.mark', NotepadiaFindCommands.OPEN_MARK.id, monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyM);
            add(NotepadiaCommands.ZOOM_IN.id, monaco.KeyMod.CtrlCmd | monaco.KeyCode.Equal);
            add(NotepadiaCommands.ZOOM_IN.id, monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Equal);
            add(NotepadiaCommands.ZOOM_OUT.id, monaco.KeyMod.CtrlCmd | monaco.KeyCode.Minus);
            add(NotepadiaCommands.ZOOM_RESET.id, monaco.KeyMod.CtrlCmd | monaco.KeyCode.Digit0);
        } catch {
            this.scheduleRegisterEditorKeybindings();
        }
    }
}