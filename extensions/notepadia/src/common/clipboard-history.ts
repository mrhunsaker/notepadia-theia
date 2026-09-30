/**
 * Pure logic behind the Clipboard History panel.
 *
 * The list is a most-recent-first stack of what was actually copied, with two
 * rules that keep it from being a second clipboard nobody trusts: re-copying
 * something moves it back to the top instead of leaving a duplicate behind,
 * and the oldest entry falls off the end rather than the list growing without
 * bound. Both are text operations, so both are tested here.
 */

/** How many entries the panel keeps, matching Notepad++'s Clipboard History. */
export const CLIPBOARD_HISTORY_LIMIT = 20;

/**
 * The new list after copying `text`. A copy of nothing (an empty selection) is
 * ignored, and the same text twice in a row is one entry, not two.
 */
export function addClipboardEntry(entries: string[], text: string, limit = CLIPBOARD_HISTORY_LIMIT): string[] {
    if (text.length === 0 || limit <= 0) {
        return entries;
    }
    const rest = entries.filter(entry => entry !== text);
    return [text, ...rest].slice(0, limit);
}

/**
 * A one-line label for an entry. Runs of whitespace (the newlines in almost
 * every copied block) become single spaces, and a long entry is cut with an
 * ellipsis so one huge copy cannot take over the panel.
 */
export function clipboardEntryPreview(text: string, max = 60): string {
    const flat = text.replace(/\s+/g, ' ').trim();
    if (max <= 0) {
        return '';
    }
    return flat.length <= max ? flat : `${flat.slice(0, Math.max(0, max - 1))}…`;
}
