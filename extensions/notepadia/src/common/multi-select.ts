/**
 * Pure logic behind `Edit > Multi-Select All`.
 *
 * The command places a cursor on every occurrence of the thing the user has
 * already indicated - the selection if there is one, otherwise the word under
 * the caret - and does nothing at all when there is nothing to go on, rather
 * than guessing at a word and putting cursors where they were not asked for.
 */

export interface MultiSelectQuery {
    /** Text of the current selection, or `undefined` for a bare caret. */
    selectionText?: string;
    /** `getWordAtPosition` on the caret, or `undefined` when there is no word. */
    wordAtPosition?: string;
    /** `true` when the selection covers more than one line. */
    selectionIsMultiline?: boolean;
}

/**
 * The text to search for, or `undefined` when the caller has to say so.
 *
 * A multi-line selection is refused because the search engine matches within a
 * line: searching for "foo\nbar" would report nothing and look broken, which
 * is the same reason the Find dialog disables `. matches newline` rather than
 * pretending.
 */
export function multiSelectTerm(query: MultiSelectQuery): string | undefined {
    if (query.selectionText !== undefined && !query.selectionIsMultiline && query.selectionText.length > 0) {
        return query.selectionText;
    }
    if (query.wordAtPosition && query.wordAtPosition.length > 0) {
        return query.wordAtPosition;
    }
    return undefined;
}

/** The words `searchTermFor` refuses, spelled out for the message. */
export const MULTI_SELECT_NO_TARGET_MESSAGE =
    'Select a word, or a selection on one line, before using Multi-Select All.';
