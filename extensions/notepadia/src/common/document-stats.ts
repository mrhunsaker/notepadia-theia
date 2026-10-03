/**
 * Notepad++ `View > Summary...` counters (C3 step 8). Pure and dependency-free
 * so the counting rules are unit-testable; the dialog that shows them lives in
 * notepadia-view-contribution.ts.
 *
 * The character and line figures reuse the status bar's own formatters
 * (status-fields.ts) rather than inventing a second set of rules, so the dialog
 * and the status bar can never disagree about the same document.
 */

import { formatLength, formatSelection, thousands } from './status-fields';

export interface DocumentStats {
    /** Characters in the whole document. */
    characters: number;
    /** Characters in the current selection, 0 when nothing is selected. */
    selectedCharacters: number;
    /** Lines in the whole document. */
    lines: number;
    /** Lines the current selection spans. */
    selectedLines: number;
    /** Words in the whole document. */
    words: number;
    /**
     * Words in the selection. Notepad++ leaves this blank rather than reporting
     * zero when nothing is selected, because a zero there reads as "the
     * selection contains no words" instead of "there is no selection".
     */
    selectedWords?: number;
}

/**
 * Count words the way Notepad++ counts them: a run of characters that are not
 * whitespace and not one of the separator punctuation. This is deliberately not
 * `\S+`, because that would make `a,b` one word; Notepad++ counts it as two.
 *
 * Line breaks are whitespace, so a word never spans a line.
 */
export function countWords(text: string): number {
    // Every character that is neither whitespace nor a word character ends a
    // word. `\W` under the ASCII flag is exactly that set, and matching one
    // character at a time is what keeps the count correct for non-Latin text.
    const parts = text.split(/[^\p{L}\p{N}_]+/u);
    let count = 0;
    for (const part of parts) {
        if (part.length > 0) {
            count++;
        }
    }
    return count;
}

/** Build the full set of statistics for a document and an optional selection. */
export function documentStats(params: {
    text: string;
    lineCount: number;
    selectedText?: string;
    selectedLineCount?: number;
}): DocumentStats {
    const stats: DocumentStats = {
        characters: params.text.length,
        lines: params.lineCount,
        words: countWords(params.text),
        selectedCharacters: 0,
        selectedLines: 0
    };
    if (params.selectedText !== undefined) {
        stats.selectedCharacters = params.selectedText.length;
        stats.selectedLines = params.selectedLineCount ?? 0;
        stats.selectedWords = countWords(params.selectedText);
    }
    return stats;
}

/**
 * The dialog's rows, in Notepad++'s order, as label/value pairs the dialog can
 * render directly. A selected-words row is omitted entirely when nothing is
 * selected, which is what Notepad++ does.
 */
export function summaryRows(stats: DocumentStats): Array<{ label: string; value: string }> {
    const rows: Array<{ label: string; value: string }> = [
        { label: 'Characters', value: thousands(stats.characters) },
        { label: 'Words', value: thousands(stats.words) }
    ];
    if (stats.selectedWords !== undefined) {
        rows.push({ label: 'Selected characters', value: thousands(stats.selectedCharacters) });
        rows.push({ label: 'Selected words', value: thousands(stats.selectedWords) });
    }
    return rows;
}

/**
 * The figures as the status bar renders them, so the dialog can show the same
 * "length : N  lines : N" and "Sel : N | N" strings the user already reads.
 */
export function summaryAsStatusFields(stats: DocumentStats): {
    length: string;
    selection: string;
} {
    return {
        length: formatLength(stats.characters, stats.lines),
        selection: formatSelection(stats.selectedCharacters, stats.selectedLines)
    };
}