import { inject, injectable, optional } from '@theia/core/shared/inversify';
import {
    Command,
    CommandContribution,
    CommandRegistry,
    MenuContribution,
    MenuModelRegistry,
    MessageService
} from '@theia/core/lib/common';
import { CommonMenus, FrontendApplicationContribution } from '@theia/core/lib/browser';
import {
    NotepadiaUpdateStatus,
    NotepadiaUpdaterClient,
    NotepadiaUpdaterService
} from '../common/notepadia-updater-protocol';

export namespace NotepadiaUpdaterCommands {
    export const CHECK_FOR_UPDATES: Command = {
        id: 'notepadia.updater.checkForUpdates',
        label: 'Check for Updates...'
    };
}

@injectable()
export class NotepadiaUpdaterContribution implements CommandContribution, MenuContribution, FrontendApplicationContribution {

    protected manualCheck = false;

    constructor(
        @inject(MessageService) protected readonly messageService: MessageService,
        @inject(NotepadiaUpdaterService) @optional() protected readonly updater?: NotepadiaUpdaterService
    ) { }

    onStart(): void {
        if (!this.updater) {
            return;
        }
        const client: NotepadiaUpdaterClient = {
            notifyUpdateStatusChanged: status => this.handleUpdateStatus(status)
        };
        this.updater.setClient(client);
        setTimeout(() => this.checkForUpdates(), 3000);
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(NotepadiaUpdaterCommands.CHECK_FOR_UPDATES, {
            isEnabled: () => !!this.updater,
            execute: () => this.checkForUpdates()
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        if (this.updater) {
            menus.registerMenuAction(CommonMenus.HELP, {
                commandId: NotepadiaUpdaterCommands.CHECK_FOR_UPDATES.id,
                label: NotepadiaUpdaterCommands.CHECK_FOR_UPDATES.label,
                order: 'z'
            });
        }
    }

    protected async checkForUpdates(): Promise<void> {
        if (!this.updater) {
            this.messageService.info('Automatic updates are not available in this build.');
            return;
        }
        this.manualCheck = true;
        await this.updater.checkForUpdates();
    }

    protected handleUpdateStatus(status: NotepadiaUpdateStatus): void {
        switch (status.state) {
            case 'checking':
            case 'download-progress':
                break;
            case 'update-available':
                this.messageService.info(`Update ${status.nextVersion} is available. Downloading in the background...`);
                break;
            case 'update-not-available':
                if (this.manualCheck) {
                    this.messageService.info(`Notepadia is up to date (version ${status.currentVersion}).`);
                }
                break;
            case 'update-downloaded':
                if (status.nextVersion) {
                    this.messageService.info(
                        `Update ${status.nextVersion} is ready to install. Restart Notepadia to apply it.`,
                        { timeout: 15000 },
                        'Restart',
                        'Later'
                    ).then(action => {
                        if (action === 'Restart' && this.updater) {
                            this.updater.quitAndInstall();
                        }
                    });
                }
                break;
            case 'error':
                this.messageService.error(`Automatic update failed: ${status.message ?? 'unknown error'}`);
                break;
            case 'disabled':
                if (this.manualCheck) {
                    this.messageService.info('Automatic updates are disabled in development builds.');
                }
                break;
        }
        this.manualCheck = false;
    }
}
