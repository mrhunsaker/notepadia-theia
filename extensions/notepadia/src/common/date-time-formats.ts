/**
 * Pure logic behind `Edit > Insert > Date & Time`.
 *
 * Notepad++ ships two formats (the "short" one on F5 and the "long" one on
 * Ctrl+F5) and lets the user type their own. The formats are here rather than
 * in the contribution so the whole token table is unit-testable, and so the
 * tokens are documented in exactly one place.
 *
 * The token set is the one a Notepad++ user is already typing into the
 * "customized" box, with one deliberate simplification: `MM` is always the
 * month and `mm` is always the minutes, and `dd` is always the day. Windows'
 * own `strftime` has to disambiguate by looking at what precedes the token
 * (`mm` after `hh` is minutes, before `hh` it is the month), which is a trap
 * nobody remembers; here the case decides, the way Notepad++'s own editor
 * treats it.
 *
 * Anything not in the table is copied through as a literal, and text in single
 * quotes is literal too, so `'Week' dddd` cannot be broken by a stray letter.
 * `''` is a literal apostrophe wherever it appears, which is what a user who
 * types `5 o''clock` means.
 */

/** Notepad++'s default short format, the one F5 inserts. */
export const DEFAULT_SHORT_FORMAT = 'HH:mm:ss dd/MM/yyyy';

/** Notepad++'s default long format, the one Ctrl+F5 inserts. */
export const DEFAULT_LONG_FORMAT = 'ddd, MMM d, yyyy h:mm tt';

type TokenHandler = (date: Date, locale?: string) => string;

const pad = (value: number, width = 2): string => String(value).padStart(width, '0');

/** Locale-aware month/weekday names; `undefined` locale means the browser's. */
function localizedName(date: Date, locale: string | undefined, kind: 'weekday' | 'month', width: 'long' | 'short'): string {
    return new Intl.DateTimeFormat(locale, { [kind]: width }).format(date);
}

/**
 * Longest token first, because `MMMM` has to win over `MMM` and `MM` has to
 * win over `M`.
 */
const TOKENS: ReadonlyArray<readonly [string, TokenHandler]> = [
    ['dddd', (date, locale) => localizedName(date, locale, 'weekday', 'long')],
    ['ddd', (date, locale) => localizedName(date, locale, 'weekday', 'short')],
    ['MMMM', (date, locale) => localizedName(date, locale, 'month', 'long')],
    ['MMM', (date, locale) => localizedName(date, locale, 'month', 'short')],
    ['yyyy', date => String(date.getFullYear())],
    ['yy', date => pad(date.getFullYear() % 100)],
    ['MM', date => pad(date.getMonth() + 1)],
    ['M', date => String(date.getMonth() + 1)],
    ['dd', date => pad(date.getDate())],
    ['d', date => String(date.getDate())],
    ['HH', date => pad(date.getHours())],
    ['H', date => String(date.getHours())],
    ['hh', date => pad(((date.getHours() + 11) % 12) + 1)],
    ['h', date => String((date.getHours() + 11) % 12 + 1)],
    ['mm', date => pad(date.getMinutes())],
    ['m', date => String(date.getMinutes())],
    ['ss', date => pad(date.getSeconds())],
    ['s', date => String(date.getSeconds())],
    ['tt', date => (date.getHours() < 12 ? 'AM' : 'PM')]
];

/** The token spellings, for the dialog's help text. */
export const DATE_TIME_TOKENS: string[] = TOKENS.map(([token]) => token);

/**
 * Read a format, replacing tokens and copying everything else. The scan is a
 * single left-to-right pass so a token can never be matched twice out of a
 * value it produced (a month name like "Mar" contains no token, but the
 * guarantee is worth having rather than relying on it).
 */
export function formatDateTime(date: Date, format: string, locale?: string): string {
    let out = '';
    let index = 0;
    while (index < format.length) {
        const char = format.charAt(index);
        if (char === '\'') {
            // `''` is a literal apostrophe and is checked before anything else,
            // so it works inside a quoted run and outside one.
            if (format.charAt(index + 1) === '\'') {
                out += '\'';
                index += 2;
                continue;
            }
            // An opening quote whose closing quote never arrives is a typo, not
            // a truncation request: keeping the rest verbatim is what the user
            // meant, and dropping the apostrophe would corrupt the text.
            index += 1;
            const literal = [];
            let closed = false;
            while (index < format.length) {
                if (format.charAt(index) === '\'') {
                    index += 1;
                    closed = true;
                    break;
                }
                literal.push(format.charAt(index));
                index += 1;
            }
            out += closed ? literal.join('') : `'` + literal.join('');
            continue;
        }
        const token = TOKENS.find(([candidate]) => format.startsWith(candidate, index));
        if (token) {
            out += token[1](date, locale);
            index += token[0].length;
            continue;
        }
        out += char;
        index += 1;
    }
    return out;
}

export function shortDateTime(date: Date, locale?: string): string {
    return formatDateTime(date, DEFAULT_SHORT_FORMAT, locale);
}

export function longDateTime(date: Date, locale?: string): string {
    return formatDateTime(date, DEFAULT_LONG_FORMAT, locale);
}

/** The distinct tokens a format actually uses, in the order first seen. */
export function recognizedTokens(format: string): string[] {
    const found: string[] = [];
    let index = 0;
    let quoted = false;
    while (index < format.length) {
        if (format.charAt(index) === '\'') {
            // Same `''`-first rule as the formatter, so the two agree about
            // which letters are being suppressed.
            if (format.charAt(index + 1) === '\'') {
                index += 2;
                continue;
            }
            quoted = !quoted;
            index += 1;
            continue;
        }
        if (quoted) {
            index += 1;
            continue;
        }
        const token = TOKENS.find(([candidate]) => format.startsWith(candidate, index));
        if (token) {
            if (!found.includes(token[0])) {
                found.push(token[0]);
            }
            index += token[0].length;
            continue;
        }
        index += 1;
    }
    return found;
}

/**
 * Whether a typed format is worth inserting. An empty format inserts nothing
 * and a format with no token at all inserts a constant string dressed up as a
 * date, so both are refused - the same thing Notepad++'s own time-settings box
 * does rather than silently producing junk in the document.
 */
export function isValidDateTimeFormat(format: string): boolean {
    return format.trim().length > 0 && recognizedTokens(format).length > 0;
}
