import { injectable } from '@theia/core/shared/inversify';
import {
    CommonCommands,
    KeybindingContribution,
    KeybindingRegistry
} from '@theia/core/lib/browser';
import { NotepadiaCommands } from './notepadia-contribution';
import { NotepadiaOvertypeCommands } from './notepadia-overtype-contribution';
import { NotepadiaFindCommands } from './notepadia-find-contribution';

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
        // Ctrl+H mirrors Notepad++'s Replace dialog tab. Monaco natively binds
        // Ctrl+H to startFindReplaceAction (inline widget); registering `replace`
        // here lets the Theia keybinding supersede Monaco's native binding so
        // the inline widget can never appear.
        keybindings.registerKeybinding({
            command: CommonCommands.REPLACE.id,
            keybinding: 'ctrlcmd+h'
        });
        // Ctrl+Shift+F mirrors Notepad++'s Find in Files tab of the dialog.
        keybindings.registerKeybinding({
            command: NotepadiaFindCommands.OPEN_FILES.id,
            keybinding: 'ctrlcmd+shift+f'
        });
        // Ctrl+M mirrors Notepad++'s Mark dialog tab.
        keybindings.registerKeybinding({
            command: NotepadiaFindCommands.OPEN_MARK.id,
            keybinding: 'ctrlcmd+m'
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
        // The Insert key toggles Notepad++'s INS/OVR overtype mode.
        keybindings.registerKeybinding({
            command: NotepadiaOvertypeCommands.TOGGLE_OVERTYPE.id,
            keybinding: 'insert',
            when: 'editorTextFocus'
        });
        // D1 deliberately registers NO chord for Open From This Computer... .
        // Notepad++ uses Ctrl+O, but the browser claims Ctrl+O and Ctrl+Shift+O
        // itself (the latter is Chromium's bookmark-all-tabs) and a web page
        // cannot intercept either. Inventing a different chord would trade one
        // browser conflict for another, so the command stays menu-only until
        // the keybinding-conflict pass (D2) decides how to handle it.
    }
}
