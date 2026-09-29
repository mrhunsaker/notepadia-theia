/**
 * C1 - the pure decisions behind the Notepad++ File menu entries that touch
 * real files (Reload from Disk, Save a Copy As..., Rename..., Delete from
 * Disk).
 *
 * These live in common/ with no Theia imports because they are the parts that
 * can be wrong in ways nobody notices until a file goes missing: a rename
 * box that accepts "..", a delete confirmation that does not say what it is
 * about to delete. A unit test can pin all of that; a browser test can only
 * spot it afterwards.
 */

/** Where a Rename should move the file, or why the typed name is unusable. */
export type RenameResolution =
    | { ok: true; path: string }
    | { ok: false; reason: string };

/**
 * Resolve what the user typed in the Rename box against the file's current
 * path.
 *
 * Notepad++ accepts a relative path here, so `sub/notes.txt` moves the file
 * into a subfolder of the one it is already in. Two things are refused
 * deliberately: a `..` segment, and an absolute path. Both would take the file
 * out of the folder the user is looking at, which for a menu entry that says
 * "Rename" is a surprise with a lost file attached to it.
 */
export function resolveRenameTarget(currentPath: string, entered: string): RenameResolution {
    const typed = entered.trim();
    if (!typed) {
        return { ok: false, reason: 'Enter a name for the file.' };
    }
    if (typed === '.' || typed === '..') {
        return { ok: false, reason: 'Enter a name for the file, not "." or "..".' };
    }
    if (typed.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(typed)) {
        return { ok: false, reason: 'Enter a name relative to the file\'s folder, not an absolute path.' };
    }
    // "./b.txt" means the folder the file is already in, so a "." segment is
    // resolved away rather than treated as an error; a ".." segment is refused.
    const segments = typed.split('/').filter(segment => segment !== '' && segment !== '.');
    if (segments.includes('..')) {
        return { ok: false, reason: 'A rename cannot move a file out of its folder with "..".' };
    }
    if (segments.length === 0) {
        return { ok: false, reason: 'Enter a name for the file, not a folder.' };
    }
    if (typed.endsWith('/')) {
        return { ok: false, reason: 'Enter a name for the file, not a folder.' };
    }
    // The parent keeps its trailing slash, so a file at the filesystem root
    // resolves to '/b.txt' rather than losing the leading slash.
    const slash = currentPath.lastIndexOf('/');
    const parent = slash < 0 ? '' : currentPath.slice(0, slash + 1);
    const path = parent + segments.join('/');
    if (path === currentPath) {
        return { ok: false, reason: 'That is the name the file already has.' };
    }
    return { ok: true, path };
}

/**
 * The Reload from Disk warning. Notepad++ asks only when there is something to
 * lose, and says plainly that the changes are the thing being lost.
 */
export function reloadFromDiskMessage(name: string, isDirty: boolean): string {
    return isDirty
        ? `"${name}" has been modified. Reload it from disk and lose the changes?`
        : `Reload "${name}" from disk?`;
}

/** The Delete from Disk confirmation, with the same unsaved-changes warning. */
export function deleteFromDiskMessage(name: string, isDirty: boolean): string {
    return isDirty
        ? `"${name}" has been modified. Delete it from disk and lose the changes?`
        : `Are you sure you want to delete "${name}" from disk?`;
}

/**
 * The default file name offered by Save a Copy As: the current name, so the
 * user only has to change the part they meant to change. A file that has no
 * extension of its own (untitled `new 1`) gets `.txt`, because a copy with no
 * extension is a file the user's own tools will not open.
 */
export function copyNameFor(name: string): string {
    const base = name.endsWith('/') ? name.slice(0, -1) : name;
    const slash = base.lastIndexOf('/');
    const fileName = slash < 0 ? base : base.slice(slash + 1);
    if (!fileName) {
        return 'copy.txt';
    }
    return fileName.includes('.') ? fileName : `${fileName}.txt`;
}
