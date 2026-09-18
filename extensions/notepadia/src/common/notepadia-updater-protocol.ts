import { RpcServer } from '@theia/core/lib/common/messaging/proxy-factory';

export const NotepadiaUpdaterPath = '/services/notepadia/updater';

export type NotepadiaUpdateState =
    | 'checking'
    | 'update-available'
    | 'download-progress'
    | 'update-downloaded'
    | 'update-not-available'
    | 'error'
    | 'disabled';

export interface NotepadiaUpdateStatus {
    readonly state: NotepadiaUpdateState;
    readonly currentVersion?: string;
    readonly nextVersion?: string;
    readonly percent?: number;
    readonly message?: string;
}

export interface NotepadiaUpdaterClient {
    notifyUpdateStatusChanged(status: NotepadiaUpdateStatus): void;
}

export const NotepadiaUpdaterService = Symbol('NotepadiaUpdaterService');

export interface NotepadiaUpdaterService extends RpcServer<NotepadiaUpdaterClient> {
    checkForUpdates(): Promise<NotepadiaUpdateStatus>;
    quitAndInstall(): void;
}
