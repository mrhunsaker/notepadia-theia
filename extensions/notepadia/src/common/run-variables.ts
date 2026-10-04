/**
 * Notepad++'s Run command variables.
 *
 * A saved Run command is a template like
 * `firefox "$(FULL_CURRENT_PATH)"` or
 * `python "$(CURRENT_DIRECTORY)\$(FILE_NAME)"`. Before the command is handed to
 * anything, `$(NAME)` is replaced by the value for the current document.
 *
 * Everything here is a pure function of the context object so it can be unit
 * tested without a browser, a DOM or an editor. An unknown variable is left
 * exactly as written, which is Notepad++'s behaviour and the only safe choice:
 * silently dropping `$(HOME)` would run a different command than the one the
 * user typed.
 */

export interface RunVariableContext {
    /** Full path of the current document, or empty for an unsaved document. */
    readonly fullPath: string;
    /** Word under the caret, if there is one. */
    readonly currentWord?: string;
    /** 1-based caret line number. */
    readonly currentLine?: number;
    /** Text of the line the caret is on. */
    readonly currentLineString?: string;
    /** 1-based caret column. */
    readonly currentColumn?: number;
}

/**
 * `$(NAME)`. Names are the upper-case, underscore-separated names Notepad++
 * uses; anything else is not a variable and is passed through untouched.
 */
const VARIABLE = /\$\(([A-Z0-9_]+)\)/g;

/** The file name after the last `/` or `\`. */
export function fileNameOf(fullPath: string): string {
    if (!fullPath) {
        return '';
    }
    const parts = fullPath.split(/[\\/]/);
    return parts[parts.length - 1] ?? '';
}

/**
 * The directory part of a path, without a trailing separator. A path with no
 * separator has no directory; a rooted path such as `/hosts` keeps its root
 * (the separator itself) rather than collapsing to the empty string.
 */
export function directoryOf(fullPath: string): string {
    if (!fullPath) {
        return '';
    }
    const index = Math.max(fullPath.lastIndexOf('/'), fullPath.lastIndexOf('\\'));
    if (index < 0) {
        return '';
    }
    if (index === 0) {
        return fullPath[0];
    }
    return fullPath.slice(0, index);
}

/**
 * The file name without its final extension. A dotfile such as `.gitignore` is
 * all name, and `archive.tar.gz` keeps `archive.tar`, because only the last
 * extension is removed.
 */
export function namePartOf(fileName: string): string {
    const dot = fileName.lastIndexOf('.');
    return dot > 0 ? fileName.slice(0, dot) : fileName;
}

/**
 * The final extension without its dot. A dotfile or a trailing dot has no
 * extension and returns the empty string.
 */
export function extensionOf(fileName: string): string {
    const dot = fileName.lastIndexOf('.');
    return dot > 0 ? fileName.slice(dot + 1) : '';
}

/**
 * Replaces every known `$(NAME)` in `template` with the value for `context`,
 * leaving unknown names alone.
 */
export function expandRunVariables(template: string, context: RunVariableContext): string {
    const fileName = fileNameOf(context.fullPath);
    const values: Readonly<Record<string, string>> = {
        FULL_CURRENT_PATH: context.fullPath,
        CURRENT_DIRECTORY: directoryOf(context.fullPath),
        FILE_NAME: fileName,
        NAME_PART: namePartOf(fileName),
        EXT_PART: extensionOf(fileName),
        CURRENT_WORD: context.currentWord ?? '',
        CURRENT_LINE: context.currentLine === undefined ? '' : String(context.currentLine),
        CURRENT_LINESTR: context.currentLineString ?? '',
        CURRENT_COLUMN: context.currentColumn === undefined ? '' : String(context.currentColumn)
    };
    return template.replace(VARIABLE, (match, name: string) =>
        Object.prototype.hasOwnProperty.call(values, name) ? values[name] : match);
}
