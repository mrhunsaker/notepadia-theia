import { inject, injectable } from '@theia/core/shared/inversify';
import { ApplicationShell, WidgetManager } from '@theia/core/lib/browser';
import { Command, CommandContribution, CommandRegistry } from '@theia/core/lib/common';
import { NOTEPADIA_CLIPBOARD_HISTORY_ID } from './notepadia-clipboard-history-widget';
import { togglePanelWidget } from './notepadia-panel-toggle';

export namespace NotepadiaClipboardHistoryCommands {
    export const TOGGLE: Command = {
        id: 'notepadia.clipboardHistory.toggle',
        category: 'View',
        label: 'Clipboard History'
    };
}

/**
 * The Clipboard History command, kept apart from the widget so the widget does
 * not have to know which panel it belongs in. Its Edit-menu entry is registered
 * by `NotepadiaMenuContribution`, at Notepad++'s position.
 */
@injectable()
export class NotepadiaClipboardHistoryContribution implements CommandContribution {

    constructor(
        @inject(WidgetManager) protected readonly widgetManager: WidgetManager,
        @inject(ApplicationShell) protected readonly shell: ApplicationShell
    ) { }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(NotepadiaClipboardHistoryCommands.TOGGLE, {
            isToggled: () => this.isVisible(),
            execute: () => this.toggle()
        });
    }

    protected isVisible(): boolean {
        const widget = this.widgetManager.tryGetWidget(NOTEPADIA_CLIPBOARD_HISTORY_ID);
        if (!widget) {
            return false;
        }
        const area = this.shell.getAreaFor(widget);
        return !!area && this.shell.isExpanded(area) && widget.isVisible;
    }

    protected async toggle(): Promise<void> {
        await togglePanelWidget(this.widgetManager, this.shell, NOTEPADIA_CLIPBOARD_HISTORY_ID);
    }
}
