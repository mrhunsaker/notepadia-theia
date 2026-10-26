import { inject, injectable } from '@theia/core/shared/inversify';
import { URI } from '@theia/core/lib/common/uri';
import { FileUri } from '@theia/core/lib/common/file-uri';
import { WorkspaceFileService } from '@theia/workspace/lib/common';
import { DefaultWorkspaceServer } from '@theia/workspace/lib/node/default-workspace-server';
import * as fs from 'fs';

/**
 * Notepadia can be launched with a document, and Theia records whatever it was
 * last asked to open as the most recently used workspace root. A plain file is
 * not a valid root, but the stock server only checks whether the path exists,
 * so the next launch treats that document as the workspace and reopens it even
 * after it was closed. Keep only directories and real workspace files in the
 * MRU, and ignore them when restoring the root.
 */
@injectable()
export class NotepadiaWorkspaceServer extends DefaultWorkspaceServer {

    @inject(WorkspaceFileService)
    protected readonly workspaceFileService!: WorkspaceFileService;

    protected override async getRoot(): Promise<string | undefined> {
        const cliRoot = await this.getWorkspaceURIFromCli();
        if (cliRoot) {
            return cliRoot;
        }
        const data = await this.readRecentWorkspacePathsFromUserHome();
        if (!data) {
            return undefined;
        }
        const restorable: string[] = [];
        for (const root of data.recentRoots) {
            if (await this.canRestoreWorkspaceRoot(root)) {
                restorable.push(root);
            }
        }
        if (restorable.length !== data.recentRoots.length) {
            await this.writeToUserHome({ recentRoots: restorable });
        }
        return restorable[0];
    }

    override async getRecentWorkspaces(): Promise<string[]> {
        const recent = await super.getRecentWorkspaces();
        const restorable: string[] = [];
        for (const root of recent) {
            if (await this.canRestoreWorkspaceRoot(root)) {
                restorable.push(root);
            }
        }
        return restorable;
    }

    override async setMostRecentlyUsedWorkspace(rawUri: string): Promise<void> {
        if (rawUri && !await this.canRestoreWorkspaceRoot(rawUri)) {
            return;
        }
        return super.setMostRecentlyUsedWorkspace(rawUri);
    }

    protected async canRestoreWorkspaceRoot(rawUri: string): Promise<boolean> {
        let uri: URI;
        try {
            uri = new URI(rawUri);
        } catch {
            return false;
        }
        if (uri.scheme !== 'file') {
            return true;
        }
        const filePath = FileUri.fsPath(uri);
        try {
            const stat = await fs.promises.stat(filePath);
            return stat.isDirectory() || (stat.isFile() && this.workspaceFileService.isWorkspaceFile(uri));
        } catch {
            return false;
        }
    }
}
