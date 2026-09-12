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
        keybindings.registerKeybinding({
            command: NotepadiaCommands.DUPLICATE_LINE.id,
            keybinding: 'ctrlcmd+d'
        });
        keybindings.registerKeybinding({
            command: NotepadiaCommands.DELETE_LINE.id,
            keybinding: 'ctrlcmd+l'
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
            command: NotepadiaCommands.FIND_NEXT.id,
            keybinding: 'f3'
        });
        keybindings.registerKeybinding({
            command: NotepadiaCommands.FIND_PREVIOUS.id,
            keybinding: 'shift+f3'
        });
    }
}
