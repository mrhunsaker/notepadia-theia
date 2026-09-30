import { inject, injectable } from '@theia/core/shared/inversify';
import { ApplicationShell, WidgetManager } from '@theia/core/lib/browser';
import { Command, CommandContribution, CommandRegistry, MenuContribution, MenuModelRegistry } from '@theia/core/lib/common';
import { CommonMenus } from '@theia/core/lib/browser';
import { NotepadiaCharacterPanelWidget } from './notepadia-character-panel-widget';
import { togglePanelWidget } from './notepadia-panel-toggle';

export namespace NotepadiaCharacterPanelCommands {
    export const TOGGLE: Command = {
        id: 'notepadia.characterPanel.toggle',
        category: 'View',
        label: 'Character Panel'
    };
}

@injectable()
export class NotepadiaCharacterPanelContribution implements CommandContribution, MenuContribution {

    constructor(
        @inject(WidgetManager) protected readonly widgetManager: WidgetManager,
        @inject(ApplicationShell) protected readonly shell: ApplicationShell
    ) { }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(NotepadiaCharacterPanelCommands.TOGGLE, {
            isToggled: () => this.isVisible(),
            execute: () => this.toggle()
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction([...CommonMenus.VIEW], {
            commandId: NotepadiaCharacterPanelCommands.TOGGLE.id,
            label: 'Character Panel',
            order: '0b'
        });
    }

    protected isVisible(): boolean {
        const widget = this.widgetManager.tryGetWidget(NotepadiaCharacterPanelWidget.ID);
        if (!widget) {
            return false;
        }
        const area = this.shell.getAreaFor(widget);
        return !!area && this.shell.isExpanded(area) && widget.isVisible;
    }

    protected async toggle(): Promise<void> {
        await togglePanelWidget(this.widgetManager, this.shell, NotepadiaCharacterPanelWidget.ID);
    }
}