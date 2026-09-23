/*
 * Toolbar and document-tab glyphs (A3, A4).
 *
 * These are inlined as React elements rather than shipped as an external
 * sprite file. A sprite would have to be resolved through the application's
 * webpack asset pipeline *and* copied beside lib/browser by scripts/copy-static
 * for the two build paths to agree; inlining sidesteps both and keeps the icons
 * theme-aware for free, because every stroke and fill is `currentColor`.
 *
 * Grid is 16x16. Strokes are 1.25 wide on a whole- or half-pixel grid so the
 * glyphs stay crisp at the 26px toolbar height.
 *
 * The tab-state glyphs (TAB_GLYPHS) are the same art the tab bar paints as
 * data-URI backgrounds in style/notepadia-shell.css; they are exported so the
 * shapes exist in one place for anything that renders them inline.
 */

import * as React from '@theia/core/shared/react';
import { NotepadiaToolbarIcon } from '../notepadia-toolbar-items';

const S = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.25,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const
};

/** Solid fills, used where the artwork is a silhouette rather than an outline. */
const F = { fill: 'currentColor' as const };

/** A magnifier, shared by every search/zoom glyph. */
const magnifier = (
    <>
        <circle cx="6.75" cy="6.75" r="4.25" {...S} />
        <path d="M9.9 9.9L14 14" {...S} />
    </>
);

const GLYPHS: Record<NotepadiaToolbarIcon, React.ReactNode> = {
    'new': (
        <>
            <path d="M3.5 1.5h5.5L12.5 5v9.5h-9z" {...S} />
            <path d="M9 1.5V5h3.5" {...S} />
        </>
    ),
    'open': (
        <>
            <path d="M1.5 12.5V3.5h4l1.5 2h7v7z" {...S} />
            <path d="M3 12.5l1.75-5h10.75l-1.75 5z" {...S} />
        </>
    ),
    'save': (
        <>
            <path d="M2.5 2.5h9l2.5 2.5v9h-11.5z" {...S} />
            <path d="M5 2.5h5v4h-5z" {...S} />
            <path d="M4 9h8v5h-8z" {...S} />
        </>
    ),
    'save-all': (
        <>
            <path d="M1.5 1.5h7l2 2v7h-9z" {...S} />
            <path d="M5.5 5.5h9.5v9h-9.5z" {...S} />
            <path d="M8 5.5h4v3h-4z" {...S} />
        </>
    ),
    'close': (
        <>
            <path d="M3.5 1.5h5.5L12.5 5v9.5h-9z" {...S} />
            <path d="M6 7.5l4 4M10 7.5l-4 4" {...S} />
        </>
    ),
    'close-all': (
        <>
            <path d="M1.5 1.5h5l2 2v6h-7z" {...S} />
            <path d="M6 5.5h5.5L14 8v6.5h-8z" {...S} />
            <path d="M8.5 9.5l3 3M11.5 9.5l-3 3" {...S} />
        </>
    ),
    'print': (
        <>
            <path d="M4.5 6.5V1.5h7v5" {...S} />
            <path d="M2 6.5h12v5h-2.5" {...S} />
            <path d="M4.5 9.5h7v5h-7z" {...S} />
            <path d="M6.5 11.5h3" {...S} />
        </>
    ),
    'cut': (
        <>
            <path d="M4 2l8 9.5M12 2l-8 9.5" {...S} />
            <circle cx="3.75" cy="12.75" r="1.75" {...S} />
            <circle cx="12.25" cy="12.75" r="1.75" {...S} />
        </>
    ),
    'copy': (
        <>
            <path d="M2.5 1.5h7v7h-7z" {...S} />
            <path d="M6.5 7.5h7v7h-7z" {...S} />
        </>
    ),
    'paste': (
        <>
            <path d="M3.5 2.5h9v12h-9z" {...S} />
            <path d="M6 1.5h4v2.5h-4z" {...S} />
            <path d="M6 8h4M6 11h4" {...S} />
        </>
    ),
    'undo': (
        <>
            <path d="M5.5 3L2 6.5L5.5 10" {...S} />
            <path d="M2 6.5h7.5a4 4 0 010 8H6" {...S} />
        </>
    ),
    'redo': (
        <>
            <path d="M10.5 3L14 6.5L10.5 10" {...S} />
            <path d="M14 6.5H6.5a4 4 0 000 8H10" {...S} />
        </>
    ),
    'find': magnifier,
    'replace': (
        <>
            {magnifier}
            <path d="M2.5 13.5h5M6 12l1.5 1.5L6 15" {...S} />
        </>
    ),
    'find-next': (
        <>
            {magnifier}
            <path d="M4.75 5.5l2 2 2-2" {...S} />
        </>
    ),
    'find-previous': (
        <>
            {magnifier}
            <path d="M4.75 8l2-2 2 2" {...S} />
        </>
    ),
    'zoom-in': (
        <>
            {magnifier}
            <path d="M4.5 6.75h4.5M6.75 4.5v4.5" {...S} />
        </>
    ),
    'zoom-out': (
        <>
            {magnifier}
            <path d="M4.5 6.75h4.5" {...S} />
        </>
    ),
    'zoom-reset': (
        <>
            {magnifier}
            <path d="M4.75 5.5h4M4.75 8h4" {...S} />
        </>
    ),
    'word-wrap': (
        <>
            <path d="M2 3.5h12M2 12.5h5" {...S} />
            <path d="M2 8h9a2.25 2.25 0 010 4.5H8.5" {...S} />
            <path d="M10 10.75L8.5 12.5L10 14.25" {...S} />
        </>
    ),
    'whitespace': (
        <>
            <path d="M12 2.5H7.25a3.25 3.25 0 000 6.5H10" {...S} />
            <path d="M10 2.5v11M12.75 2.5v11" {...S} />
        </>
    ),
    'document-map': (
        <>
            <path d="M1.5 2.5h8v11h-8z" {...S} />
            <path d="M3.5 5.5h4M3.5 8h4M3.5 10.5h2.5" {...S} />
            <path d="M11.5 2.5h3v11h-3z" {...S} />
            <path d="M12.25 5h1.5M12.25 7h1.5M12.25 9h1.5" {...S} />
        </>
    ),
    'folder': (
        <>
            <path d="M1.5 12.5V3.5h4.5l1.5 2h7v7z" {...S} />
        </>
    ),
    'macro-record': <circle cx="8" cy="8" r="4.5" fill="currentColor" />,
    'macro-stop': <rect x="4" y="4" width="8" height="8" rx="0.75" fill="currentColor" />,
    'macro-run': <path d="M5 3.25L12.5 8L5 12.75z" fill="currentColor" />
};

/**
 * Renders a toolbar glyph. `aria-hidden` because the accessible name always
 * comes from the button's own `aria-label`; the SVG must never be announced
 * separately.
 */
export function toolbarIcon(icon: NotepadiaToolbarIcon): React.ReactNode {
    return (
        <svg
            className="notepadia-toolbar-icon"
            viewBox="0 0 16 16"
            width="16"
            height="16"
            aria-hidden="true"
            focusable="false"
        >
            {GLYPHS[icon]}
        </svg>
    );
}

/**
 * Document-tab state glyphs (A4). A 3.5" floppy carries the dirty/saved state
 * and a padlock the read-only state, matching Notepad++. `style/notepadia-shell.css`
 * paints these shapes onto the tab bar as data-URI backgrounds so they are not
 * theme-masked by `--theia-icon-foreground`; these nodes mirror that art for
 * inline use (tooltips, dialogs).
 */
export const TAB_GLYPHS: Record<'saved' | 'dirty' | 'readonly', React.ReactNode> = {
    'saved': (
        <>
            <path d="M2.8 1.8h8.2L13.6 4.4v9.9H2.8z" {...F} />
            <path d="M4.8 1.8v3.3H8V1.8z" fill="#ffffff" />
            <path d="M4.2 8.2h7.6V10H4.2z" {...F} />
        </>
    ),
    'dirty': (
        <>
            <path d="M2.8 1.8h8.2L13.6 4.4v9.9H2.8z" {...F} />
            <path d="M4.8 1.8v3.3H8V1.8z" fill="#ffffff" />
            <path d="M4.2 8.2h7.6V10H4.2z" {...F} />
        </>
    ),
    'readonly': (
        <>
            <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" {...S} />
            <rect x="4" y="7" width="8" height="6" rx="1" fill="currentColor" />
        </>
    )
};
