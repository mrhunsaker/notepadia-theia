import { inject, injectable } from '@theia/core/shared/inversify';
import { ApplicationShell, CommonMenus, WidgetManager } from '@theia/core/lib/browser';
import { Command, CommandContribution, CommandRegistry, MenuContribution, MenuModelRegistry } from '@theia/core/lib/common';
import { NotepadiaFunctionListWidget } from './notepadia-function-list-widget';
import { togglePanelWidget } from './notepadia-panel-toggle';

export namespace NotepadiaFunctionListCommands {
    export const TOGGLE: Command = {
        id: 'notepadia.functionList.toggle',
        category: 'View',
        label: 'Function List'
    };
}

/**
 * `View > Function List` (E1).
 *
 * The panel is created on first use through the widget manager, exactly as the
 * Document List and Character Panel are, so the toggle works before the panel
 * has ever been opened and `isToggled` can answer from the shell.
 */
@injectable()
export class NotepadiaFunctionListContribution implements CommandContribution, MenuContribution {

    constructor(
        @inject(WidgetManager) protected readonly widgetManager: WidgetManager,
        @inject(ApplicationShell) protected readonly shell: ApplicationShell
    ) { }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(NotepadiaFunctionListCommands.TOGGLE, {
            isToggled: () => this.isVisible(),
            execute: () => this.toggle()
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction([...CommonMenus.VIEW], {
            commandId: NotepadiaFunctionListCommands.TOGGLE.id,
            label: 'Function List',
            // Next to Document Map, which is the other view-only panel.
            order: '0c'
        });
    }

    protected isVisible(): boolean {
        const widget = this.widgetManager.tryGetWidget(NotepadiaFunctionListWidget.ID);
        if (!widget) {
            return false;
        }
        const area = this.shell.getAreaFor(widget);
        return !!area && this.shell.isExpanded(area) && widget.isVisible;
    }

    protected async toggle(): Promise<void> {
        await togglePanelWidget(this.widgetManager, this.shell, NotepadiaFunctionListWidget.ID);
    }
}
