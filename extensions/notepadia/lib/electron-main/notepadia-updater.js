"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotepadiaUpdater = void 0;
const inversify_1 = require("@theia/core/shared/inversify");
const logger_1 = require("@theia/core/lib/common/logger");
const electron_1 = require("electron");
const electron_updater_1 = require("electron-updater");
const DISABLED_MESSAGE = 'Automatic updates are only available in packaged applications.';
let NotepadiaUpdater = class NotepadiaUpdater {
    logger;
    client;
    status = { state: 'checking', currentVersion: electron_1.app.getVersion() };
    availableVersion;
    constructor(logger) {
        this.logger = logger;
    }
    setClient(client) {
        this.client = client;
        if (client) {
            client.notifyUpdateStatusChanged(this.status);
        }
    }
    dispose() {
        this.client = undefined;
    }
    /**
     * The startup check belongs to the frontend: it schedules it (so the
     * popup policy lives in one place) instead of this contribution running a
     * second, duplicate check against GitHub Releases on every launch.
     */
    onStart(_application) {
        if (electron_1.app.isPackaged) {
            this.configureAutoUpdater();
        }
        else {
            this.setStatus(this.disabledStatus());
        }
    }
    checkForUpdates() {
        if (!electron_1.app.isPackaged) {
            this.setStatus(this.disabledStatus());
            return Promise.resolve(this.status);
        }
        try {
            electron_updater_1.autoUpdater.checkForUpdates().catch(error => this.setStatus({
                state: 'error',
                currentVersion: electron_1.app.getVersion(),
                message: this.toMessage(error)
            }));
        }
        catch (error) {
            this.setStatus({
                state: 'error',
                currentVersion: electron_1.app.getVersion(),
                message: this.toMessage(error)
            });
        }
        return Promise.resolve(this.status);
    }
    downloadUpdate() {
        if (!electron_1.app.isPackaged) {
            this.setStatus(this.disabledStatus());
            return Promise.resolve(this.status);
        }
        try {
            electron_updater_1.autoUpdater.downloadUpdate().catch(error => this.setStatus({
                state: 'error',
                currentVersion: electron_1.app.getVersion(),
                message: this.toMessage(error)
            }));
        }
        catch (error) {
            this.setStatus({
                state: 'error',
                currentVersion: electron_1.app.getVersion(),
                message: this.toMessage(error)
            });
        }
        return Promise.resolve(this.status);
    }
    quitAndInstall() {
        if (electron_1.app.isPackaged) {
            electron_updater_1.autoUpdater.quitAndInstall();
        }
    }
    configureAutoUpdater() {
        // The download is offered in the Check for Updates dialog rather than
        // started unseen in the background, so `autoDownload` is off and the
        // frontend calls `downloadUpdate` when the user accepts the update.
        electron_updater_1.autoUpdater.autoDownload = false;
        electron_updater_1.autoUpdater.autoInstallOnAppQuit = true;
        try {
            // Ensure feed URL is set for GitHub Releases (in case electron-builder
            // publish config isn't picked up in some environments)
            electron_updater_1.autoUpdater.setFeedURL({
                provider: 'github',
                owner: 'mrhunsaker',
                repo: 'notepadia-theia'
            });
        }
        catch (e) {
            this.logger.warn('Failed to set autoUpdater feed URL: ' + this.toMessage(e));
        }
        electron_updater_1.autoUpdater.logger = {
            info: message => this.logger.info(this.toMessage(message)),
            warn: message => this.logger.warn(this.toMessage(message)),
            error: message => this.logger.error(this.toMessage(message)),
            debug: message => this.logger.debug(this.toMessage(message))
        };
        const status = (state, extra) => ({ state, currentVersion: electron_1.app.getVersion(), ...extra });
        electron_updater_1.autoUpdater.on('checking-for-update', () => this.setStatus(status('checking')));
        electron_updater_1.autoUpdater.on('update-available', info => {
            this.availableVersion = info.version;
            this.setStatus(status('update-available', { nextVersion: info.version }));
        });
        electron_updater_1.autoUpdater.on('update-not-available', info => this.setStatus(status('update-not-available', { nextVersion: info.version })));
        electron_updater_1.autoUpdater.on('download-progress', progress => this.setStatus(status('download-progress', { nextVersion: this.availableVersion, percent: progress.percent })));
        electron_updater_1.autoUpdater.on('update-downloaded', info => this.setStatus(status('update-downloaded', { nextVersion: info.version })));
        electron_updater_1.autoUpdater.on('error', error => this.setStatus(status('error', { message: this.toMessage(error) })));
    }
    disabledStatus() {
        return { state: 'disabled', currentVersion: electron_1.app.getVersion(), message: DISABLED_MESSAGE };
    }
    setStatus(status) {
        this.status = status;
        if (this.client) {
            this.client.notifyUpdateStatusChanged(status);
        }
    }
    toMessage(error) {
        if (error instanceof Error) {
            return error.message;
        }
        if (typeof error === 'string') {
            return error;
        }
        try {
            return JSON.stringify(error);
        }
        catch {
            return String(error);
        }
    }
};
exports.NotepadiaUpdater = NotepadiaUpdater;
exports.NotepadiaUpdater = NotepadiaUpdater = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)(logger_1.ILogger)),
    __metadata("design:paramtypes", [Object])
], NotepadiaUpdater);
//# sourceMappingURL=notepadia-updater.js.map