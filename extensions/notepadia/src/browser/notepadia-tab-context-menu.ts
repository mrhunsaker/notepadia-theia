import { inject, injectable } from '@theia/core/shared/inversify';
import { Command, CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import { MenuContribution, MenuModelRegistry } from '@theia/core/lib/common/menu';
import { FrontendApplication, FrontendApplicationContribution, NavigatableWidget, Saveable } from '@theia/core/lib/browser';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import {
    CurrentWidgetCommandAdapter
} from '@theia/core/lib/browser/shell/current-widget-command-adapter';
import {
    SHELL_TABBAR_CONTEXT_CLOSE,
    SHELL_TABBAR_CONTEXT_COPY,
    SHELL_TABBAR_CONTEXT_MENU,
    SHELL_TABBAR_CONTEXT_PIN,
    SHELL_TABBAR_CONTEXT_SPLIT
} from '@theia/core/lib/browser/shell/tab-bars';
import { CommonCommands } from '@theia/core/lib/browser/common-commands';
import { TabBar, Title, Widget } from '@theia/core/lib/browser/widgets';
import { ClipboardService } from '@theia/core/lib/browser/clipboard-service';
import { URI } from '@theia/core/lib/common/uri';
import { EditorWidget } from '@theia/editor/lib/browser/editor-widget';
import { NotepadiaPrintCommands } from './notepadia-print-contribution';

/**
 * The Notepad++ tab context menu (A4).
 *
 * The stock Theia/VS Code tab menu (Close / Close Others / Close to the Right /
 * Close Saved / Close All / Copy Path / Pin / Split...) is unregistered in
 * `onStart`, after every `registerMenus` pass has run, and replaced with the
 * Notepad++ set. Deferred to later milestones - see the comments below:
 * Rename / Delete from Disk / Reload from Disk (C1), Read-Only toggle (C2),
 * Move-Clone to Other View (C4).
 */
@injectable()
export class NotepadiaTabContextMenuContribution implements CommandContribution, MenuContribution, FrontendApplicationContribution {

    /** Menu path of the navigator's "Reveal in File Explorer" tab action. */
    protected static readonly REVEAL_MENU_PATH = [...SHELL_TABBAR_CONTEXT_MENU, '2_reveal'];

    /** Stock tab-menu actions, by the group in which they are registered. */
    protected static readonly DEFAULT_TAB_MENU_ACTIONS: Array<[string[], string[]]> = [
        [SHELL_TABBAR_CONTEXT_CLOSE, [
            'core.close.tab',
            'core.close.other.tabs',
            'workbench.action.closeUnmodifiedEditors',
            'core.close.right.tabs',
            'core.close.all.tabs'
        ]],
        [SHELL_TABBAR_CONTEXT_COPY, [
            'core.copy.path',
            'navigator.copyRelativeFilePath'
        ]],
        [SHELL_TABBAR_CONTEXT_PIN, [
            'workbench.action.pinEditor',
            'workbench.action.unpinEditor',
            'workbench.action.keepEditor'
        ]],
        [SHELL_TABBAR_CONTEXT_SPLIT, [
            'core.collapse.tab',
            'core.toggleMaximized',
            'workbench.action.splitEditorUp',
            'workbench.action.splitEditorDown',
            'workbench.action.splitEditorLeft',
            'workbench.action.splitEditorRight'
        ]],
        [NotepadiaTabContextMenuContribution.REVEAL_MENU_PATH, [
            'navigator.reveal'
        ]]
    ];

    constructor(
        @inject(ApplicationShell) protected readonly shell: ApplicationShell,
        @inject(ClipboardService) protected readonly clipboardService: ClipboardService,
        @inject(MenuModelRegistry) protected readonly menus: MenuModelRegistry
    ) { }

    async onStart(_app: FrontendApplication): Promise<void> {
        // Every contribution's registerMenus already ran, so unregistering the
        // stock tab actions here removes exactly the VS Code menu items with no
        // risk of racing their registration.
        for (const [path, ids] of NotepadiaTabContextMenuContribution.DEFAULT_TAB_MENU_ACTIONS) {
            for (const id of ids) {
                try {
                    this.menus.unregisterMenuAction(id, path);
                } catch {
                    // Already removed - nothing to do.
                }
            }
        }
    }

    registerCommands(commands: CommandRegistry): void {
        // --- Close ---------------------------------------------------------
        commands.registerCommand(NotepadiaTabCommands.CLOSE_TAB, new CurrentWidgetCommandAdapter(this.shell, {
            isEnabled: title => Boolean(title?.closable),
            execute: (title, tabbar) => {
                if (title && tabbar) {
                    void this.shell.closeTabs(tabbar, candidate => candidate === title);
                }
            }
        }));
        commands.registerCommand(NotepadiaTabCommands.CLOSE_OTHER_TABS, new CurrentWidgetCommandAdapter(this.shell, {
            isEnabled: (title, tabbar) => Boolean(tabbar?.titles.some(
                candidate => candidate !== title && candidate.closable)),
            execute: (title, tabbar) => {
                if (title && tabbar) {
                    void this.shell.closeTabs(tabbar, candidate => candidate !== title && candidate.closable);
                }
            }
        }));
        commands.registerCommand(NotepadiaTabCommands.CLOSE_TABS_LEFT, new CurrentWidgetCommandAdapter(this.shell, {
            isEnabled: (title, tabbar) => this.sideTabsExist(tabbar, title, false),
            execute: (title, tabbar) => {
                if (title && tabbar) {
                    void this.shell.closeTabs(tabbar, candidate => this.isOnSide(tabbar, title, candidate, false) && candidate.closable);
                }
            }
        }));
        commands.registerCommand(NotepadiaTabCommands.CLOSE_TABS_RIGHT, new CurrentWidgetCommandAdapter(this.shell, {
            isEnabled: (title, tabbar) => this.sideTabsExist(tabbar, title, true),
            execute: (title, tabbar) => {
                if (title && tabbar) {
                    void this.shell.closeTabs(tabbar, candidate => this.isOnSide(tabbar, title, candidate, true) && candidate.closable);
                }
            }
        }));
        // --- Save / Save As / Print ---------------------------------------
        commands.registerCommand(NotepadiaTabCommands.SAVE, new CurrentWidgetCommandAdapter(this.shell, {
            isEnabled: title => Boolean(title && Saveable.get(title.owner)),
            execute: async title => {
                if (title) {
                    await Saveable.save(title.owner);
                }
            }
        }));
        commands.registerCommand(NotepadiaTabCommands.SAVE_AS, new CurrentWidgetCommandAdapter(this.shell, {
            isEnabled: title => Boolean(title && Saveable.get(title.owner)),
            execute: async title => {
                if (!title) {
                    return;
                }
                await this.shell.activateWidget(title.owner.id);
                await commands.executeCommand(CommonCommands.SAVE_AS.id);
            }
        }));
        commands.registerCommand(NotepadiaTabCommands.PRINT, new CurrentWidgetCommandAdapter(this.shell, {
            isEnabled: title => Boolean(title && title.owner instanceof EditorWidget),
            execute: async title => {
                if (!title || !(title.owner instanceof EditorWidget)) {
                    return;
                }
                await this.shell.activateWidget(title.owner.id);
                await commands.executeCommand(NotepadiaPrintCommands.PRINT.id);
            }
        }));
        // --- Copy ----------------------------------------------------------
        for (const [name, formatter] of [
            [NotepadiaTabCommands.COPY_FILE_PATH, (uri: URI) => uri.path.toString()],
            [NotepadiaTabCommands.COPY_FILE_NAME, (uri: URI) => uri.path.base],
            [NotepadiaTabCommands.COPY_DIRECTORY_PATH, (uri: URI) => uri.path.dir.toString()]
        ] as Array<[Command, (uri: URI) => string]>) {
            commands.registerCommand(name, new CurrentWidgetCommandAdapter(this.shell, {
                isEnabled: title => this.resourceUri(title) !== undefined,
                execute: async title => {
                    const uri = title ? this.resourceUri(title) : undefined;
                    if (uri) {
                        await this.clipboardService.writeText(formatter(uri));
                    }
                }
            }));
        }
    }

    registerMenus(menus: MenuModelRegistry): void {
        // The four close actions follow Notepad++'s order, with Save/Save As/Print
        // kept immediately under them (Notepad++ keeps the whole File block on the
        // tab menu), then the copy block.
        menus.registerMenuAction(SHELL_TABBAR_CONTEXT_CLOSE, { commandId: NotepadiaTabCommands.CLOSE_TAB.id, label: 'Close', order: '0' });
        menus.registerMenuAction(SHELL_TABBAR_CONTEXT_CLOSE, { commandId: NotepadiaTabCommands.CLOSE_OTHER_TABS.id, label: 'Close All BUT This', order: '1' });
        menus.registerMenuAction(SHELL_TABBAR_CONTEXT_CLOSE, { commandId: NotepadiaTabCommands.CLOSE_TABS_LEFT.id, label: 'Close All to the Left', order: '2' });
        menus.registerMenuAction(SHELL_TABBAR_CONTEXT_CLOSE, { commandId: NotepadiaTabCommands.CLOSE_TABS_RIGHT.id, label: 'Close All to the Right', order: '3' });
        menus.registerMenuAction(SHELL_TABBAR_CONTEXT_CLOSE, { commandId: NotepadiaTabCommands.SAVE.id, label: 'Save', order: '4' });
        menus.registerMenuAction(SHELL_TABBAR_CONTEXT_CLOSE, { commandId: NotepadiaTabCommands.SAVE_AS.id, label: 'Save As...', order: '5' });
        menus.registerMenuAction(SHELL_TABBAR_CONTEXT_CLOSE, { commandId: NotepadiaTabCommands.PRINT.id, label: 'Print', order: '6' });

        menus.registerMenuAction(SHELL_TABBAR_CONTEXT_COPY, { commandId: NotepadiaTabCommands.COPY_FILE_PATH.id, label: 'Copy File Path', order: '1' });
        menus.registerMenuAction(SHELL_TABBAR_CONTEXT_COPY, { commandId: NotepadiaTabCommands.COPY_FILE_NAME.id, label: 'Copy File Name', order: '2' });
        menus.registerMenuAction(SHELL_TABBAR_CONTEXT_COPY, { commandId: NotepadiaTabCommands.COPY_DIRECTORY_PATH.id, label: 'Copy Directory Path', order: '3' });

        // Notepad++ also lists Rename, Delete from Disk, Reload from Disk,
        // Read-Only, and Move/Clone to Other View here. They are deferred to the
        // C1/C2/C4 milestones and are intentionally not registered as dead items.
    }

    protected resourceUri(title: Title<Widget> | undefined): URI | undefined {
        const owner = title?.owner;
        if (owner && NavigatableWidget.is(owner)) {
            return owner.getResourceUri();
        }
        return undefined;
    }

    /** Whether any open tab sits on the requested side of `anchor` in `tabbar`. */
    protected sideTabsExist(tabbar: TabBar<Widget> | undefined, anchor: Title<Widget> | undefined, right: boolean): boolean {
        return Boolean(anchor && tabbar?.titles.some(candidate => this.isOnSide(tabbar, anchor, candidate, right) && candidate.closable));
    }

    protected isOnSide(tabbar: TabBar<Widget>, anchor: Title<Widget>,
        candidate: Title<Widget>, right: boolean): boolean {
        const anchorIndex = tabbar.titles.indexOf(anchor);
        const candidateIndex = tabbar.titles.indexOf(candidate);
        return candidateIndex !== -1 && anchorIndex !== -1 && (right ? candidateIndex > anchorIndex : candidateIndex < anchorIndex);
    }
}

/**
 * Commands of the Notepad++ tab context menu.
 */
export namespace NotepadiaTabCommands {
    export const CLOSE_TAB: Command = { id: 'notepadia.tab.close', label: 'Close' };
    export const CLOSE_OTHER_TABS: Command = { id: 'notepadia.tab.closeOthers', label: 'Close All BUT This' };
    export const CLOSE_TABS_LEFT: Command = { id: 'notepadia.tab.closeLeft', label: 'Close All to the Left' };
    export const CLOSE_TABS_RIGHT: Command = { id: 'notepadia.tab.closeRight', label: 'Close All to the Right' };
    export const SAVE: Command = { id: 'core.save', label: 'Save' };
    export const SAVE_AS: Command = { id: 'file.saveAs', label: 'Save As...' };
    export const PRINT: Command = { id: 'notepadia.print', label: 'Print' };
    export const COPY_FILE_PATH: Command = { id: 'notepadia.tab.copyFilePath', label: 'Copy File Path' };
    export const COPY_FILE_NAME: Command = { id: 'notepadia.tab.copyFileName', label: 'Copy File Name' };
    export const COPY_DIRECTORY_PATH: Command = { id: 'notepadia.tab.copyDirectoryPath', label: 'Copy Directory Path' };
}