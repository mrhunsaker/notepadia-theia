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
    protected status: NotepadiaUpdateStatus = { state: 'checking', currentVersion: app.getVersion() };
    protected availableVersion?: string;

    constructor(@inject(ILogger) protected readonly logger: ILogger) { }

    setClient(client: NotepadiaUpdaterClient | undefined): void {
        this.client = client;
        if (client) {
            client.notifyUpdateStatusChanged(this.status);
        }
    }

    dispose(): void {
        this.client = undefined;
    }

    /**
     * The startup check belongs to the frontend: it schedules it (so the
     * popup policy lives in one place) instead of this contribution running a
     * second, duplicate check against GitHub Releases on every launch.
     */
    onStart(_application: ElectronMainApplication): void {
        if (app.isPackaged) {
            this.configureAutoUpdater();
        } else {
            this.setStatus(this.disabledStatus());
        }
    }

    checkForUpdates(): Promise<NotepadiaUpdateStatus> {
        if (!app.isPackaged) {
            this.setStatus(this.disabledStatus());
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

    downloadUpdate(): Promise<NotepadiaUpdateStatus> {
        if (!app.isPackaged) {
            this.setStatus(this.disabledStatus());
            return Promise.resolve(this.status);
        }
        try {
            autoUpdater.downloadUpdate().catch(error =>
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
        // The download is offered in the Check for Updates dialog rather than
        // started unseen in the background, so `autoDownload` is off and the
        // frontend calls `downloadUpdate` when the user accepts the update.
        autoUpdater.autoDownload = false;
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
        autoUpdater.on('update-available', info => {
            this.availableVersion = info.version;
            this.setStatus(status('update-available', { nextVersion: info.version }));
        });
        autoUpdater.on('update-not-available', info =>
            this.setStatus(status('update-not-available', { nextVersion: info.version })));
        autoUpdater.on('download-progress', progress =>
            this.setStatus(status('download-progress', { nextVersion: this.availableVersion, percent: progress.percent })));
        autoUpdater.on('update-downloaded', info =>
            this.setStatus(status('update-downloaded', { nextVersion: info.version })));
        autoUpdater.on('error', error =>
            this.setStatus(status('error', { message: this.toMessage(error) })));
    }

    protected disabledStatus(): NotepadiaUpdateStatus {
        return { state: 'disabled', currentVersion: app.getVersion(), message: DISABLED_MESSAGE };
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
