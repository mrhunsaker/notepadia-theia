/**
 * Workspace roots are either a directory or a Theia/VS Code workspace file.
 * A plain file is an editor argument, not a workspace: treating one as the
 * workspace root makes the next launch reopen that file as a folder and
 * ignores every directory the user actually worked in.
 */
export const WORKSPACE_FILE_EXTENSIONS = ['.theia-workspace', '.code-workspace'];

export function isWorkspaceFilePath(filePath: string): boolean {
    const lower = filePath.toLowerCase();
    return WORKSPACE_FILE_EXTENSIONS.some(extension => lower.endsWith(extension));
}

export interface WorkspaceRootStat {
    isDirectory(): boolean;
    isFile(): boolean;
}

/** Whether a filesystem entry may be remembered and restored as a workspace root. */
export function isRestorableWorkspaceRoot(stat: WorkspaceRootStat | undefined, filePath: string): boolean {
    if (!stat) {
        return false;
    }
    return stat.isDirectory() || (stat.isFile() && isWorkspaceFilePath(filePath));
}
