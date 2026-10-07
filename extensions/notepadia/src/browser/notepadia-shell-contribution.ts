import { inject, injectable } from '@theia/core/shared/inversify';
import { FrontendApplication, FrontendApplicationContribution, Widget, WidgetManager } from '@theia/core/lib/browser';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { Command, CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import { MenuContribution, MenuModelRegistry } from '@theia/core/lib/common/menu';
import { CommonMenus } from '@theia/core/lib/browser/common-menus';
import { StatusBar } from '@theia/core/lib/browser/status-bar/status-bar';
import { PreferenceService } from '@theia/core/lib/common/preferences';
import { EXPLORER_VIEW_CONTAINER_ID } from '@theia/navigator/lib/browser/navigator-widget-factory';
import { NOTEPADIA_TAB_ID_PREFIX } from './notepadia-tab-decorator';
import { editorZoomAction } from '../common/zoom-chords';

/** Whether the toolbar with New/Open/Save is visible (A3). */
export const NOTEPADIA_TOOLBAR_VISIBLE_PREFERENCE = 'notepadia.toolbar.visible';
/** Whether the status bar at the bottom of the window is visible (A5). */
export const NOTEPADIA_STATUS_BAR_VISIBLE_PREFERENCE = 'notepadia.statusBar.visible';
/** Whether the tab bar shows one line or multiple lines (A4). */
export const NOTEPADIA_TAB_BAR_MULTI_LINE_PREFERENCE = 'notepadia.tabBar.multiLine';
/** Draw a close button on every tab (A4); when disabled it only shows on the active tab. */
export const NOTEPADIA_DRAW_CLOSE_BUTTON_PREFERENCE = 'notepadia.tabBar.drawCloseButton';

/**
 * E3 - the title Notepad++ gives its left panel, regardless of which folder is
 * open. The title is applied to the Explorer `ViewContainer` that hosts the
 * navigator (see {@link NotepadiaShellContribution.applyFolderWorkspaceTitle}).
 */
export const FOLDER_AS_WORKSPACE_LABEL = 'Folder as Workspace';

/**
 * E3 - the Theia icon theme preference. Notepad++'s Folder as Workspace has no
 * per-file language icons, so the shell selects the built-in `none` theme
 * unless the user has already chosen one.
 */
export const NOTEPADIA_ICON_THEME_PREFERENCE = 'workbench.iconTheme';
/** The id of the built-in Theia icon theme that draws no file icons. */
export const NOTEPADIA_ICON_THEME_NONE = 'none';

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
    export const TOGGLE_TAB_BAR_MULTI_LINE: Command = {
        id: 'notepadia.view.toggleTabBarMultiLine',
        label: 'Multi-line'
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
        @inject(PreferenceService) protected readonly preferenceService: PreferenceService,
        @inject(WidgetManager) protected readonly widgetManager: WidgetManager
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

        // D2 - keep Ctrl+= / Ctrl+- / Ctrl+0 on the editor's zoom.
        document.addEventListener('keydown', this.handleZoomChord, true);

        // E3 - present the File Navigator as Notepad++'s Folder as Workspace.
        // The panel header is the Explorer `ViewContainer` that hosts the
        // navigator, so that is the widget whose title must read the Notepad++
        // name. It may be created either side of this contribution's layout
        // callback, so it is retitled both when the container widget is created
        // and, below, when the layout is already in place.
        this.widgetManager.onDidCreateWidget(({ factoryId, widget }) => {
            if (factoryId === EXPLORER_VIEW_CONTAINER_ID) {
                this.applyFolderWorkspaceTitle(widget);
            }
        });
        this.applyPlainIconTheme();

        // A4 - View > Tab Bar > Draw Close Button.
        this.applyDrawCloseButton(this.preferenceService.get<boolean>(NOTEPADIA_DRAW_CLOSE_BUTTON_PREFERENCE, true));
        this.preferenceService.onPreferenceChanged(event => {
            if (event.preferenceName === NOTEPADIA_DRAW_CLOSE_BUTTON_PREFERENCE) {
                this.applyDrawCloseButton(this.preferenceService.get<boolean>(NOTEPADIA_DRAW_CLOSE_BUTTON_PREFERENCE, true));
            }
            if (event.preferenceName === NOTEPADIA_TAB_BAR_MULTI_LINE_PREFERENCE) {
                this.applyTabBarMultiLine(this.preferenceService.get<boolean>(NOTEPADIA_TAB_BAR_MULTI_LINE_PREFERENCE, false));
            }
            if (event.preferenceName === NOTEPADIA_STATUS_BAR_VISIBLE_PREFERENCE) {
                this.applyStatusBarVisibility();
            }
        });
        this.applyStatusBarVisibility();
        this.applyTabBarMultiLine(this.preferenceService.get<boolean>(NOTEPADIA_TAB_BAR_MULTI_LINE_PREFERENCE, false));
    }

    /**
     * D2 - the editor's zoom chords, Notepad++ style.
     *
     * Ctrl+= / Ctrl+- / Ctrl+0 are Zoom In / Zoom Out / Reset Zoom in Notepad++
     * and page zoom in every browser, so the two meanings fight over the same
     * chord. Calling `preventDefault()` here stops the browser's own default
     * while leaving propagation alone, so the keybinding registry still
     * receives the event and runs the editor's zoom command.
     *
     * Scoped to "the editor has focus" on purpose: with focus anywhere else -
     * the menubar, the tab bar, the folder panel - the browser keeps its page
     * zoom, which is what the user asked for. Which keys count as a zoom chord
     * is decided by `editorZoomAction` so the rules are unit tested.
     */
    protected readonly handleZoomChord = (event: KeyboardEvent): void => {
        if (!editorZoomAction(event)) {
            return;
        }
        if (!NotepadiaShellContribution.editorHasFocus()) {
            return;
        }
        event.preventDefault();
    };

    protected static editorHasFocus(): boolean {
        const active = document.activeElement;
        return !!active && typeof active.closest === 'function' && !!active.closest('.monaco-editor');
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

    protected applyTabBarMultiLine(multiLine: boolean): void {
        document.body.classList.toggle('notepadia-tabbar-multiline', multiLine);
    }

    protected applyStatusBarVisibility(): void {
        const visible = this.preferenceService.get<boolean>(NOTEPADIA_STATUS_BAR_VISIBLE_PREFERENCE, true);
        document.body.classList.toggle(NOTEPADIA_STATUS_BAR_HIDDEN_CLASS, !visible);
    }

    async onDidInitializeLayout(): Promise<void> {
        // Notepad++ opens with only the menubar, tab bar, editor and status
        // bar. The right-hand panel is gone entirely; the left (Folder as
        // Workspace) panel starts collapsed and is brought back from the View
        // menu.
        await this.shell.collapsePanel('left').catch(() => { });
        await this.shell.collapsePanel('right').catch(() => { });
        // E3 - for a layout that already contained the navigator, `onStart`'s
        // creation listener has already fired; this covers the case where the
        // widget was created before this contribution started.
        const explorerContainer = await this.widgetManager.getWidget(EXPLORER_VIEW_CONTAINER_ID);
        if (explorerContainer) {
            this.applyFolderWorkspaceTitle(explorerContainer);
        }
    }

    /**
     * E3 - label the Explorer panel "Folder as Workspace", as Notepad++ does.
     *
     * The panel header reads the hosting `ViewContainer`'s title, not the
     * navigator widget's, so the container is retitled. A `ViewContainer`
     * normally settles its title once, but the navigator decorates or renames
     * child widgets over time, so the label is also guarded against later
     * rewrites. Lumino's `title.changed` signal is the supported hook: setting
     * the label from the handler re-renders the panel header, and the second
     * pass is a no-op because the label already matches, so the signal cannot
     * loop. The guard makes the hook idempotent for a re-created widget.
     */
    protected applyFolderWorkspaceTitle(widget: Widget): void {
        const title = widget.title as typeof widget.title & { notepadiaFolderWorkspace?: boolean };
        if (title.notepadiaFolderWorkspace) {
            return;
        }
        title.notepadiaFolderWorkspace = true;
        if (title.label !== FOLDER_AS_WORKSPACE_LABEL) {
            title.label = FOLDER_AS_WORKSPACE_LABEL;
        }
        title.changed.connect(() => {
            if (title.label !== FOLDER_AS_WORKSPACE_LABEL) {
                title.label = FOLDER_AS_WORKSPACE_LABEL;
            }
        });
    }

    /**
     * E3 - Notepad++'s Folder as Workspace shows plain names, not a per-language
     * icon theme. The built-in `none` theme draws no file icons; it is only
     * selected when the user has not already chosen one, so an explicit
     * preference is never overwritten.
     */
    protected applyPlainIconTheme(): void {
        const inspection = this.preferenceService.inspect<string>(NOTEPADIA_ICON_THEME_PREFERENCE);
        const userSet = !!inspection && (inspection.globalValue !== undefined
            || inspection.workspaceValue !== undefined
            || inspection.workspaceFolderValue !== undefined);
        if (!userSet) {
            this.preferenceService.set(NOTEPADIA_ICON_THEME_PREFERENCE, NOTEPADIA_ICON_THEME_NONE).catch(() => { });
        }
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
            isToggled: () => this.preferenceService.get<boolean>(NOTEPADIA_STATUS_BAR_VISIBLE_PREFERENCE, true),
            execute: () => {
                const visible = this.preferenceService.get<boolean>(NOTEPADIA_STATUS_BAR_VISIBLE_PREFERENCE, true);
                this.preferenceService.set(NOTEPADIA_STATUS_BAR_VISIBLE_PREFERENCE, !visible).catch(() => { });
                this.applyStatusBarVisibility();
            }
        });
        commands.registerCommand(NotepadiaShellCommands.TOGGLE_DRAW_CLOSE_BUTTON, {
            isToggled: () => this.preferenceService.get<boolean>(NOTEPADIA_DRAW_CLOSE_BUTTON_PREFERENCE, true),
            execute: () => {
                const drawOnEveryTab = this.preferenceService.get<boolean>(NOTEPADIA_DRAW_CLOSE_BUTTON_PREFERENCE, true);
                this.preferenceService.set(NOTEPADIA_DRAW_CLOSE_BUTTON_PREFERENCE, !drawOnEveryTab).catch(() => { });
                this.applyDrawCloseButton(!drawOnEveryTab);
            }
        });
        commands.registerCommand(NotepadiaShellCommands.TOGGLE_TAB_BAR_MULTI_LINE, {
            isToggled: () => this.preferenceService.get<boolean>(NOTEPADIA_TAB_BAR_MULTI_LINE_PREFERENCE, false),
            execute: () => {
                const multiLine = this.preferenceService.get<boolean>(NOTEPADIA_TAB_BAR_MULTI_LINE_PREFERENCE, false);
                this.preferenceService.set(NOTEPADIA_TAB_BAR_MULTI_LINE_PREFERENCE, !multiLine).catch(() => { });
                this.applyTabBarMultiLine(!multiLine);
            }
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        const view = CommonMenus.VIEW_PRIMARY;
        menus.registerMenuAction(view, { commandId: NotepadiaShellCommands.TOGGLE_FOLDER_WORKSPACE.id, order: 'a' });
        menus.registerMenuAction(view, { commandId: NotepadiaShellCommands.TOGGLE_TOOLBAR.id, order: 'b' });
        menus.registerMenuAction(view, { commandId: NotepadiaShellCommands.TOGGLE_STATUS_BAR.id, order: 'c' });
        // Notepad++'s View > Tab Bar > Multi-line. Theia always allows a tab bar
        // to wrap onto several lines already, so this is off by default and the
        // menu item forces the single-line, scrolling behaviour instead - the
        // switch that makes the difference for a user who wants the tabs to
        // stay in one row.
        // `View > Tab Bar > Multi-line` is registered by
        // notepadia-menu-contribution.ts, next to Draw Close Button, so the whole
        // submenu is built in one place.
    }
}