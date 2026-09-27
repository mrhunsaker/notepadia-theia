/**
 * Pure helpers behind the browser-only "open and save files on the user's own
 * computer" flow (WS-D / D1).
 *
 * Notepad++ always means the user's own disk when it says Open and Save. A
 * browser-hosted Theia cannot: the app is served by a remote server, so
 * `file://` does not exist and File > Open only ever browsed the SERVER's
 * workspace. These helpers hold the name arithmetic and the error
 * classification for the two routes that bridge the gap:
 *
 *   - `window.showOpenFilePicker` / `window.showSaveFilePicker`
 *     (File System Access API, Chromium only), and
 *   - a hidden `<input type="file">` plus a Blob download, which is what
 *     Firefox and Safari get.
 *
 * They are deliberately free of Theia and DOM types so the naming rules and
 * the abort/permission triage can be unit tested directly.
 */

export interface SplitName {
    /** The name without its extension, e.g. `notes` for `notes.txt`. */
    readonly base: string;
    /** The extension including the leading dot, or an empty string. */
    readonly extension: string;
}

/**
 * Splits a file name into base and extension. A leading dot marks a dotfile
 * (`.gitignore` keeps its whole name as the base) and a name with no dot has no
 * extension, so `Makefile` is never rewritten to `Makefile.`.
 */
export function splitName(name: string): SplitName {
    const trimmed = name.replace(/\\/g, '/');
    const leaf = trimmed.slice(trimmed.lastIndexOf('/') + 1);
    const dot = leaf.lastIndexOf('.');
    if (dot <= 0) {
        return { base: leaf, extension: '' };
    }
    return { base: leaf.slice(0, dot), extension: leaf.slice(dot) };
}

/**
 * Produces the tab name for a file opened from the user's computer, keeping
 * the real file name visible in the tab and the status bar.
 *
 * A second `notes.txt` must not collide with the first, so the first collision
 * becomes `notes (2).txt` and so on - the same shape Theia's own untitled
 * resources use. `taken` is asked about full names, not base names.
 */
export function uniqueName(desired: string, taken: (name: string) => boolean): string {
    if (!taken(desired)) {
        return desired;
    }
    const { base, extension } = splitName(desired);
    for (let counter = 2; ; counter++) {
        const candidate = `${base} (${counter})${extension}`;
        if (!taken(candidate)) {
            return candidate;
        }
    }
}

/**
 * The name offered to the save picker and used for the download fallback. It
 * comes from the tab's own file name, so a tab opened from `C:\notes.txt`
 * suggests `notes.txt` rather than a URI path.
 */
export function suggestedSaveName(fileName: string | undefined): string {
    const trimmed = (fileName ?? '').replace(/\\/g, '/').trim();
    if (!trimmed) {
        return 'new 1.txt';
    }
    const leaf = trimmed.slice(trimmed.lastIndexOf('/') + 1).trim();
    return leaf || 'new 1.txt';
}

/** The accept filter handed to `showOpenFilePicker`, text files first. */
export const LOCAL_FILE_PICKER_TYPES: ReadonlyArray<{
    description: string;
    accept: Record<string, string[]>;
}> = [
    {
        description: 'Text and source files',
        accept: {
            'text/plain': ['.txt', '.md', '.log', '.csv'],
            'text/x-csrc': ['.c', '.h'],
            'text/x-c++src': ['.cpp', '.hpp', '.cc', '.hxx'],
            'application/javascript': ['.js', '.mjs', '.cjs'],
            'application/json': ['.json', '.jsonc'],
            'text/x-python': ['.py'],
            'text/html': ['.html', '.htm', '.css'],
            'application/xml': ['.xml']
        }
    },
    {
        description: 'All files',
        accept: { '*/*': ['.'] }
    }
];

/**
 * How a File System Access API call ended.
 *
 * - `cancelled` - the user dismissed the picker. Never report it; the spec is
 *   explicit that a cancelled picker is not an error.
 * - `denied` - the browser refused write permission. Must produce a message
 *   that names the file, so the user knows what was not saved.
 * - `unavailable` - the API exists but cannot be used here (no user gesture,
 *   insecure context, not implemented). The caller falls back to the
 *   input/download route.
 */
export type PickerOutcome = 'cancelled' | 'denied' | 'unavailable';

export function classifyPickerError(error: unknown): PickerOutcome {
    if (!error || typeof error !== 'object') {
        return 'unavailable';
    }
    const name = (error as { name?: string }).name;
    if (name === 'AbortError') {
        return 'cancelled';
    }
    if (name === 'NotAllowedError') {
        // Chromium reuses NotAllowedError for a dismissed picker and for a
        // genuine permission refusal; only the refusal carries a message
        // about the permission itself.
        return mentionsPermission(error as { message?: string }) ? 'denied' : 'cancelled';
    }
    // SecurityError (no user activation / insecure context) and anything else
    // means the API is not usable right now, not that the user said no.
    return 'unavailable';
}

function mentionsPermission(error: { message?: string }): boolean {
    const message = (error.message ?? '').toLowerCase();
    return message.includes('permission') || message.includes('readwrite') || message.includes('not allowed');
}

/**
 * Reads a picked `File`/`Blob` as UTF-8 text. Wrapped so a rejected read is a
 * normal Error the contribution can report with the file's name attached.
 */
export function readFileAsText(file: Blob): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error ?? new Error('read failed'));
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.readAsText(file);
    });
}

/** Triggers a browser download of `text` as `fileName` without a picker. */
export function downloadText(fileName: string, text: string, doc: Document = document): void {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = doc.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.style.display = 'none';
    doc.body.appendChild(anchor);
    try {
        anchor.click();
    } finally {
        if (anchor.parentNode) {
            anchor.parentNode.removeChild(anchor);
        }
        // Give the browser a tick to start the transfer before revoking.
        setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
}
