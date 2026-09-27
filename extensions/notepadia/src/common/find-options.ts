import { extendedToLiteral } from './extended-search';

/**
 * Search-mode radio group shared by every tab of the Notepad++ Find dialog
 * (and the dedicated Mark submenu). `extended` decodes the Notepad++ escape
 * table and searches the result literally; `regex` passes the term through as
 * a regular expression; `normal` treats the term verbatim.
 */
export type NotepadiaSearchMode = 'normal' | 'extended' | 'regex';

/**
 * The Find dialog's complete search options. Pure state so it is trivially
 * unit-testable and can be handed to the Mark engine, the Find Next / Find All
 * engine and the F3 continuation alike.
 */
export interface FindOptions {
    readonly term: string;
    readonly replace: string;
    readonly mode: NotepadiaSearchMode;
    readonly caseSensitive: boolean;
    readonly wholeWord: boolean;
    readonly wrap: boolean;
    readonly backward: boolean;
    readonly dotMatchesNewline: boolean;
    readonly inSelection: boolean;
}

export const DEFAULT_FIND_OPTIONS: FindOptions = {
    term: '',
    replace: '',
    mode: 'normal',
    caseSensitive: false,
    wholeWord: false,
    wrap: true,
    backward: false,
    dotMatchesNewline: false,
    inSelection: false
};

export interface ResolvedSearch {
    /** The pattern handed to the editor's search primitives. */
    readonly term: string;
    /** Whether `term` must be interpreted as a regular expression. */
    readonly isRegex: boolean;
}

/**
 * Resolve a raw dialog term through the selected search mode:
 *  - normal: used verbatim (literal search);
 *  - extended: decoded with the Notepad++ escape table, then searched with
 *    literal (non-regex) semantics. `\n`, `\t`, `\r`, `\0`, `\\`, `\xHH`,
 *    `\oOOO`, `\dDDD` and `\bBBBBBBBB` are honoured (see extended-search.ts);
 *  - regex: passed through untouched as a regular expression.
 */
export function resolveSearch(rawTerm: string, mode: NotepadiaSearchMode): ResolvedSearch {
    switch (mode) {
        case 'extended':
            return { term: extendedToLiteral(rawTerm), isRegex: false };
        case 'regex':
            return { term: rawTerm, isRegex: true };
        default:
            return { term: rawTerm, isRegex: false };
    }
}

/**
 * Notepad++ / editor-style match summary shown in the dialog status line,
 * mirroring the count formats of the classic find widget:
 *  - no matches: 'No results';
 *  - otherwise `"<current> of <found>"` where `<current>` is the 1-based index
 *    of the selection within the result set (0 when nothing is selected).
 */
export function describeMatchCount(found: number, index: number): string {
    if (found === 0) {
        return 'No results';
    }
    return `${index} of ${found}`;
}

/** Npp retains the last 20 entries of each Find dialog history field. */
export const FIND_HISTORY_LIMIT = 20;

/**
 * Append `value` to a history list: the newest entry first, duplicates
 * removed, capped at `FIND_HISTORY_LIMIT`. Returns a new array.
 */
export function addHistory(history: readonly string[], value: string): string[] {
    const trimmed = value.trim();
    if (!trimmed) {
        return [...history];
    }
    const without = history.filter(entry => entry !== trimmed);
    return [trimmed, ...without].slice(0, FIND_HISTORY_LIMIT);
}