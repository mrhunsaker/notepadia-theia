/**
 * Notepad++ status bar field formatters (A5). Pure and dependency-free so
 * the formatting rules are unit-testable; the live editor wiring lives in
 * notepadia-status-bar-contribution.ts.
 */

/** Format an integer with Notepad++'s grouped (1,234) thousands separators. */
export function thousands(value: number): string {
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * 'length : 1,234  lines : 56' - the document's character count and line
 * count. Two spaces separate the fields, exactly as Notepad++ renders them.
 */
export function formatLength(chars: number, lines: number): string {
    return `length : ${thousands(chars)}  lines : ${thousands(lines)}`;
}

/**
 * 'Ln : 3  Col : 12  Pos : 47' - the caret's 1-based line/column and its
 * 0-based character offset. Two spaces separate the fields.
 */
export function formatCaret(line: number, col: number, offset: number): string {
    return `Ln : ${line}  Col : ${col}  Pos : ${thousands(offset)}`;
}

/**
 * 'Sel : 18 | 2' - selected characters | spanned lines for an active
 * selection, and 'Sel : 0 | 0' when nothing is selected.
 */
export function formatSelection(chars: number, lines: number): string {
    return `Sel : ${thousands(chars)} | ${thousands(lines)}`;
}