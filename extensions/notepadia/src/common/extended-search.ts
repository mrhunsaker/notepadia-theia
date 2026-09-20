/**
 * Notepad++ "extended search mode" escape table (Find dialog > Search Mode >
 * Extended). The user writes a term with literal escape sequences and every
 * other character matches literally - there is no regex syntax in this mode.
 *
 * Notepad++ honours these escapes:
 *
 *   \n          newline (LF)
 *   \r          carriage return (CR)
 *   \t          tab
 *   \0          null byte
 *   \\          single literal backslash
 *   \xHH        character with hex code HH, e.g. \x41 == 'A'
 *   \oOOO       character with octal code, e.g. \o101 == 'A'
 *   \dDDD       character with decimal code, e.g. \d65 == 'A'
 *   \bBBBBBBBB  character with 8-bit binary code, e.g. \b01000001 == 'A'
 *
 * Unrecognised escapes and a lone trailing backslash pass through literally
 * (Notepad++ does not error on them). Dependency-free so it is unit-testable.
 */

/**
 * Convert a term written in Notepad++ extended mode into the literal string
 * it matches. The result can be used directly for case-sensitive literal
 * searching.
 */
export function extendedToLiteral(source: string): string {
    let out = '';
    let index = 0;
    while (index < source.length) {
        if (source[index] !== '\\') {
            out += source[index];
            index += 1;
            continue;
        }
        if (index + 1 >= source.length) {
            // trailing lone backslash is a literal backslash
            out += '\\';
            index += 1;
            continue;
        }
        const kind = source[index + 1];
        const consumed = consumeEscape(source, index, kind);
        if (consumed) {
            out += consumed.value;
            index += consumed.length;
            continue;
        }
        // unconsumed: pass the two characters through literally
        out += '\\' + kind;
        index += 2;
    }
    return out;
}

function consumeEscape(
    source: string,
    index: number,
    kind: string
): { value: string; length: number } | undefined {
    switch (kind) {
        case 'n':
            return { value: '\n', length: 2 };
        case 'r':
            return { value: '\r', length: 2 };
        case 't':
            return { value: '\t', length: 2 };
        case '0':
            return { value: '\0', length: 2 };
        case '\\':
            return { value: '\\', length: 2 };
        case 'x': {
            const hex = source.slice(index + 2, index + 4);
            if (/^[0-9a-fA-F]{2}$/.test(hex)) {
                return { value: String.fromCharCode(parseInt(hex, 16)), length: 4 };
            }
            // \x without two hex digits: pass "\x" through literally
            return undefined;
        }
        case 'o': {
            const oct = source.slice(index + 2, index + 5);
            if (/^[0-7]{3}$/.test(oct)) {
                return { value: String.fromCharCode(parseInt(oct, 8)), length: 5 };
            }
            return undefined;
        }
        case 'd': {
            const dec = source.slice(index + 2, index + 5);
            if (/^[0-9]{3}$/.test(dec)) {
                const code = parseInt(dec, 10);
                // Notepad++'s \d form is a byte code; out-of-range passes through
                if (code <= 255) {
                    return { value: String.fromCharCode(code), length: 5 };
                }
            }
            return undefined;
        }
        case 'b': {
            const bin = source.slice(index + 2, index + 10);
            if (/^[01]{8}$/.test(bin)) {
                return { value: String.fromCharCode(parseInt(bin, 2)), length: 10 };
            }
            return undefined;
        }
        default:
            // unknown escape, e.g. \m: both characters are matched literally
            return undefined;
    }
}

const REGEX_META = /[.*+?^${}()|[\]\\]/;

/**
 * Escape a literal string so it can be embedded as a regex source and still
 * match exactly that literal text (regex metacharacters and control/non-ASCII
 * characters are escaped). This is what callers use when a search must be
 * performed with regex semantics against a literal produced by
 * extendedToLiteral (or by the user typing plain text).
 */
export function escapeForRegex(literal: string): string {
    let out = '';
    for (const ch of literal) {
        if (ch === '\n') {
            out += '\\n';
            continue;
        }
        if (ch === '\r') {
            out += '\\r';
            continue;
        }
        if (ch === '\t') {
            out += '\\t';
            continue;
        }
        if (ch === '\\') {
            out += '\\\\';
            continue;
        }
        if (REGEX_META.test(ch)) {
            out += '\\' + ch;
            continue;
        }
        const code = ch.codePointAt(0) ?? 0;
        if (code < 32 || code > 126) {
            out += code <= 0xff
                ? '\\x' + code.toString(16).padStart(2, '0')
                : '\\u' + code.toString(16).padStart(4, '0');
        } else {
            out += ch;
        }
    }
    return out;
}