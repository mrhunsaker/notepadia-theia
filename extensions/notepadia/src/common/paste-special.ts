/**
 * Pure logic behind `Edit > Paste Special`.
 *
 * Notepad++'s Paste Special submenu is three entries, and two of them are
 * about indentation rather than about format: the clipboard is pasted where a
 * normal paste would put it, and then the first pasted line is lined up with
 * the line above the caret. Both decisions are pure text transforms, so they
 * live here where they can be tested without a browser.
 */

/** The leading run of spaces and tabs on a line - "" when there is none. */
export function indentOf(line: string): string {
    return /^[ \t]*/.exec(line)![0];
}

/** Only the first line matters: it is the one the caret line's alignment shows. */
function firstLineOf(text: string): string {
    const newline = text.search(/[\r\n]/);
    return newline < 0 ? text : text.slice(0, newline);
}

/** The rest of the clipboard after the first line's content, newline included. */
function remainderOf(text: string): string {
    const newline = text.search(/[\r\n]/);
    return newline < 0 ? '' : text.slice(newline);
}

/**
 * `Paste and Indent`: the first pasted line takes the indentation of the line
 * above the caret, so a block pasted into the middle of an indented file lands
 * in the same column as the code around it. A line with no indentation above
 * leaves the clipboard alone rather than stripping it - "no indentation" is not
 * "remove every space".
 */
export function pasteAndIndent(previousLine: string, clipboard: string): string {
    const first = firstLineOf(clipboard);
    const tail = remainderOf(clipboard);
    const indent = indentOf(previousLine);
    // An empty clipboard has no first line to align, so the indent would be
    // re-attached to nothing and Paste and Indent would insert whitespace the
    // user never copied. An unindented line above is not a request to strip the
    // clipboard's indentation either - it means there is no alignment to
    // apply, so the text is left as copied.
    if (first === '' || indent === '' || indent === indentOf(first)) {
        return clipboard;
    }
    return `${indent}${first.slice(indentOf(first).length)}${tail}`;
}

/**
 * `Paste and Unindent`: the mirror image. If the clipboard's first line starts
 * with the indentation of the line above, that run is removed, so copying an
 * indented block and pasting it into an already-indented position does not
 * double the indent.
 */
export function pasteAndUnindent(previousLine: string, clipboard: string): string {
    const first = firstLineOf(clipboard);
    const tail = remainderOf(clipboard);
    const indent = indentOf(previousLine);
    if (indent === '' || !first.startsWith(indent)) {
        return clipboard;
    }
    return `${first.slice(indent.length)}${tail}`;
}

/**
 * `Paste Unformatted`: a plain-text editor has no formatting to strip, so the
 * `text/plain` flavour of the clipboard is already the unformatted text and the
 * transform is the identity. It is named rather than inlined so the command's
 * intent is readable at the call site.
 */
export function plainText(_previousLine: string, clipboard: string): string {
    return clipboard;
}
