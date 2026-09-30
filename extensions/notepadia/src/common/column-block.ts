/**
 * Pure logic behind `Edit > Column Mode...`.
 *
 * Monaco can already do a rectangular selection with Alt+drag, but that is a
 * mouse gesture a keyboard user never finds. The menu command takes the
 * selection that is already on screen and turns it into one selection per line,
 * each covering the same columns - which is what a block selection is, and
 * what every later Shift+Arrow then extends.
 *
 * Working out the per-line ranges is arithmetic over line lengths, so it lives
 * here where the clamping rules (short lines, a backwards drag, the phantom
 * line after a final newline) can be pinned down by tests.
 */

export interface ColumnBlockInput {
    /** 1-based first line of the selection, or of the caret for a bare caret. */
    startLine: number;
    /** 1-based last line; may be before `startLine` for a backwards drag. */
    endLine: number;
    /** 1-based column where the selection starts on its first line. */
    startColumn: number;
    /** 1-based column where it ends on its last line. */
    endColumn: number;
    /** Number of lines in the document. */
    lineCount: number;
    /** `maxColumn(line)` for every line, 1-based: index 0 is line 1. */
    lineMaxColumns: number[];
    /** True for a bare caret, which becomes a block out to the end of its line. */
    caretOnly?: boolean;
}

/** One line of the block: `startColumn === endColumn` means a caret there. */
export interface ColumnBlockSelection {
    line: number;
    startColumn: number;
    endColumn: number;
}

const clamp = (value: number, low: number, high: number): number => Math.min(Math.max(value, low), high);

/**
 * The per-line selections a Column Mode request turns into, top line first.
 *
 * Three rules, all of them things the mouse gesture gets for free and a naive
 * port does not:
 *
 *  - a line shorter than the block gets a selection clipped to its own end, so
 *    a five-line block over ragged text does not throw;
 *  - a selection made upwards is reordered rather than rejected;
 *  - the empty line a trailing newline leaves behind is left alone, because
 *    there is no column on it to put a cursor in.
 */
export function columnBlockSelections(input: ColumnBlockInput): ColumnBlockSelection[] {
    const lastLine = Math.max(1, input.lineCount);
    const first = clamp(Math.min(input.startLine, input.endLine), 1, lastLine);
    const last = clamp(Math.max(input.startLine, input.endLine), 1, lastLine);
    const left = Math.min(input.startColumn, input.endColumn);
    const right = Math.max(input.startColumn, input.endColumn);

    const selections: ColumnBlockSelection[] = [];
    for (let line = first; line <= last; line++) {
        const maxColumn = input.lineMaxColumns[line - 1] ?? 1;
        // The phantom line after a final newline: no content, no column.
        if (maxColumn <= 1 && line === lastLine && !input.caretOnly) {
            continue;
        }
        const column = clamp(left, 1, Math.max(1, maxColumn));
        if (input.caretOnly) {
            // A bare caret becomes a block out to the end of its own line, so
            // there is something to extend with Shift+Arrow; a caret already at
            // the end of the line stays a caret.
            const endColumn = column >= maxColumn ? column : maxColumn;
            selections.push({ line, startColumn: column, endColumn });
            continue;
        }
        const startColumn = clamp(left, 1, Math.max(1, maxColumn - 1));
        const endColumn = clamp(right, startColumn, maxColumn);
        selections.push({ line, startColumn, endColumn });
    }
    return selections;
}
