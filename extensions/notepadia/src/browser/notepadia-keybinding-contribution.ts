import { injectable } from '@theia/core/shared/inversify';
import {
    CommonCommands,
    KeybindingContribution,
    KeybindingRegistry
} from '@theia/core/lib/browser';
import { NotepadiaCommands } from './notepadia-contribution';

@injectable()
export class NotepadiaKeybindingContribution implements KeybindingContribution {
    registerKeybindings(keybindings: KeybindingRegistry): void {
        keybindings.registerKeybinding({
            command: NotepadiaCommands.NEW_DOCUMENT.id,
            keybinding: 'ctrlcmd+n'
        });
        keybindings.registerKeybinding({
            command: CommonCommands.SAVE_ALL.id,
            keybinding: 'ctrlcmd+shift+s'
        });
        keybindings.registerKeybinding({
            command: NotepadiaCommands.CLOSE_ALL.id,
            keybinding: 'ctrlcmd+shift+w'
        });
        // Ctrl+D (Monaco "select next occurrence") and Ctrl+L (Monaco
        // "expand line selection") collide with Monaco's default editor
        // keybindings, which Theia mirrors into its own keybinding registry
        // scoped with an editorTextFocus `when` clause. Our bindings are
        // registered later (higher priority) and use the same editorTextFocus
        // `when`, so the keybinding tree picks ours first inside the editor
        // while leaving the chords free elsewhere.
        keybindings.registerKeybinding({
            command: NotepadiaCommands.DUPLICATE_LINE.id,
            keybinding: 'ctrlcmd+d',
            when: 'editorTextFocus'
        });
        keybindings.registerKeybinding({
            command: NotepadiaCommands.DELETE_LINE.id,
            keybinding: 'ctrlcmd+l',
            when: 'editorTextFocus'
        });
        keybindings.registerKeybinding({
            command: NotepadiaCommands.JOIN_LINES.id,
            keybinding: 'ctrlcmd+j'
        });
        keybindings.registerKeybinding({
            command: NotepadiaCommands.UPPER_CASE.id,
            keybinding: 'ctrlcmd+shift+u'
        });
        keybindings.registerKeybinding({
            command: NotepadiaCommands.LOWER_CASE.id,
            keybinding: 'ctrlcmd+u',
            when: 'editorTextFocus'
        });
        keybindings.registerKeybinding({
            command: NotepadiaCommands.FIND_NEXT.id,
            keybinding: 'f3'
        });
        keybindings.registerKeybinding({
            command: NotepadiaCommands.FIND_PREVIOUS.id,
            keybinding: 'shift+f3'
        });
        // Ctrl+Shift+H mirrors Notepad++'s Replace in Files (opens Theia's
        // search widget with the replace field active).
        keybindings.registerKeybinding({
            command: 'search-in-workspace.replace',
            keybinding: 'ctrlcmd+shift+h'
        });
        keybindings.registerKeybinding({
            command: NotepadiaCommands.GO_TO_LINE.id,
            keybinding: 'ctrlcmd+g'
        });
        // Ctrl+Shift+E mirrors Notepad++'s jump-to-matching-bracket.
        keybindings.registerKeybinding({
            command: NotepadiaCommands.MATCHING_BRACKET.id,
            keybinding: 'ctrlcmd+shift+e',
            when: 'editorTextFocus'
        });
        keybindings.registerKeybinding({
            command: NotepadiaCommands.ZOOM_IN.id,
            keybinding: 'ctrlcmd+='
        });
        keybindings.registerKeybinding({
            command: NotepadiaCommands.ZOOM_OUT.id,
            keybinding: 'ctrlcmd+-'
        });
        keybindings.registerKeybinding({
            command: NotepadiaCommands.ZOOM_RESET.id,
            keybinding: 'ctrlcmd+0'
        });
    }
}
