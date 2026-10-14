import { inject, injectable, optional } from '@theia/core/shared/inversify';
import {
    Command,
    CommandContribution,
    CommandRegistry,
    MenuContribution,
    MenuModelRegistry
} from '@theia/core/lib/common';
import { CommonMenus, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { AbstractDialog } from '@theia/core/lib/browser/dialogs';
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

interface UpdateDialogActions {
    download(): void;
    install(): void;
}

/**
 * The popup behind `Help ▸ Check for Updates...`. It opens as soon as the check
 * starts and then re-renders itself from each `NotepadiaUpdateStatus` the
 * backend pushes: a result the user reads (up to date, error) or an offer they
 * accept (download, then restart and install). Buttons are rebuilt per state,
 * so a state that has nothing to decide simply shows `Close`.
 */
class NotepadiaUpdateDialog extends AbstractDialog<undefined> {

    protected readonly messageNode: HTMLDivElement;
    protected readonly detailNode: HTMLDivElement;
    protected primaryAction: (() => void) | undefined;
    protected status: NotepadiaUpdateStatus;

    constructor(status: NotepadiaUpdateStatus, protected readonly actions: UpdateDialogActions) {
        super({ title: 'Check for Updates' });

        const panel = document.createElement('div');
        panel.className = 'notepadia-update';

        this.messageNode = document.createElement('div');
        this.messageNode.className = 'notepadia-update-message';
        this.messageNode.setAttribute('role', 'status');
        this.messageNode.setAttribute('aria-live', 'polite');

        this.detailNode = document.createElement('div');
        this.detailNode.className = 'notepadia-update-detail';

        panel.append(this.messageNode, this.detailNode);
        this.contentNode.appendChild(panel);

        this.status = status;
        this.render();
    }

    get value(): undefined {
        return undefined;
    }

    showStatus(status: NotepadiaUpdateStatus): void {
        this.status = status;
        this.render();
    }

    protected handleEnter(_event: KeyboardEvent): boolean {
        if (this.primaryAction) {
            this.primaryAction();
        }
        return false;
    }

    protected button(label: string, primary: boolean, action: () => void): void {
        this.appendButton(label, primary).addEventListener('click', action);
    }

    protected render(): void {
        const status = this.status;
        const current = status.currentVersion ?? 'this build';
        this.primaryAction = undefined;
        this.controlPanel.querySelectorAll('button').forEach(button => button.remove());

        switch (status.state) {
            case 'checking':
                this.setContent('Checking for updates...', 'Looking for a newer version of Notepadia.');
                this.button('Cancel', false, () => this.close());
                break;
            case 'update-not-available':
                this.setContent('You are up to date.', `Notepadia ${current} is the latest version.`);
                this.button('Close', true, () => this.close());
                this.primaryAction = () => this.close();
                break;
            case 'update-available':
                this.setContent(
                    `${status.nextVersion ? `Notepadia ${status.nextVersion}` : 'A newer version of Notepadia'} is available.`,
                    `You have ${current}. Download and update to install it.`
                );
                this.button('Download and Update', true, () => {
                    this.showStatus({ ...status, state: 'download-progress', percent: 0 });
                    this.actions.download();
                });
                this.button('Later', false, () => this.close());
                this.primaryAction = () => this.actions.download();
                break;
            case 'download-progress':
                this.setContent(
                    `Downloading ${status.nextVersion ? `Notepadia ${status.nextVersion}` : 'update'}...`,
                    `${Math.round(status.percent ?? 0)}% complete.`
                );
                break;
            case 'update-downloaded':
                this.setContent(
                    `${status.nextVersion ? `Notepadia ${status.nextVersion}` : 'The update'} is ready to install.`,
                    'Restart Notepadia now to apply the update, or close this window and restart later.'
                );
                this.button('Restart and Install', true, () => this.actions.install());
                this.button('Later', false, () => this.close());
                this.primaryAction = () => this.actions.install();
                break;
            case 'error':
                this.setContent('Could not check for updates.', status.message ?? 'An unknown error occurred.');
                this.button('Close', true, () => this.close());
                this.primaryAction = () => this.close();
                break;
            case 'disabled':
            default:
                this.setContent(
                    'Updates are not available in this build.',
                    status.message ?? 'Automatic updates are only available in the installed desktop app.'
                );
                this.button('Close', true, () => this.close());
                this.primaryAction = () => this.close();
                break;
        }
    }

    protected setContent(message: string, detail: string): void {
        this.messageNode.textContent = message;
        this.detailNode.textContent = detail;
    }
}

@injectable()
export class NotepadiaUpdaterContribution implements CommandContribution, MenuContribution, FrontendApplicationContribution {

    protected dialog: NotepadiaUpdateDialog | undefined;

    constructor(
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
        setTimeout(() => this.checkForUpdates(false), 3000);
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(NotepadiaUpdaterCommands.CHECK_FOR_UPDATES, {
            isEnabled: () => !!this.updater,
            execute: () => this.checkForUpdates(true)
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

    /**
     * `manual` is the user pressing `Help ▸ Check for Updates...`. Only then is
     * the dialog opened; the startup check runs quietly and merely records the
     * result, so an available update is never downloaded or installed unseen.
     */
    protected async checkForUpdates(manual: boolean): Promise<void> {
        if (manual) {
            this.openDialog(this.updater
                ? { state: 'checking' }
                : { state: 'disabled' });
        }
        if (!this.updater) {
            return;
        }
        await this.updater.checkForUpdates();
    }

    protected handleUpdateStatus(status: NotepadiaUpdateStatus): void {
        if (this.dialog) {
            this.dialog.showStatus(status);
        }
    }

    protected openDialog(status: NotepadiaUpdateStatus): void {
        if (this.dialog) {
            this.dialog.showStatus(status);
            return;
        }
        const dialog = new NotepadiaUpdateDialog(status, {
            download: () => void this.updater?.downloadUpdate(),
            install: () => this.updater?.quitAndInstall()
        });
        this.dialog = dialog;
        dialog.open().then(() => {
            if (this.dialog === dialog) {
                this.dialog = undefined;
            }
        });
    }
}
