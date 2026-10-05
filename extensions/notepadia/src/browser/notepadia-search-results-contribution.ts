import { injectable, inject } from '@theia/core/shared/inversify';
import { KeybindingContribution, KeybindingRegistry } from '@theia/core/lib/browser';
import { WidgetManager } from '@theia/core/lib/browser/widget-manager';
import { MenuContribution, MenuModelRegistry } from '@theia/core/lib/common';
import { Command, CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import { NotepadiaSearchResultsWidget } from './notepadia-search-results-widget';

export namespace NotepadiaSearchResultsCommands {

    /**
     * F7 in Notepad++ toggles the Search Results window, so the binding is on
     * the command rather than on the widget: the panel is created on demand by
     * the first Find All and this command has to work before that.
     */
    export const TOGGLE: Command = { id: 'notepadia.searchResults.toggle', label: 'Search Results Window' };

    /** F4 / Shift+F4 step through hits with the editor focused. */
    export const NEXT: Command = { id: 'notepadia.searchResults.next', label: 'Next Search Result' };
    export const PREVIOUS: Command = { id: 'notepadia.searchResults.previous', label: 'Previous Search Result' };

    export const CLEAR_ALL: Command = { id: 'notepadia.searchResults.clearAll', label: 'Clear All Search Results' };
}

@injectable()
export class NotepadiaSearchResultsContribution implements CommandContribution, MenuContribution, KeybindingContribution {

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(NotepadiaSearchResultsCommands.TOGGLE, {
            execute: () => this.toggle()
        });
        commands.registerCommand(NotepadiaSearchResultsCommands.NEXT, {
            execute: () => this.withWidget(widget => widget.nextResult())
        });
        commands.registerCommand(NotepadiaSearchResultsCommands.PREVIOUS, {
            execute: () => this.withWidget(widget => widget.previousResult())
        });
        commands.registerCommand(NotepadiaSearchResultsCommands.CLEAR_ALL, {
            execute: () => this.withWidget(widget => widget.clearAll())
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        // Notepad++'s Search menu ends with Matching Bracket; the results
        // window and its navigation sit directly after it, which is where the
        // F7 and F4 bindings are discoverable from.
        const search = ['menubar', '3_search'];
        menus.registerMenuAction(search, {
            commandId: NotepadiaSearchResultsCommands.TOGGLE.id,
            label: 'Search Results Window',
            order: 'j'
        });
        menus.registerMenuAction(search, {
            commandId: NotepadiaSearchResultsCommands.NEXT.id,
            label: 'Next Search Result',
            order: 'k'
        });
        menus.registerMenuAction(search, {
            commandId: NotepadiaSearchResultsCommands.PREVIOUS.id,
            label: 'Previous Search Result',
            order: 'l'
        });
        menus.registerMenuAction(search, {
            commandId: NotepadiaSearchResultsCommands.CLEAR_ALL.id,
            label: 'Clear All Search Results',
            order: 'm'
        });
    }

    registerKeybindings(keybindings: KeybindingRegistry): void {
        keybindings.registerKeybinding({
            command: NotepadiaSearchResultsCommands.TOGGLE.id,
            keybinding: 'f7'
        });
        keybindings.registerKeybinding({
            command: NotepadiaSearchResultsCommands.NEXT.id,
            keybinding: 'f4'
        });
        keybindings.registerKeybinding({
            command: NotepadiaSearchResultsCommands.PREVIOUS.id,
            keybinding: 'shift+f4'
        });
    }

    constructor(@inject(WidgetManager) protected readonly widgetManager: WidgetManager) { }

    /**
     * F7 shows a window that has never been opened and hides one that is, so
     * the widget is created on demand here instead of assuming a Find All ran
     * first.
     */
    protected async toggle(): Promise<void> {
        const widget = await this.widget();
        if (!widget) {
            return;
        }
        if (widget.isVisible) {
            widget.hide();
        } else {
            await widget.open();
        }
    }

    protected async withWidget(action: (widget: NotepadiaSearchResultsWidget) => void | Promise<void>): Promise<void> {
        const widget = await this.widget();
        if (widget) {
            await action(widget);
        }
    }

    /**
     * The widget behind {@link NotepadiaSearchResultsWidget.ID}, created on
     * demand. getOrCreateWidget is what guarantees this is the same instance
     * the WidgetFactory registered and the Find dialog publishes into.
     */
    protected async widget(): Promise<NotepadiaSearchResultsWidget | undefined> {
        const widget = await this.widgetManager.getOrCreateWidget(NotepadiaSearchResultsWidget.ID);
        return widget instanceof NotepadiaSearchResultsWidget ? widget : undefined;
    }
}