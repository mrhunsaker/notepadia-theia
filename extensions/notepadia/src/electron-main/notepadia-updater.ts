import { inject, injectable } from '@theia/core/shared/inversify';
import { ILogger } from '@theia/core/lib/common/logger';
import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import {
    ElectronMainApplication,
    ElectronMainApplicationContribution
} from '@theia/core/lib/electron-main/electron-main-application';
import {
    NotepadiaUpdaterClient,
    NotepadiaUpdaterService,
    NotepadiaUpdateStatus,
    NotepadiaUpdateState
} from '../common/notepadia-updater-protocol';

const DISABLED_MESSAGE = 'Automatic updates are only available in packaged applications.';

@injectable()
export class NotepadiaUpdater implements NotepadiaUpdaterService, ElectronMainApplicationContribution {

    protected client?: NotepadiaUpdaterClient;
    protected status: NotepadiaUpdateStatus = { state: 'checking' };

    constructor(@inject(ILogger) protected readonly logger: ILogger) { }

    setClient(client: NotepadiaUpdaterClient | undefined): void {
        this.client = client;
    }

    dispose(): void {
        this.client = undefined;
    }

    onStart(_application: ElectronMainApplication): void {
        if (app.isPackaged) {
            this.configureAutoUpdater();
            setTimeout(() => this.checkForUpdates(), 3000);
        } else {
            this.setStatus({ state: 'disabled', message: DISABLED_MESSAGE });
        }
    }

    checkForUpdates(): Promise<NotepadiaUpdateStatus> {
        if (!app.isPackaged) {
            this.setStatus({ state: 'disabled', message: DISABLED_MESSAGE });
            return Promise.resolve(this.status);
        }
        try {
            autoUpdater.checkForUpdates().catch(error =>
                this.setStatus({
                    state: 'error',
                    currentVersion: app.getVersion(),
                    message: this.toMessage(error)
                }));
        } catch (error) {
            this.setStatus({
                state: 'error',
                currentVersion: app.getVersion(),
                message: this.toMessage(error)
            });
        }
        return Promise.resolve(this.status);
    }

    quitAndInstall(): void {
        if (app.isPackaged) {
            autoUpdater.quitAndInstall();
        }
    }

    protected configureAutoUpdater(): void {
        autoUpdater.autoDownload = true;
        autoUpdater.autoInstallOnAppQuit = true;
        autoUpdater.logger = {
            info: message => this.logger.info(this.toMessage(message)),
            warn: message => this.logger.warn(this.toMessage(message)),
            error: message => this.logger.error(this.toMessage(message)),
            debug: message => this.logger.debug(this.toMessage(message))
        };

        const status = (state: NotepadiaUpdateState, extra?: Partial<NotepadiaUpdateStatus>): NotepadiaUpdateStatus =>
            ({ state, currentVersion: app.getVersion(), ...extra });

        autoUpdater.on('checking-for-update', () => this.setStatus(status('checking')));
        autoUpdater.on('update-available', info =>
            this.setStatus(status('update-available', { nextVersion: info.version })));
        autoUpdater.on('update-not-available', info =>
            this.setStatus(status('update-not-available', { nextVersion: info.version })));
        autoUpdater.on('download-progress', progress =>
            this.setStatus(status('download-progress', { percent: progress.percent })));
        autoUpdater.on('update-downloaded', info =>
            this.setStatus(status('update-downloaded', { nextVersion: info.version })));
        autoUpdater.on('error', error =>
            this.setStatus(status('error', { message: this.toMessage(error) })));
    }

    protected setStatus(status: NotepadiaUpdateStatus): void {
        this.status = status;
        if (this.client) {
            this.client.notifyUpdateStatusChanged(status);
        }
    }

    protected toMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }
        if (typeof error === 'string') {
            return error;
        }
        try {
            return JSON.stringify(error);
        } catch {
            return String(error);
        }
    }
}
