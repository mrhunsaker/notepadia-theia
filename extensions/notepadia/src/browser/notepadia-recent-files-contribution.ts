import { inject, injectable } from '@theia/core/shared/inversify';
import { DisposableCollection } from '@theia/core/lib/common/disposable';
import { URI } from '@theia/core/lib/common/uri';
import { FrontendApplication, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { Command, CommandRegistry } from '@theia/core/lib/common/command';
import { MenuModelRegistry } from '@theia/core/lib/common/menu/menu-model-registry';
import { CommonMenus } from '@theia/core/lib/browser/common-menus';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import { StorageService } from '@theia/core/lib/browser/storage-service';

/**
 * Notepad++-style recent files. Opened documents are tracked (most recent
 * first, deduplicated, capped at 15) and presented under File ▸ Recent Files.
 * The submenu and its entries are rebuilt on every change; the submenu is only
 * present while the list is non-empty.
 */
@injectable()
export class NotepadiaRecentFilesContribution implements FrontendApplicationContribution {

    protected static readonly STORAGE_KEY = 'notepadia.recentFiles';
    protected static readonly MAX_ITEMS = 15;
    protected static readonly COMMAND_PREFIX = 'notepadia.recent.';
    protected static readonly MENU_PATH = [...CommonMenus.FILE, '0c_notepadia-recent'];
    protected static readonly CLEAR_COMMAND = 'notepadia.recent.clear';

    protected recent: URI[] = [];
    protected readonly menuDisposables = new DisposableCollection();

    constructor(
        @inject(EditorManager) protected readonly editorManager: EditorManager,
        @inject(CommandRegistry) protected readonly commandRegistry: CommandRegistry,
        @inject(MenuModelRegistry) protected readonly menuRegistry: MenuModelRegistry,
        @inject(StorageService) protected readonly storageService: StorageService
    ) { }

    async onStart(_app: FrontendApplication): Promise<void> {
        const stored = await this.storageService.getData<{ files: string[] }>(NotepadiaRecentFilesContribution.STORAGE_KEY, { files: [] });
        this.recent = (stored.files || []).map(u => new URI(u));
        this.rebuildMenu();

        this.editorManager.onCreated(widget => this.onOpened(widget.editor.uri));
    }

    protected onOpened(uri: URI | undefined): void {
        if (!uri) {
            return;
        }
        const key = uri.toString();
        this.recent = [uri, ...this.recent.filter(item => item.toString() !== key)]
            .slice(0, NotepadiaRecentFilesContribution.MAX_ITEMS);
        this.storageService.setData(NotepadiaRecentFilesContribution.STORAGE_KEY, { files: this.recent.map(u => u.toString()) });
        this.rebuildMenu();
    }

    protected open(uri: URI): void {
        this.onOpened(uri);
        this.editorManager.open(uri);
    }

    protected clear(): void {
        this.recent = [];
        this.storageService.setData(NotepadiaRecentFilesContribution.STORAGE_KEY, { files: [] });
        this.rebuildMenu();
    }

    protected rebuildMenu(): void {
        this.menuDisposables.dispose();

        const menuPath = NotepadiaRecentFilesContribution.MENU_PATH;
        if (this.recent.length > 0) {
            this.menuDisposables.push(this.menuRegistry.registerSubmenu(menuPath, 'Recent Files'));

            this.recent.slice(0, NotepadiaRecentFilesContribution.MAX_ITEMS).forEach((uri, index) => {
                const commandId = NotepadiaRecentFilesContribution.COMMAND_PREFIX + index;
                const command: Command = { id: commandId, label: uri.path.base };
                this.menuDisposables.push(this.commandRegistry.registerCommand(command, { execute: () => this.open(uri) }));
                this.menuDisposables.push(this.menuRegistry.registerMenuAction(menuPath, {
                    commandId,
                    order: String(index).padStart(2, '0')
                }));
            });

            const clearId = NotepadiaRecentFilesContribution.CLEAR_COMMAND;
            this.menuDisposables.push(this.commandRegistry.registerCommand({ id: clearId, label: 'Clear Recent Files' },
                { execute: () => this.clear() }));
            this.menuDisposables.push(this.menuRegistry.registerMenuAction(menuPath, {
                commandId: clearId,
                order: 'z'
            }));
        }
    }
}