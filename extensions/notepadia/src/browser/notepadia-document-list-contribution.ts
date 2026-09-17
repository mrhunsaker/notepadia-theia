import { inject, injectable } from '@theia/core/shared/inversify';
import { ApplicationShell, WidgetManager } from '@theia/core/lib/browser';
import { Command, CommandContribution, CommandRegistry, MenuContribution, MenuModelRegistry } from '@theia/core/lib/common';
import { CommonMenus } from '@theia/core/lib/browser';
import { NotepadiaDocumentListWidget } from './notepadia-document-list-widget';

export namespace NotepadiaDocumentListCommands {
    export const TOGGLE: Command = {
        id: 'notepadia.documentList.toggle',
        category: 'View',
        label: 'Document List'
    };
}

@injectable()
export class NotepadiaDocumentListContribution implements CommandContribution, MenuContribution {

    constructor(
        @inject(WidgetManager) protected readonly widgetManager: WidgetManager,
        @inject(ApplicationShell) protected readonly shell: ApplicationShell
    ) { }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(NotepadiaDocumentListCommands.TOGGLE, {
            isToggled: () => this.isVisible(),
            execute: () => this.toggle()
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction([...CommonMenus.VIEW], {
            commandId: NotepadiaDocumentListCommands.TOGGLE.id,
            label: 'Document List',
            order: '0a'
        });
    }

    protected isVisible(): boolean {
        const widget = this.widgetManager.tryGetWidget(NotepadiaDocumentListWidget.ID);
        if (!widget) {
            return false;
        }
        const area = this.shell.getAreaFor(widget);
        return !!area && this.shell.isExpanded(area) && widget.isVisible;
    }

    protected async toggle(): Promise<void> {
        const widget = await this.widgetManager.getOrCreateWidget(NotepadiaDocumentListWidget.ID);
        const tabBar = this.shell.getTabBarFor(widget);
        const area = this.shell.getAreaFor(widget);
        if (!tabBar) {
            await this.shell.addWidget(widget, { area: 'right', rank: 1000 });
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