import { inject, injectable } from '@theia/core/shared/inversify';
import { ApplicationShell, WidgetManager } from '@theia/core/lib/browser';
import { Command, CommandContribution, CommandRegistry, MenuContribution, MenuModelRegistry } from '@theia/core/lib/common';
import { CommonMenus } from '@theia/core/lib/browser';
import { NotepadiaCharacterPanelWidget } from './notepadia-character-panel-widget';

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
        const widget = await this.widgetManager.getOrCreateWidget(NotepadiaCharacterPanelWidget.ID);
        const tabBar = this.shell.getTabBarFor(widget);
        const area = this.shell.getAreaFor(widget);
        if (!tabBar) {
            await this.shell.addWidget(widget, { area: 'right', rank: 1001 });
        } else if (area && this.shell.isExpanded(area) && tabBar.currentTitle === widget.title) {
            switch (area) {
                case 'left':
                case 'right':
                    await this.shell.collapsePanel(area);
                    return;
                case 'bottom':
                    if (this.shell.bottomAreaTabBars.length === 1) {
                        await this.shell.collapsePanel('bottom');
                        return;
                    }
                    break;
                default:
                    await this.shell.closeWidget(widget.id);
                    return;
            }
        }
        if (widget.isAttached) {
            await this.shell.activateWidget(widget.id);
        } else {
            await this.shell.revealWidget(widget.id);
        }
    }
}