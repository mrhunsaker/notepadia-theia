import { inject, injectable } from '@theia/core/shared/inversify';
import { DisposableCollection } from '@theia/core/lib/common/disposable';
import {
    Command,
    CommandContribution,
    CommandRegistry
} from '@theia/core/lib/common/command';
import { CommonCommands } from '@theia/core/lib/browser';
import { NotepadiaCommands } from './notepadia-contribution';
import { NotepadiaSearchMarkCommands } from './notepadia-search-mark';
import { NotepadiaFindDialog } from './notepadia-find-dialog';

/**
 * Commands that open the Notepad++ tabbed Find dialog on a specific tab. The
 * Search menu and the Ctrl+F / Ctrl+H / Ctrl+Shift+F / Ctrl+M keybindings all
 * funnel through these (or through overridden core/Monaco command handlers),
 * so every entry point shows exactly the same dialog.
 */
export namespace NotepadiaFindCommands {
    export const OPEN: Command = { id: 'notepadia.find.open', label: 'Find...' };
    export const OPEN_REPLACE: Command = { id: 'notepadia.find.openReplace', label: 'Replace...' };
    export const OPEN_FILES: Command = { id: 'notepadia.find.openFiles', label: 'Find in Files' };
    export const OPEN_MARK: Command = { id: 'notepadia.find.openMark', label: 'Mark...' };
    export const CLOSE: Command = { id: 'notepadia.find.close', label: 'Close Find' };
}

/**
 * B2 - routes every "find" entry point to the Notepad++ tabbed dialog.
 *
 * The core `find` / `replace` commands are registered by `@theia/monaco` with
 * handlers that open Monaco's inline find widget. `CommandRegistry.registerHandler`
 * unshifts, so the handlers registered here (later during application startup)
 * take precedence and the inline widget is never shown; the same trick routes
 * the search-in-workspace commands and the F3 / Shift+F3 continuation so that
 * keyboard, menu and dialog all stay in sync.
 */
@injectable()
export class NotepadiaFindContribution implements CommandContribution {

    protected readonly toDispose = new DisposableCollection();

    constructor(
        @inject(NotepadiaFindDialog) protected readonly dialog: NotepadiaFindDialog
    ) { }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(NotepadiaFindCommands.OPEN, {
            isEnabled: () => this.dialog.canFind(),
            execute: () => this.dialog.open('find')
        });
        commands.registerCommand(NotepadiaFindCommands.OPEN_REPLACE, {
            isEnabled: () => this.dialog.canFind(),
            execute: () => this.dialog.open('replace')
        });
        // Find in Files searches the workspace, not the current document, so it
        // stays available with no editor open - as it is in Notepad++.
        commands.registerCommand(NotepadiaFindCommands.OPEN_FILES, {
            execute: () => this.dialog.open('files')
        });
        commands.registerCommand(NotepadiaFindCommands.OPEN_MARK, {
            isEnabled: () => this.dialog.canFind(),
            execute: () => this.dialog.open('mark')
        });
        commands.registerCommand(NotepadiaFindCommands.CLOSE, {
            execute: () => this.dialog.close()
        });

        // Monaco's inline find widget, replaced by the dialog.
        this.toDispose.push(commands.registerHandler(CommonCommands.FIND.id, {
            isEnabled: () => this.dialog.canFind(),
            execute: () => this.dialog.open('find')
        }));
        this.toDispose.push(commands.registerHandler(CommonCommands.REPLACE.id, {
            isEnabled: () => this.dialog.canFind(),
            execute: () => this.dialog.open('replace')
        }));

        // Theia's standalone file-search panels: open the dialog's Find tab.
        this.toDispose.push(commands.registerHandler('search-in-workspace.open', {
            execute: () => this.dialog.open('files')
        }));
        this.toDispose.push(commands.registerHandler('search-in-workspace.replace', {
            execute: () => this.dialog.open('files', true)
        }));

        // F3 / Shift+F3 continue the last search even with the dialog closed.
        this.toDispose.push(commands.registerHandler(NotepadiaCommands.FIND_NEXT.id, {
            isEnabled: () => this.dialog.canFind(),
            execute: () => this.dialog.continueFindNext()
        }));
        this.toDispose.push(commands.registerHandler(NotepadiaCommands.FIND_PREVIOUS.id, {
            isEnabled: () => this.dialog.canFind(),
            execute: () => this.dialog.continueFindPrevious()
        }));

        // Notepad++ runs the Mark submenu's entries through the Find dialog:
        // the dialog opens on its Mark tab and the action fires. Registering
        // the handlers here (rather than in the Mark contribution) is what
        // keeps that single behaviour for the menu, the toolbar and Ctrl+M.
        this.toDispose.push(commands.registerHandler(NotepadiaSearchMarkCommands.MARK_ALL.id, {
            isEnabled: () => this.dialog.canFind(),
            execute: () => this.dialog.runMarkAction('mark')
        }));
        this.toDispose.push(commands.registerHandler(NotepadiaSearchMarkCommands.CLEAR.id, {
            isEnabled: () => this.dialog.canFind(),
            execute: () => this.dialog.runMarkAction('clear')
        }));
        this.toDispose.push(commands.registerHandler(NotepadiaSearchMarkCommands.SELECT_FIND_NEXT.id, {
            isEnabled: () => this.dialog.canFind(),
            execute: () => this.dialog.runMarkAction('select')
        }));
        this.toDispose.push(commands.registerHandler(NotepadiaSearchMarkCommands.MARK.id, {
            isEnabled: () => this.dialog.canFind(),
            execute: () => this.dialog.runMarkAction('mark')
        }));
    }
}
