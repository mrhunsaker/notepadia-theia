/**
 * Pure helpers behind the editor's zoom chords (WS-D / D2).
 *
 * Ctrl+= / Ctrl+- / Ctrl+0 are Zoom In / Zoom Out / Reset Zoom in Notepad++ and
 * page zoom in every browser, so the two meanings fight over the same chord. The
 * editor wins while it has focus; everywhere else the browser keeps its own
 * page zoom, because a user pressing Ctrl+= with focus on the menubar is asking
 * to zoom the window.
 *
 * The decision lives here rather than in the keydown listener so the rules -
 * which spellings of Zoom In count, why Alt is excluded, why the editor's focus
 * is what decides - can be unit tested. A listener that can only be observed
 * through a synthetic KeyboardEvent is not testable at all: Theia stops
 * propagation for every chord it handles and throws on synthetic events, so by
 * the time any test could look at `defaultPrevented`, the answer would be Theia's
 * answer and not this guard's.
 */

/** What the editor's zoom commands do with a key. */
export type EditorZoomAction = 'zoom-in' | 'zoom-out' | 'reset';

/** The parts of a keydown this decision depends on. */
export interface ZoomChordEvent {
    readonly ctrlKey: boolean;
    readonly metaKey: boolean;
    readonly altKey: boolean;
    readonly key: string;
}

/**
 * The editor zoom a keydown means, or `undefined` when the key is not one of
 * the editor's zoom chords and the browser should keep it.
 *
 * - `=` and `+` are the same chord: `+` is what '=' reports with Shift held.
 * - Meta is accepted so macOS, where Cmd+= is also Zoom In, behaves the same.
 * - Alt is excluded because Ctrl+Alt is AltGr on Windows layouts, so those
 *   chords belong to the keyboard layout rather than to the app.
 */
export function editorZoomAction(event: ZoomChordEvent): EditorZoomAction | undefined {
    if (!event.ctrlKey && !event.metaKey) {
        return undefined;
    }
    if (event.altKey) {
        return undefined;
    }
    switch (event.key) {
        case '=':
        case '+':
            return 'zoom-in';
        case '-':
            return 'zoom-out';
        case '0':
            return 'reset';
        default:
            return undefined;
    }
}
