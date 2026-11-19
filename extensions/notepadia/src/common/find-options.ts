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
 * One match's captured text, used to expand backreferences in a replacement
 * pattern. `groups[0]` is the whole match and `groups[n]` is capture group `n`;
 * a group that did not participate is `undefined` (and expands to '').
 */
export interface ReplacementContext {
    readonly match: string;
    readonly groups: readonly (string | undefined)[];
    readonly named?: Readonly<Record<string, string | undefined>>;
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
 * Expand a "Replace with" field into the text actually inserted for one match.
 *
 *  - normal: used verbatim (a backslash or dollar sign is just a character);
 *  - extended: decoded with the same escape table as the Find field, so `\n`,
 *    `\t`, `\x41`, `\\` etc. insert the character rather than the escape text;
 *  - regex: Notepad++-style backreferences are expanded from `context`:
 *    `\0` / `$&` / `$0` = whole match, `\1`..`\9` / `$1`..`$9` / `${n}` = capture
 *    groups, `\k<name>` / `$<name>` = named groups, `$$` = a literal `$`,
 *    `\\` = a literal backslash, and `\n` / `\r` / `\t` = control characters.
 *    Unknown escapes and groups that did not participate pass through / expand
 *    to the empty string, matching Notepad++ rather than throwing.
 */
export function resolveReplacement(
    replace: string,
    mode: NotepadiaSearchMode,
    context?: ReplacementContext
): string {
    switch (mode) {
        case 'extended':
            return extendedToLiteral(replace);
        case 'regex':
            return expandRegexReplacement(replace, context);
        default:
            return replace;
    }
}

function expandRegexReplacement(pattern: string, context?: ReplacementContext): string {
    const groups = context?.groups ?? [];
    const named = context?.named ?? {};
    const whole = context?.match ?? '';
    let out = '';
    let index = 0;
    while (index < pattern.length) {
        const ch = pattern[index];
        if (ch === '\\' && index + 1 < pattern.length) {
            const next = pattern[index + 1];
            if (next === '\\') { out += '\\'; index += 2; continue; }
            if (next === 'n') { out += '\n'; index += 2; continue; }
            if (next === 'r') { out += '\r'; index += 2; continue; }
            if (next === 't') { out += '\t'; index += 2; continue; }
            if (next === '0') { out += whole; index += 2; continue; }
            if (/[1-9]/.test(next)) {
                let end = index + 2;
                while (end < pattern.length && /[0-9]/.test(pattern[end])) {
                    end += 1;
                }
                const digits = pattern.slice(index + 1, end);
                const full = Number(digits);
                // Prefer the longest group that exists (group 12 over group 1
                // followed by '2'); otherwise fall back to the first digit.
                out += groups[full] !== undefined
                    ? (groups[full] ?? '')
                    : (groups[Number(digits[0])] ?? '') + digits.slice(1);
                index = end;
                continue;
            }
            if (next === 'k' && pattern[index + 2] === '<') {
                const end = pattern.indexOf('>', index + 3);
                if (end !== -1) {
                    out += named[pattern.slice(index + 3, end)] ?? '';
                    index = end + 1;
                    continue;
                }
            }
            // Unknown escape: keep both characters, as Notepad++ does.
            out += '\\' + next;
            index += 2;
            continue;
        }
        if (ch === '$' && index + 1 < pattern.length) {
            const next = pattern[index + 1];
            if (next === '$') { out += '$'; index += 2; continue; }
            if (next === '&') { out += whole; index += 2; continue; }
            if (next === '{') {
                const end = pattern.indexOf('}', index + 2);
                if (end !== -1) {
                    const body = pattern.slice(index + 2, end);
                    out += /^\d+$/.test(body)
                        ? (Number(body) === 0 ? whole : (groups[Number(body)] ?? ''))
                        : (named[body] ?? '');
                    index = end + 1;
                    continue;
                }
            }
            if (next === '<') {
                const end = pattern.indexOf('>', index + 2);
                if (end !== -1) {
                    out += named[pattern.slice(index + 2, end)] ?? '';
                    index = end + 1;
                    continue;
                }
            }
            if (/[0-9]/.test(next)) {
                // JavaScript's own replacement syntax uses at most two digits.
                let end = index + 2;
                while (end < pattern.length && /[0-9]/.test(pattern[end]) && end < index + 3) {
                    end += 1;
                }
                const digits = pattern.slice(index + 1, end);
                const full = Number(digits);
                if (full === 0) {
                    out += whole;
                } else if (groups[full] !== undefined) {
                    out += groups[full] ?? '';
                } else {
                    out += (groups[Number(digits[0])] ?? '') + digits.slice(1);
                }
                index = end;
                continue;
            }
            // A `$` not followed by a recognised pattern is literal.
            out += '$';
            index += 1;
            continue;
        }
        out += ch;
        index += 1;
    }
    return out;
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

/**
 * Path for the Find in Files **Directory** field when the dialog is opened
 * from a folder's context menu (E3 follow-up). The field is resolved against
 * the workspace root, so the selected folder is expressed relative to that
 * root - e.g. selected `<root>/src/lib` becomes `src/lib`, and the root itself
 * becomes `''` (an empty field means "the whole workspace").
 *
 * Returns `undefined` when the selection is not inside the root, so callers
 * leave the field untouched rather than seeding a path the backend cannot
 * resolve.
 */
export function workspaceRelativeDirectory(rootPath: string, selectedPath: string): string | undefined {
    const root = rootPath.replace(/\/+$/, '');
    const selected = selectedPath.replace(/\/+$/, '');
    if (!root || !selected) {
        return undefined;
    }
    if (selected === root) {
        return '';
    }
    if (selected.startsWith(root + '/')) {
        return selected.slice(root.length + 1);
    }
    return undefined;
}
