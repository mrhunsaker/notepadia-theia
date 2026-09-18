import { injectable } from '@theia/core/shared/inversify';
import { FileUri } from '@theia/core/lib/common/file-uri';
import {
    ElectronMainApplication,
    ElectronMainCommandOptions
} from '@theia/core/lib/electron-main/electron-main-application';
import { TheiaRendererAPI } from '@theia/core/lib/electron-main/electron-api-main';
import * as fs from 'fs';
import * as path from 'path';

const WORKSPACE_FILE_EXTENSIONS = new Set(['.theia-workspace', '.code-workspace']);

@injectable()
export class NotepadiaElectronMainApplication extends ElectronMainApplication {

    protected isWorkspaceFile(filePath: string): boolean {
        return WORKSPACE_FILE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
    }

    override async handleMainCommand(options: ElectronMainCommandOptions): Promise<void> {
        let filePath: string | undefined;
        if (options.file) {
            try {
                filePath = await fs.promises.realpath(path.resolve(options.cwd, options.file));
            } catch {
                console.error(`Could not resolve the workspace path. "${options.file}" is not a valid 'file' option. Falling back to the default workspace location.`);
            }
        }

        if (filePath !== undefined) {
            try {
                const stat = await fs.promises.stat(filePath);
                if (stat.isFile() && !this.isWorkspaceFile(filePath)) {
                    await this.openFileInEditor(filePath, options.secondInstance);
                    return;
                }
            } catch (error) {
                console.error(`Could not inspect the file. "${options.file}" is not a valid 'file' option. Falling back to the default workspace location.`, error);
            }

            await this.openWindowWithWorkspace(filePath);
        } else if (options.secondInstance === false) {
            await this.openWindowWithWorkspace(''); // restore previous workspace.
        } else if (options.file === undefined) {
            await this.openDefaultWindow();
        }
    }

    protected async openFileInEditor(filePath: string, secondInstance: boolean): Promise<void> {
        const fileUri = FileUri.create(filePath).toString();
        if (secondInstance) {
            await this.openUrl(fileUri);
            return;
        }

        const window = await this.openWindowWithWorkspace(''); // restore previous workspace.
        const listener = TheiaRendererAPI.onApplicationStateChanged(window.webContents, state => {
            if (state === 'ready') {
                listener.dispose();
                this.openUrl(fileUri);
            }
        });
    }
}