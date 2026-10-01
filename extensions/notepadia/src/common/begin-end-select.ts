/**
 * Pure logic behind `Edit > Begin/End Select` (Notepad++'s Ctrl+Alt+B).
 *
 * The first press drops an anchor, every caret move extends the selection from
 * it, and the second press leaves the range on screen and forgets the anchor.
 *
 * The subtle part is the echo. Extending writes a new selection, and Monaco
 * reports the caret it just adopted through the same `onDidChangeCursorPosition`
 * that the user's keystroke raised. Extending a second time from that reported
 * position is what desynchronized plain arrow navigation from the caret: one
 * ArrowRight came to move the caret four columns, to the far end of the range
 * rather than one step from where it was. So the position the extension itself
 * installed is recorded, and an event carrying it is recognised as an echo and
 * ignored.
 */

export interface Position {
    lineNumber: number;
    column: number;
}

export function samePosition(a: Position | null | undefined, b: Position | null | undefined): boolean {
    if (!a || !b) {
        return false;
    }
    return a.lineNumber === b.lineNumber && a.column === b.column;
}

/**
 * The range from the anchor to the caret, as Monaco wants it: the anchor is
 * always the start and the caret is always the end, so a selection dragged
 * backwards reads left-to-right on screen instead of inverting.
 */
export function anchorSelection(anchor: Position, caret: Position): Position[] {
    return [
        { lineNumber: anchor.lineNumber, column: anchor.column },
        { lineNumber: caret.lineNumber, column: caret.column }
    ];
}

/**
 * Whether a caret event should extend the selection.
 *
 * `lastExtended` is the caret this extension installed on its previous write.
 * When the reported caret is that same position the event is Monaco echoing our
 * own `setSelection` back at us, and extending from it again is exactly the bug
 * this guards. An unanchored editor never extends.
 */
export function shouldExtend(params: {
    anchored: boolean;
    extending: boolean;
    caret?: Position | null;
    lastExtended?: Position | null | undefined;
}): boolean {
    if (!params.anchored || params.extending || !params.caret) {
        return false;
    }
    return !samePosition(params.lastExtended, params.caret);
}

/**
 * Whether a key press should have its selection collapsed first so that the
 * caret move is measured from the caret rather than from the range's start.
 *
 * Monaco's own arrow handling collapses an active selection to one of its ends
 * instead of extending it, and it collapses towards the range's *start*. With a
 * live anchor, a selection running backwards from the anchor made plain Arrow
 * Right jump the caret from column 1 to column 5, to the anchor itself. So these
 * keys are intercepted and the range is collapsed to the caret before the move,
 * which is what makes the move one column instead of four.
 *
 * Shift is excluded: Monaco already extends correctly on Shift+navigation, and
 * collapsing first would fight it. Modifier combinations such as Ctrl+Home are
 * included, since those are plain caret moves that must be measured from the
 * caret too.
 */
/**
 * A `KeyboardEvent` reports the legacy `keyCode`, not Monaco's `KeyCode` enum.
 * The two disagree for arrows and navigation keys: ArrowRight is 39 on the DOM
 * event but `KeyCode.RightArrow` is 17. Comparing the DOM value against the
 * Monaco set silently never matches, so callers that come from a raw DOM event
 * set `domKeyCode` and the two are translated before comparison.
 */
export function isPlainNavigation(params: {
    keyCode: number;
    domKeyCode?: boolean;
    shiftKey?: boolean;
    navigationKeyCodes: ReadonlySet<number>;
}): boolean {
    const keyCode = params.domKeyCode ? DOM_TO_MONACO_KEY_CODE[params.keyCode] : params.keyCode;
    return keyCode !== undefined && params.navigationKeyCodes.has(keyCode) && !params.shiftKey;
}

/** Legacy DOM `keyCode` to Monaco `KeyCode` for the caret-moving keys. */
const DOM_TO_MONACO_KEY_CODE: Readonly<Record<number, number>> = {
    35: 13, // End        -> KeyCode.End
    36: 14, // Home       -> KeyCode.Home
    33: 11, // PageUp     -> KeyCode.PageUp
    34: 12, // PageDown   -> KeyCode.PageDown
    37: 15, // ArrowLeft  -> KeyCode.LeftArrow
    38: 16, // ArrowUp    -> KeyCode.UpArrow
    39: 17, // ArrowRight -> KeyCode.RightArrow
    40: 18  // ArrowDown  -> KeyCode.DownArrow
};

