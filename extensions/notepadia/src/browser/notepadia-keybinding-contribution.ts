import { injectable } from '@theia/core/shared/inversify';
import {
    CommonCommands,
    KeybindingContribution,
    KeybindingRegistry
} from '@theia/core/lib/browser';
import { NotepadiaCommands } from './notepadia-contribution';
import { NotepadiaOvertypeCommands } from './notepadia-overtype-contribution';
import { NotepadiaFindCommands } from './notepadia-find-contribution';
import { NotepadiaLocalFileCommands } from './notepadia-local-files-contribution';
import { NotepadiaEditExtrasCommands } from './notepadia-edit-extras-contribution';
import {
    NotepadiaViewCommands,
    foldLevelCommandId,
    MAX_MONACO_FOLD_LEVEL
} from './notepadia-view-contribution';
import { NotepadiaSyncScrollCommands } from './notepadia-sync-scroll';

@injectable()
export class NotepadiaKeybindingContribution implements KeybindingContribution {
    registerKeybindings(keybindings: KeybindingRegistry): void {
        // D2 - chords the browser owns.
        //
        // Ctrl+N, Ctrl+W, Ctrl+T, Ctrl+Shift+N/T/W are browser accelerators.
        // The browser process consumes them before the page ever sees a
        // keydown, so binding them here changes nothing in the browser target
        // no matter how it is registered. Two things follow, and both are
        // done below:
        //
        //  - the Notepad++-native chord stays registered, because the
        //    packaged Electron app and an installed PWA DO receive it, and
        //    removing it would break the desktop build to fix a browser one;
        //  - every one of them also gets a chord the browser does not
        //    reserve, so a Notepad++ user is never left with a shortcut that
        //    silently does nothing.
        //
        // docs/usage.md carries the full table, including how each row was
        // determined.
        keybindings.registerKeybinding({
            command: NotepadiaCommands.NEW_DOCUMENT.id,
            keybinding: 'ctrlcmd+n'
        });
        keybindings.registerKeybinding({
            command: NotepadiaCommands.NEW_DOCUMENT.id,
            keybinding: 'ctrlcmd+alt+n'
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
            command: NotepadiaCommands.CLOSE_ALL.id,
            keybinding: 'ctrlcmd+alt+shift+w'
        });
        // Ctrl+F4 is Notepad++'s own second binding for Close, so this
        // alternate needs no explanation to anyone who knows the app.
        keybindings.registerKeybinding({
            command: NotepadiaCommands.CLOSE.id,
            keybinding: 'ctrlcmd+f4'
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
        // D1/D7: "Open from Computer" is the application's only Open, so it
        // keeps Notepad++'s Ctrl+O. The browser also claims Ctrl+O, so it
        // ships with Ctrl+Alt+O as a working alternate. Ctrl+Shift+O is
        // deliberately NOT bound: it is Chromium's bookmark-all-tabs and no
        // Notepad++ user arrives expecting it.
        keybindings.registerKeybinding({
            command: NotepadiaLocalFileCommands.OPEN_LOCAL.id,
            keybinding: 'ctrlcmd+o'
        });
        keybindings.registerKeybinding({
            command: NotepadiaLocalFileCommands.OPEN_LOCAL.id,
            keybinding: 'ctrlcmd+alt+o'
        });

        // -------------------------------------------------------------- C2
        // C2 chords are the ones Notepad++ users already have in their fingers
        // for these features, and each one needed a second binding for the same
        // reason as above: the browser claims the original.
        //
        // Ctrl+Alt+B is Begin/End Select. The browser does not claim it, so the
        // native chord is the only binding and it is always available.
        keybindings.registerKeybinding({
            command: NotepadiaEditExtrasCommands.BEGIN_END_SELECT.id,
            keybinding: 'ctrlcmd+alt+b',
            when: 'editorTextFocus'
        });
        // Alt+C opens Column Mode. Scoped to editorTextFocus because bare Alt is
        // a browser and OS accelerator in several places, and Column Mode with
        // no editor to apply it to has nothing to do.
        keybindings.registerKeybinding({
            command: NotepadiaEditExtrasCommands.COLUMN_MODE.id,
            keybinding: 'alt+c',
            when: 'editorTextFocus'
        });
        // F5 is Notepad++'s Date & Time (short) chord, and it is also the
        // browser's reload chord - and a reload loses unsaved work. Same rule
        // as the chords above: the native binding stays for the packaged app
        // and an installed PWA, and a browser-safe alternate is offered so a
        // Notepad++ user is never left with a shortcut that reloads the page.
        keybindings.registerKeybinding({
            command: NotepadiaEditExtrasCommands.DATE_TIME_SHORT.id,
            keybinding: 'f5',
            when: 'editorTextFocus'
        });
        keybindings.registerKeybinding({
            command: NotepadiaEditExtrasCommands.DATE_TIME_SHORT.id,
            keybinding: 'ctrlcmd+f5',
            when: 'editorTextFocus'
        });
        keybindings.registerKeybinding({
            command: NotepadiaEditExtrasCommands.DATE_TIME_SHORT.id,
            keybinding: 'ctrlcmd+alt+d',
            when: 'editorTextFocus'
        });
        keybindings.registerKeybinding({
            command: NotepadiaEditExtrasCommands.DATE_TIME_LONG.id,
            keybinding: 'ctrlcmd+alt+shift+d',
            when: 'editorTextFocus'
        });
        // Ctrl+Alt+R toggles the read-only flag, exactly as in Notepad++. The
        // browser does not claim it.
        keybindings.registerKeybinding({
            command: NotepadiaEditExtrasCommands.SET_READ_ONLY.id,
            keybinding: 'ctrlcmd+alt+r',
            when: 'editorTextFocus'
        });

        // C3 - Notepad++'s folding chords. Alt+0 folds everything, Alt+Shift+0
        // unfolds it, and Alt+1..7 fold to a given level.
        //
        // Notepad++ goes to level 8; Monaco only has folding actions for 1-7,
        // so 1-7 is what is bound and level 8 has no key (see
        // MAX_MONACO_FOLD_LEVEL).
        //
        // These are Monaco's own editor shortcuts (Ctrl+K Ctrl+0..7), so each
        // binding is scoped with `editorTextFocus` and registered here to win
        // inside the editor while leaving the chords free elsewhere - the same
        // arrangement the D2 rows above already use for Ctrl+D and Ctrl+L.
        keybindings.registerKeybinding({
            command: NotepadiaViewCommands.FOLD_ALL.id,
            keybinding: 'alt+0',
            when: 'editorTextFocus'
        });
        keybindings.registerKeybinding({
            command: NotepadiaViewCommands.UNFOLD_ALL.id,
            keybinding: 'alt+shift+0',
            when: 'editorTextFocus'
        });
        for (let level = 1; level <= MAX_MONACO_FOLD_LEVEL; level++) {
            keybindings.registerKeybinding({
                command: foldLevelCommandId(level),
                keybinding: `alt+${level}`,
                when: 'editorTextFocus'
            });
            keybindings.registerKeybinding({
                command: foldLevelCommandId(level),
                keybinding: `alt+shift+${level}`,
                when: 'editorTextFocus'
            });
        }

        // C3 - Full Screen and Post-It.
        //
        // F11 is a browser accelerator: the browser process enters its own full
        // screen before the page sees the key, so binding it changes nothing in
        // the browser target. The Notepad++-native binding is kept anyway
        // (the packaged Electron app and an installed PWA do receive it) and
        // Ctrl+Shift+F11 is added as the chord the browser does not reserve, so
        // the menu entry is never a shortcut that silently does nothing.
        //
        // F12 is *not* reserved in Chrome, Firefox or Edge, so it works as-is.
        keybindings.registerKeybinding({
            command: NotepadiaViewCommands.FULL_SCREEN.id,
            keybinding: 'f11'
        });
        keybindings.registerKeybinding({
            command: NotepadiaViewCommands.FULL_SCREEN.id,
            keybinding: 'ctrlcmd+shift+f11'
        });
        keybindings.registerKeybinding({
            command: NotepadiaViewCommands.POST_IT.id,
            keybinding: 'f12'
        });

        // The synchronize-scrolling toggles have no Notepad++ chord of their
        // own, so none is invented here.
        keybindings.registerKeybinding({
            command: NotepadiaSyncScrollCommands.SYNC_VERTICAL.id,
            keybinding: 'ctrlcmd+alt+shift+v',
            when: 'editorTextFocus'
        });
        keybindings.registerKeybinding({
            command: NotepadiaSyncScrollCommands.SYNC_HORIZONTAL.id,
            keybinding: 'ctrlcmd+alt+shift+h',
            when: 'editorTextFocus'
        });
    }
}
