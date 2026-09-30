import { ApplicationShell, WidgetManager } from '@theia/core/lib/browser';

/**
 * Show a panel widget if it is not on screen, hide it if it is.
 *
 * "Hidden" is not one state but three - never opened, open in a collapsed
 * panel, and open and showing - and the right response to a click is the same
 * for all of them, so both panel commands in this app call this instead of
 * working out the state again.
 */
export async function togglePanelWidget(widgetManager: WidgetManager, shell: ApplicationShell, widgetId: string): Promise<void> {
    const widget = await widgetManager.getOrCreateWidget(widgetId);
    const tabBar = shell.getTabBarFor(widget);
    const area = shell.getAreaFor(widget);
    if (!tabBar) {
        // Never opened, or detached: there is nothing to close, so reveal it.
        // `addWidget` alone only files the tab; the widget has to be activated
        // or the panel it landed in stays collapsed and nothing is visible.
        await shell.addWidget(widget, { area: 'right', rank: 1001 });
        await shell.activateWidget(widget.id);
        return;
    }
    if (area && shell.isExpanded(area) && tabBar.currentTitle === widget.title) {
        switch (area) {
            case 'left':
            case 'right':
                await shell.collapsePanel(area);
                return;
            case 'bottom':
                if (shell.bottomAreaTabBars.length === 1) {
                    await shell.collapsePanel('bottom');
                    return;
                }
                break;
            default:
                await shell.closeWidget(widget.id);
                return;
        }
    }
    // A background tab in the same panel, or a collapsed panel: bring it
    // forward, and expanding the panel if that is what it takes.
    if (widget.isAttached) {
        await shell.activateWidget(widget.id);
    } else {
        await shell.revealWidget(widget.id);
    }
}
