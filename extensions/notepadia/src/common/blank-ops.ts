/**
 * Pure, side-effect free transforms behind "Edit > Blank Operations" and the
 * extra "Edit > Line Operations" entries. Deliberately free of Theia/Monaco
 * imports so the same logic runs in the browser and under the Node test
 * runner (`yarn test`).
 */

export const SPLIT_COLUMN = 80;

/**
 * TAB to Space: expand every tab to the next tab stop, counting each
 * non-tab character as one column.
 */
export function tabsToSpaces(line: string, tabSize: number): string {
    let column = 0;
    const builder: string[] = [];
    for (const ch of line) {
        if (ch === '\t') {
            const nextStop = (Math.floor(column / tabSize) + 1) * tabSize;
            builder.push(' '.repeat(nextStop - column));
            column = nextStop;
        } else {
            builder.push(ch);
            column += 1;
        }
    }
    return builder.join('');
}

/**
 * Space to TAB: convert the leading run of spaces/tabs into tabs where a
 * full tab stop is reached, preserving any remainder and the rest of the
 * line untouched.
 */
export function spacesToTabs(line: string, tabSize: number): string {
    let index = 0;
    while (index < line.length && (line[index] === ' ' || line[index] === '\t')) {
        index++;
    }
    const leading = line.slice(0, index);
    const rest = line.slice(index);
    let spaces = 0;
    for (const ch of leading) {
        if (ch === ' ') {
            spaces += 1;
        } else {
            spaces += tabSize - (spaces % tabSize);
        }
    }
    return '\t'.repeat(Math.floor(spaces / tabSize)) + ' '.repeat(spaces % tabSize) + rest;
}

/** Trim leading and trailing whitespace on every line. */
export function trimLeadingAndTrailing(lines: string[]): string[] {
    return lines.map(line => line.trim());
}

/** Trim trailing spaces/tabs on every line. */
export function trimTrailing(lines: string[]): string[] {
    return lines.map(line => line.replace(/[ \t]+$/g, ''));
}

/** Collapse every line separator in the block into a single space. */
export function eolToSpace(lines: string[]): string[] {
    return [lines.join(' ')];
}

/**
 * Remove unnecessary EOL and trailing spaces: trailing whitespace is
 * stripped on every line and consecutive empty lines collapse to one.
 */
export function removeUnnecessaryEol(lines: string[]): string[] {
    const out: string[] = [];
    let previousEmpty = false;
    for (const raw of lines) {
        const line = raw.replace(/[ \t]+$/g, '');
        if (line === '') {
            if (!previousEmpty) {
                out.push('');
            }
        } else {
            out.push(line);
        }
        previousEmpty = line === '';
    }
    return out;
}

/**
 * Word-aware hard wrap: break a line at the last space at or before the
 * column; a single over-long word is broken mid-word. The trailing remainder
 * is always emitted when the input is empty (a blank line is preserved).
 */
export function wrapLine(line: string, width: number = SPLIT_COLUMN): string[] {
    const out: string[] = [];
    let rest = line;
    while (rest.length > width) {
        const slice = rest.slice(0, width);
        const breakAt = slice.lastIndexOf(' ');
        if (breakAt > 0) {
            out.push(slice.slice(0, breakAt));
            rest = rest.slice(breakAt + 1);
        } else {
            out.push(slice);
            rest = rest.slice(width);
        }
    }
    if (rest.length > 0 || out.length === 0) {
        out.push(rest);
    }
    return out;
}

/** Split every line at the wrap column and flatten the result. */
export function splitLines(lines: string[], width: number = SPLIT_COLUMN): string[] {
    const out: string[] = [];
    for (const line of lines) {
        out.push(...wrapLine(line, width));
    }
    return out;
}

/** Drop any line that is identical to the one immediately before it. */
export function removeConsecutiveDuplicateLines(lines: string[]): string[] {
    const out: string[] = [];
    for (const line of lines) {
        if (line !== out[out.length - 1]) {
            out.push(line);
        }
    }
    return out;
}