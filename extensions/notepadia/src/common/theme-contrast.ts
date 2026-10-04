/**
 * WCAG 2.1 contrast checking for Notepadia's theme palettes.
 *
 * The palettes are Notepad++'s, and several of Notepad++'s original colours
 * do not reach WCAG AA once they are a rendered pair of foreground and
 * background. Checking that by eye is not a check, and a theme edit is exactly
 * the kind of change that silently breaks one, so the maths lives here as a
 * pure function that `test/theme-contrast.test.cjs` can run over every shipped
 * theme.
 *
 * Only the maths is here. Which pairs matter for Notepadia's own chrome is in
 * `themePairs` below, and the ratios themselves come from the .color-theme.json
 * files, so the themes stay the single source of truth for colour.
 */

/** WCAG 2.1 relative-luminance thresholds. */
export const AA_TEXT = 4.5;
export const AA_LARGE_TEXT = 3;
export const AA_NON_TEXT = 3;
export const AAA_TEXT = 7;

export interface Rgb {
    readonly r: number;
    readonly g: number;
    readonly b: number;
    readonly a: number;
}

export interface ContrastPair {
    /** What the pair is, in the words a user would use. */
    readonly label: string;
    readonly foreground: string;
    readonly background: string;
    readonly minimum: number;
    /**
     * Set when the pair is a WCAG "inactive user interface component", which
     * 1.4.3 and 1.4.11 exempt from contrast requirements. The ratio is still
     * reported, because an exempt pair that happens to pass is free.
     */
    readonly exempt?: boolean;
}

export interface ContrastResult {
    readonly pair: ContrastPair;
    /** null when either colour could not be parsed. */
    readonly ratio: number | null;
    readonly passes: boolean;
}

/** `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()` and `rgba()`. */
export function parseColor(color: string): Rgb | undefined {
    const value = color.trim().toLowerCase();
    const hex = /^#([0-9a-f]{3,8})$/.exec(value);
    if (hex) {
        const digits = hex[1];
        if (digits.length === 3 || digits.length === 4) {
            const [r, g, b, a] = digits.split('').map(d => parseInt(d + d, 16));
            return { r, g, b, a: digits.length === 4 ? a / 255 : 1 };
        }
        if (digits.length === 6 || digits.length === 8) {
            const pair = (i: number): number => parseInt(digits.slice(i * 2, i * 2 + 2), 16);
            return { r: pair(0), g: pair(1), b: pair(2), a: digits.length === 8 ? pair(3) / 255 : 1 };
        }
        return undefined;
    }
    const fn = /^rgba?\(([^)]+)\)$/.exec(value);
    if (fn) {
        const parts = fn[1].split(/[,/\s]+/).filter(Boolean);
        if (parts.length < 3) {
            return undefined;
        }
        const channel = (part: string): number =>
            part.endsWith('%') ? Math.round(parseFloat(part) * 2.55) : parseInt(part, 10);
        const alpha = parts.length > 3
            ? (parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]))
            : 1;
        const [r, g, b] = [channel(parts[0]), channel(parts[1]), channel(parts[2])];
        if ([r, g, b].some(c => Number.isNaN(c))) {
            return undefined;
        }
        return { r, g, b, a: Number.isNaN(alpha) ? 1 : alpha };
    }
    return undefined;
}

/** WCAG 2.1 sRGB relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(color: Rgb): number {
    const linear = (channel: number): number => {
        const c = Math.min(255, Math.max(0, channel)) / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * linear(color.r) + 0.7152 * linear(color.g) + 0.0722 * linear(color.b);
}

/** The contrast ratio between two colours, from 1 to 21. Order does not matter. */
export function contrastRatio(foreground: string, background: string): number | null {
    const fg = parseColor(foreground);
    const bg = parseColor(background);
    if (!fg || !bg) {
        return null;
    }
    const a = relativeLuminance(fg);
    const b = relativeLuminance(bg);
    const [lighter, darker] = a > b ? [a, b] : [b, a];
    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * The colour `foreground` becomes when it is painted at `opacity` over
 * `background`, which is how a dimmed toolbar icon is actually seen. CSS
 * compositing is done in sRGB space for the default `normal` blend mode, so
 * that is what this reproduces.
 */
export function blend(foreground: string, background: string, opacity: number): string | null {
    const fg = parseColor(foreground);
    const bg = parseColor(background);
    if (!fg || !bg) {
        return null;
    }
    const alpha = Math.min(1, Math.max(0, opacity)) * fg.a;
    const mix = (f: number, b: number): number => Math.round(alpha * f + (1 - alpha) * b);
    return rgbToHex({ r: mix(fg.r, bg.r), g: mix(fg.g, bg.g), b: mix(fg.b, bg.b), a: 1 });
}

export function rgbToHex(color: Rgb): string {
    const pair = (c: number): string => Math.min(255, Math.max(0, Math.round(c)))
        .toString(16).padStart(2, '0').toUpperCase();
    return `#${pair(color.r)}${pair(color.g)}${pair(color.b)}`;
}

/** Runs one pair, leaving the reason for a failure to the caller. */
export function checkPair(pair: ContrastPair): ContrastResult {
    const ratio = contrastRatio(pair.foreground, pair.background);
    return {
        pair,
        ratio,
        passes: ratio !== null && (ratio + 0.0005) >= pair.minimum
    };
}

export function checkPairs(pairs: readonly ContrastPair[]): ContrastResult[] {
    return pairs.map(checkPair);
}

/**
 * The pairs Notepadia's own chrome and editor rely on, taken from a theme's
 * `colors` map.
 *
 * These are the four the brief names - editor text, line numbers, the status
 * bar and disabled toolbar buttons - plus the ones that fail hardest when a
 * theme is edited: the tab bar, the menu and the buttons, because those carry
 * the app's navigation. Text pairs ask for AA body text (4.5), icon and border
 * pairs for non-text contrast (3).
 */
export function themePairs(colors: Readonly<Record<string, string>>, disabledToolbarOpacity: number): ContrastPair[] {
    const get = (key: string): string => colors[key];
    const pairs: ContrastPair[] = [
        { label: 'editor text on the editor background', foreground: get('editor.foreground'), background: get('editor.background'), minimum: AA_TEXT },
        { label: 'active line number on the editor background', foreground: get('editorLineNumber.activeForeground'), background: get('editor.background'), minimum: AA_TEXT },
        { label: 'inactive line numbers on the editor background', foreground: get('editorLineNumber.foreground'), background: get('editor.background'), minimum: AA_TEXT },
        { label: 'status bar text on the status bar', foreground: get('statusBar.foreground'), background: get('statusBar.background'), minimum: AA_TEXT },
        { label: 'menu bar text on the menu bar', foreground: get('menu.foreground'), background: get('menu.background'), minimum: AA_TEXT },
        { label: 'active tab text on the active tab', foreground: get('tab.activeForeground'), background: get('tab.activeBackground'), minimum: AA_TEXT },
        { label: 'inactive tab text on an inactive tab', foreground: get('tab.inactiveForeground'), background: get('tab.inactiveBackground'), minimum: AA_TEXT },
        { label: 'selected menu item text', foreground: get('menu.selectionForeground'), background: get('menu.selectionBackground'), minimum: AA_TEXT },
        { label: 'button text on a button', foreground: get('button.foreground'), background: get('button.background'), minimum: AA_TEXT },
        { label: 'input text in an input', foreground: get('input.foreground'), background: get('input.background'), minimum: AA_TEXT },
        { label: 'focus outline against the editor background', foreground: get('focusBorder'), background: get('editor.background'), minimum: AA_NON_TEXT },
        { label: 'active tab border against the tab bar', foreground: get('tab.activeBorder'), background: get('tab.inactiveBackground'), minimum: AA_NON_TEXT },
        { label: 'panel text on the panel background', foreground: get('panel.foreground'), background: get('panel.background'), minimum: AA_TEXT },
        // Shown only when View > Show Symbol > Show Space and TAB is on, where
        // the dots and arrows are the only sign of a space or a tab, so they
        // are meaningful graphics rather than decoration.
        { label: 'shown whitespace on the editor background', foreground: get('editorWhitespace.foreground'), background: get('editor.background'), minimum: AA_NON_TEXT }
    ];

    // A dimmed toolbar icon is menu.foreground painted at the disabled opacity
    // over the menu background, which is what the toolbar uses for both.
    const dimmed = blend(get('menu.foreground'), get('menu.background'), disabledToolbarOpacity);
    if (dimmed) {
        pairs.push({
            label: `disabled toolbar icon at ${disabledToolbarOpacity} opacity`,
            foreground: dimmed,
            background: get('menu.background'),
            minimum: AA_NON_TEXT
        });
    }
    return pairs;
}