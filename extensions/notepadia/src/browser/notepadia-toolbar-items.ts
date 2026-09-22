/*
 * The declarative model behind the Notepad++ toolbar (A3).
 *
 * This module is deliberately import-free. `notepadia-contribution.ts` and the
 * other command modules pull in `@theia/monaco-editor-core` at module scope, so
 * importing the `Notepadia*Commands` namespaces here would make the compiled
 * `lib/browser/notepadia-toolbar-items.js` unloadable from the Node-side unit
 * tests in `test/`. The command ids below are therefore written as literals and
 * cross-checked against the registered commands by
 * `test/toolbar-items.test.cjs`, which fails the build if a toolbar button ever
 * points at a command that no longer exists.
 */

/** Icon keys resolved to SVG in `icons/notepadia-toolbar-icons.tsx`. */
export type NotepadiaToolbarIcon =
    | 'new'
    | 'open'
    | 'save'
    | 'save-all'
    | 'close'
    | 'close-all'
    | 'print'
    | 'cut'
    | 'copy'
    | 'paste'
    | 'undo'
    | 'redo'
    | 'find'
    | 'replace'
    | 'find-next'
    | 'find-previous'
    | 'zoom-in'
    | 'zoom-out'
    | 'zoom-reset'
    | 'word-wrap'
    | 'whitespace'
    | 'document-map'
    | 'folder'
    | 'macro-record'
    | 'macro-stop'
    | 'macro-run';

export interface NotepadiaToolbarButton {
    readonly kind: 'button';
    /** Stable identity used for the DOM id and by the e2e suite. */
    readonly id: string;
    readonly commandId: string;
    /** Accessible name and the first line of the tooltip. */
    readonly label: string;
    readonly icon: NotepadiaToolbarIcon;
    /**
     * True when the command reports a meaningful `isToggled` state, which is
     * what decides whether the button renders `aria-pressed`. Buttons that are
     * not toggles must not carry `aria-pressed` at all.
     */
    readonly toggle?: boolean;
}

export interface NotepadiaToolbarSeparator {
    readonly kind: 'separator';
    readonly id: string;
}

export type NotepadiaToolbarItem = NotepadiaToolbarButton | NotepadiaToolbarSeparator;

export function isToolbarButton(item: NotepadiaToolbarItem): item is NotepadiaToolbarButton {
    return item.kind === 'button';
}

/**
 * Notepad++ toolbar order: file, print, clipboard, history, search, zoom, view
 * toggles, macros. Every entry maps to a command that is registered today.
 *
 * Deliberately absent, because the underlying feature does not exist in this
 * application yet and a button that throws or no-ops is worse than no button:
 * Sync Vertical Scroll, Sync Horizontal Scroll (no split view), Function List
 * (no outline panel) and Indent Guide (no toggle command). Add the buttons in
 * the same commit that adds the feature.
 */
export const NOTEPADIA_TOOLBAR_ITEMS: readonly NotepadiaToolbarItem[] = [
    { kind: 'button', id: 'new', commandId: 'notepadia.newDocument', label: 'New', icon: 'new' },
    { kind: 'button', id: 'open', commandId: 'core.open', label: 'Open...', icon: 'open' },
    { kind: 'button', id: 'save', commandId: 'core.save', label: 'Save', icon: 'save' },
    { kind: 'button', id: 'save-all', commandId: 'core.saveAll', label: 'Save All', icon: 'save-all' },
    { kind: 'button', id: 'close', commandId: 'notepadia.close', label: 'Close', icon: 'close' },
    { kind: 'button', id: 'close-all', commandId: 'notepadia.closeAll', label: 'Close All', icon: 'close-all' },

    { kind: 'separator', id: 'sep-file' },
    { kind: 'button', id: 'print', commandId: 'notepadia.print', label: 'Print', icon: 'print' },

    { kind: 'separator', id: 'sep-print' },
    { kind: 'button', id: 'cut', commandId: 'core.cut', label: 'Cut', icon: 'cut' },
    { kind: 'button', id: 'copy', commandId: 'core.copy', label: 'Copy', icon: 'copy' },
    { kind: 'button', id: 'paste', commandId: 'core.paste', label: 'Paste', icon: 'paste' },

    { kind: 'separator', id: 'sep-clipboard' },
    { kind: 'button', id: 'undo', commandId: 'core.undo', label: 'Undo', icon: 'undo' },
    { kind: 'button', id: 'redo', commandId: 'core.redo', label: 'Redo', icon: 'redo' },

    { kind: 'separator', id: 'sep-history' },
    { kind: 'button', id: 'find', commandId: 'core.find', label: 'Find...', icon: 'find' },
    { kind: 'button', id: 'replace', commandId: 'core.replace', label: 'Replace...', icon: 'replace' },
    { kind: 'button', id: 'find-next', commandId: 'notepadia.findNext', label: 'Find Next', icon: 'find-next' },
    { kind: 'button', id: 'find-previous', commandId: 'notepadia.findPrevious', label: 'Find Previous', icon: 'find-previous' },

    { kind: 'separator', id: 'sep-search' },
    { kind: 'button', id: 'zoom-in', commandId: 'notepadia.zoomIn', label: 'Zoom In', icon: 'zoom-in' },
    { kind: 'button', id: 'zoom-out', commandId: 'notepadia.zoomOut', label: 'Zoom Out', icon: 'zoom-out' },
    { kind: 'button', id: 'zoom-reset', commandId: 'notepadia.zoomReset', label: 'Restore Default Zoom', icon: 'zoom-reset' },

    { kind: 'separator', id: 'sep-zoom' },
    { kind: 'button', id: 'word-wrap', commandId: 'editor.action.toggleWordWrap', label: 'Word Wrap', icon: 'word-wrap', toggle: true },
    { kind: 'button', id: 'whitespace', commandId: 'notepadia.toggleWhitespace', label: 'Show All Characters', icon: 'whitespace', toggle: true },
    { kind: 'button', id: 'document-map', commandId: 'notepadia.toggleDocumentMap', label: 'Document Map', icon: 'document-map', toggle: true },
    { kind: 'button', id: 'folder-as-workspace', commandId: 'notepadia.view.toggleFolderWorkspace', label: 'Folder as Workspace', icon: 'folder', toggle: true },

    { kind: 'separator', id: 'sep-view' },
    { kind: 'button', id: 'macro-record', commandId: 'notepadia.macro.start', label: 'Start Recording', icon: 'macro-record', toggle: true },
    { kind: 'button', id: 'macro-stop', commandId: 'notepadia.macro.stop', label: 'Stop Recording', icon: 'macro-stop' },
    { kind: 'button', id: 'macro-run', commandId: 'notepadia.macro.run', label: 'Play Recording', icon: 'macro-run' }
];

/** The focusable entries, in visual order. Separators are never focusable. */
export function toolbarButtons(
    items: readonly NotepadiaToolbarItem[] = NOTEPADIA_TOOLBAR_ITEMS
): readonly NotepadiaToolbarButton[] {
    return items.filter(isToolbarButton);
}

/**
 * Roving-tabindex arithmetic, kept here so it can be tested without a DOM.
 * Wraps at both ends, matching the ARIA toolbar pattern.
 */
export function nextFocusIndex(current: number, delta: number, count: number): number {
    if (count <= 0) {
        return 0;
    }
    return ((current + delta) % count + count) % count;
}
