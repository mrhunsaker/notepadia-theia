import { inject, injectable } from '@theia/core/shared/inversify';
import { FrontendApplication, FrontendApplicationContribution, Widget } from '@theia/core/lib/browser';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { Command, CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import { MenuContribution, MenuModelRegistry } from '@theia/core/lib/common/menu';
import { CommonMenus } from '@theia/core/lib/browser/common-menus';
import { StatusBar } from '@theia/core/lib/browser/status-bar/status-bar';
import { PreferenceService } from '@theia/core/lib/common/preferences';
import { NOTEPADIA_TAB_ID_PREFIX } from './notepadia-tab-decorator';

export const NOTEPADIA_TOOLBAR_VISIBLE_PREFERENCE = 'notepadia.toolbar.visible';
/** Draw a close button on every tab (A4); when disabled it only shows on the active tab. */
export const NOTEPADIA_DRAW_CLOSE_BUTTON_PREFERENCE = 'notepadia.tabBar.drawCloseButton';

/**
 * Body classes owned by the shell layer. `notepadia-chrome` gates the
 * Notepad++-shaped chrome rules in style/notepadia-shell.css so the hidden
 * chrome can be brought back for debugging by dropping the class.
 */
export const NOTEPADIA_CHROME_CLASS = 'notepadia-chrome';
export const NOTEPADIA_STATUS_BAR_HIDDEN_CLASS = 'notepadia-statusbar-hidden';
export const NOTEPADIA_TAB_CLOSE_ALL_CLASS = 'notepadia-tabclose-all';

export namespace NotepadiaShellCommands {
    export const TOGGLE_FOLDER_WORKSPACE: Command = {
        id: 'notepadia.view.toggleFolderWorkspace',
        label: 'Folder as Workspace'
    };
    export const TOGGLE_TOOLBAR: Command = {
        id: 'notepadia.view.toggleToolbar',
        label: 'Toolbar'
    };
    export const TOGGLE_STATUS_BAR: Command = {
        id: 'notepadia.view.toggleStatusBar',
        label: 'Status Bar'
    };
    export const TOGGLE_DRAW_CLOSE_BUTTON: Command = {
        id: 'notepadia.view.toggleDrawCloseButton',
        label: 'Draw Close Button'
    };
}

/**
 * Shapes the browser shell into the Notepad++ window surface: no VS Code
 * activity bars, no right-hand panel, no breadcrumbs, a minimal status bar,
 * and View-menu toggles that drive the folder panel (and the toolbar/status
 * bar chrome that A3 and A5 build on).
 */
@injectable()
export class NotepadiaShellContribution implements FrontendApplicationContribution, CommandContribution, MenuContribution {

    /** Status bar elements contributed by @theia that have no Notepad++ analogue. */
    protected static readonly CHROME_STATUS_BAR_ELEMENTS = [
        'problem-marker-status',
        'theia-notification-center',
        'bottom-panel-toggle'
    ];

    constructor(
        @inject(ApplicationShell) protected readonly shell: ApplicationShell,
        @inject(StatusBar) protected readonly statusBar: StatusBar,
        @inject(PreferenceService) protected readonly preferenceService: PreferenceService
    ) { }

    async onStart(_app: FrontendApplication): Promise<void> {
        document.body.classList.add(NOTEPADIA_CHROME_CLASS);
        // The markers/notification/bottom-panel contributions register their
        // status bar elements on contribution start; remove them once the
        // workbench has settled in.
        window.setTimeout(() => {
            for (const id of NotepadiaShellContribution.CHROME_STATUS_BAR_ELEMENTS) {
                this.statusBar.removeElement(id).catch(() => { });
            }
        }, 0);

        // A4 - middle-clicking a tab closes it (mouse buttons 2+ are reported
        // through the `auxclick` event). Capture so the close happens even when
        // a child of the tab handles the click.
        document.addEventListener('auxclick', this.handleAuxClick, true);

        // A4 - View > Tab Bar > Draw Close Button.
        this.applyDrawCloseButton(this.preferenceService.get<boolean>(NOTEPADIA_DRAW_CLOSE_BUTTON_PREFERENCE, true));
        this.preferenceService.onPreferenceChanged(event => {
            if (event.preferenceName === NOTEPADIA_DRAW_CLOSE_BUTTON_PREFERENCE) {
                this.applyDrawCloseButton(this.preferenceService.get<boolean>(NOTEPADIA_DRAW_CLOSE_BUTTON_PREFERENCE, true));
            }
        });
    }

    /** Middle click anywhere on a tab closes that tab (Notepad++ behavior). */
    protected readonly handleAuxClick = (event: MouseEvent): void => {
        if (event.button !== 1) {
            return;
        }
        const tab = event.target instanceof Element ? event.target.closest<HTMLElement>('.lm-TabBar-tab') : undefined;
        if (!tab) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        const tabId = tab.id || '';
        if (!tabId.startsWith(NOTEPADIA_TAB_ID_PREFIX)) {
            return;
        }
        this.closeTab(tabId.slice(NOTEPADIA_TAB_ID_PREFIX.length));
    };

    /** Close a widget by id through the shell (which prompts when the tab is dirty). */
    protected closeTab(widgetId: string): void {
        const widget: Widget | undefined = this.shell.getWidgetById(widgetId);
        if (!widget) {
            return;
        }
        for (const tabBar of this.shell.mainAreaTabBars) {
            const title = [...tabBar.titles].find(candidate => candidate.owner === widget);
            if (title) {
                void this.shell.closeTabs(tabBar, candidate => candidate === title);
                return;
            }
        }
    }

    protected applyDrawCloseButton(drawOnEveryTab: boolean): void {
        document.body.classList.toggle(NOTEPADIA_TAB_CLOSE_ALL_CLASS, drawOnEveryTab);
    }

    async onDidInitializeLayout(): Promise<void> {
        // Notepad++ opens with only the menubar, tab bar, editor and status
        // bar. The right-hand panel is gone entirely; the left (Folder as
        // Workspace) panel starts collapsed and is brought back from the View
        // menu.
        await this.shell.collapsePanel('left').catch(() => { });
        await this.shell.collapsePanel('right').catch(() => { });
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(NotepadiaShellCommands.TOGGLE_FOLDER_WORKSPACE, {
            isToggled: () => this.shell.isExpanded('left'),
            execute: () => {
                if (this.shell.isExpanded('left')) {
                    return this.shell.collapsePanel('left');
                }
                this.shell.expandPanel('left');
            }
        });
        commands.registerCommand(NotepadiaShellCommands.TOGGLE_TOOLBAR, {
            isToggled: () => this.preferenceService.get<boolean>(NOTEPADIA_TOOLBAR_VISIBLE_PREFERENCE, true),
            execute: () => {
                const visible = this.preferenceService.get<boolean>(NOTEPADIA_TOOLBAR_VISIBLE_PREFERENCE, true);
                this.preferenceService.set(NOTEPADIA_TOOLBAR_VISIBLE_PREFERENCE, !visible).catch(() => { });
            }
        });
        commands.registerCommand(NotepadiaShellCommands.TOGGLE_STATUS_BAR, {
            isToggled: () => !document.body.classList.contains(NOTEPADIA_STATUS_BAR_HIDDEN_CLASS),
            execute: () => document.body.classList.toggle(NOTEPADIA_STATUS_BAR_HIDDEN_CLASS)
        });
        commands.registerCommand(NotepadiaShellCommands.TOGGLE_DRAW_CLOSE_BUTTON, {
            isToggled: () => this.preferenceService.get<boolean>(NOTEPADIA_DRAW_CLOSE_BUTTON_PREFERENCE, true),
            execute: () => {
                const drawOnEveryTab = this.preferenceService.get<boolean>(NOTEPADIA_DRAW_CLOSE_BUTTON_PREFERENCE, true);
                this.preferenceService.set(NOTEPADIA_DRAW_CLOSE_BUTTON_PREFERENCE, !drawOnEveryTab).catch(() => { });
            }
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        const view = CommonMenus.VIEW_PRIMARY;
        menus.registerMenuAction(view, { commandId: NotepadiaShellCommands.TOGGLE_FOLDER_WORKSPACE.id, order: 'a' });
        menus.registerMenuAction(view, { commandId: NotepadiaShellCommands.TOGGLE_TOOLBAR.id, order: 'b' });
        menus.registerMenuAction(view, { commandId: NotepadiaShellCommands.TOGGLE_STATUS_BAR.id, order: 'c' });
    }
}