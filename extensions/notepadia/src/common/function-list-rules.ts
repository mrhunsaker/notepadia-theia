/*
 * Per-language rules behind the Notepad++ Function List panel (E1).
 *
 * Notepad++ does not ask an editor for a symbol tree either. Its
 * functionList.xml holds, per language, a handful of anchored regular
 * expressions over the raw lines of the document, and the panel is whatever
 * those expressions match. That is the model here, because the 21 curated
 * languages in this app are Monarch tokenizers only: there is no symbol
 * provider behind them to fall back on, and a list of lines a reader can
 * check is a better answer than a tree of guesses.
 *
 * This module is deliberately free of Theia imports so the compiled
 * `lib/common/function-list-rules.js` can be loaded from the Node-side unit
 * tests in `test/function-list-rules.test.cjs`.
 */

export type FunctionKind = 'function' | 'class' | 'section';

export interface FunctionRule {
    /** Anchored, and matched against one line at a time. Never global. */
    readonly pattern: RegExp;
    /** Which capture group holds the name to show. */
    readonly nameGroup: number;
    readonly kind: FunctionKind;
}

export interface FunctionListLanguage {
    readonly rules: readonly FunctionRule[];
    /**
     * Line-comment openers. A line starting with one of these is a comment,
     * not a declaration, and is skipped. Notepad++ has the same idea as
     * `ignoreComment`; without it a commented-out `function` would appear in
     * the panel as though it were real.
     */
    readonly commentPrefixes: readonly string[];
}

export interface FunctionEntry {
    readonly name: string;
    readonly kind: FunctionKind;
    /** 1-based, to match what the status bar and the editor call a line. */
    readonly line: number;
}

/**
 * Lines longer than this are not worth matching. A declaration line is short,
 * and the cap is what keeps a minified or generated file from turning every
 * rule into a scan of a 200k-character string.
 */
export const MAX_RULE_LINE_LENGTH = 500;

/**
 * Ceiling on how many entries one document may contribute. A pathological file
 * must not be able to make the panel render ten thousand rows.
 */
export const MAX_FUNCTION_ENTRIES = 5000;

/**
 * Keywords that would otherwise be captured as a function name by a C-family
 * rule, because they are followed by a parenthesis.
 */
const C_CONTROL_KEYWORDS = 'if|else|for|foreach|while|switch|catch|return|do|try|sizeof|lock|using|new|throw|synchronized|foreach';

const JS_LIKE_RULES: readonly FunctionRule[] = [
    {
        // function greet(name) {   export async function* tick() {}
        pattern: /^[ \t]*(?:export[ \t]+)?(?:default[ \t]+)?(?:async[ \t]+)?function[ \t]*\*?[ \t]*([A-Za-z_$][\w$]*)/,
        nameGroup: 1,
        kind: 'function'
    },
    {
        // const add = (a, b) => a + b;   const wait = async function () {}
        pattern: /^[ \t]*(?:export[ \t]+)?(?:const|let|var)[ \t]+([A-Za-z_$][\w$]*)[ \t]*(?::[^=]+)?=[ \t]*(?:async[ \t]*)?(?:function\b|\*?[ \t]*\(|[A-Za-z_$][\w$]*[ \t]*=>)/,
        nameGroup: 1,
        kind: 'function'
    },
    {
        // class Widget {   export default class Shell {}
        pattern: /^[ \t]*(?:export[ \t]+)?(?:default[ \t]+)?(?:abstract[ \t]+)?class[ \t]+([A-Za-z_$][\w$]*)/,
        nameGroup: 1,
        kind: 'class'
    }
];

const TYPESCRIPT_RULES: readonly FunctionRule[] = [
    ...JS_LIKE_RULES,
    {
        // interface Props {   export declare interface Window {}
        pattern: /^[ \t]*(?:export[ \t]+)?(?:declare[ \t]+)?(?:abstract[ \t]+)?interface[ \t]+([A-Za-z_$][\w$]*)/,
        nameGroup: 1,
        kind: 'section'
    },
    {
        // type Handler = (id: string) => void;
        pattern: /^[ \t]*(?:export[ \t]+)?(?:declare[ \t]+)?type[ \t]+([A-Za-z_$][\w$]*)[ \t]*(?:<[^>\n]*>)?[ \t]*=/,
        nameGroup: 1,
        kind: 'section'
    },
    {
        // enum Direction {   const enum Flag {}
        pattern: /^[ \t]*(?:export[ \t]+)?(?:declare[ \t]+)?(?:const[ \t]+)?enum[ \t]+([A-Za-z_$][\w$]*)/,
        nameGroup: 1,
        kind: 'section'
    }
];

const C_RULES: readonly FunctionRule[] = [
    {
        // static int main(void) {   Widget *make_widget(const char *name) {
        // The lookahead refuses a control keyword, and the trailing brace
        // refuses a bare declaration, so `int total;` and `if (x) {` stay out.
        pattern: new RegExp(
            '^[ \\t]*(?!(?:' + C_CONTROL_KEYWORDS + ')\\b)' +
            '(?:(?:static|inline|extern|virtual|explicit|constexpr|const|FORCEINLINE)[ \\t]+)*' +
            '(?:[A-Za-z_][\\w:<>,\\*&\\[\\]]*[ \\t\\*&]+)?' +
            '([A-Za-z_~][\\w]*)[ \\t]*\\([^;]*\\)[ \\t]*(?:const[ \\t]*)?(?:noexcept[ \\t]*)?\\{'
        ),
        nameGroup: 1,
        kind: 'function'
    },
    {
        // class Widget {   struct Point {   enum Color {
        pattern: /^[ \t]*(?:class|struct|union|enum)[ \t]+(?:[A-Z_][A-Z0-9_]*[ \t]+)?([A-Za-z_]\w*)/,
        nameGroup: 1,
        kind: 'class'
    }
];

const CSHARP_RULES: readonly FunctionRule[] = [
    {
        // public async Task<int> LoadAsync(string path) {
        pattern: new RegExp(
            '^[ \\t]*(?!(?:' + C_CONTROL_KEYWORDS + ')\\b)' +
            '(?:(?:public|private|protected|internal|static|virtual|override|abstract|sealed|extern|unsafe|async|partial|new|readonly)[ \\t]+)*' +
            '(?:[A-Za-z_][\\w<>,.\\[\\]?]*[ \\t\\*]+)+' +
            '([A-Za-z_]\\w*)[ \\t]*\\([ \\t]*(?![;)])[^()]*\\)[ \\t]*(?:\\{|=>|$)'
        ),
        nameGroup: 1,
        kind: 'function'
    },
    {
        // public Widget(string name) {   - a constructor has no return type
        pattern: /^[ \t]*(?:public|private|protected|internal)[ \t]+([A-Za-z_]\w*)[ \t]*\([^;{)]*\)[ \t]*(?:\{|:)/,
        nameGroup: 1,
        kind: 'function'
    },
    {
        // public sealed class Service {   public record Point(int X);
        pattern: /^[ \t]*(?:(?:public|private|protected|internal|static|sealed|abstract|partial|readonly)[ \t]+)*(?:class|struct|interface|enum|record)[ \t]+([A-Za-z_]\w*)/,
        nameGroup: 1,
        kind: 'class'
    }
];

const JAVA_RULES: readonly FunctionRule[] = [
    {
        // public static void main(String[] args) throws Exception {
        pattern: new RegExp(
            '^[ \\t]*(?!(?:' + C_CONTROL_KEYWORDS + ')\\b)' +
            '(?:(?:public|private|protected|static|final|abstract|synchronized|native|strictfp|default)[ \\t]+)*' +
            '(?:<[^>\\n]+>[ \\t]*)?' +
            '[A-Za-z_][\\w<>,.\\[\\]?]*[ \\t\\*]+' +
            '([A-Za-z_]\\w*)[ \\t]*\\([^;]*\\)[ \\t]*(?:\\{|throws)'
        ),
        nameGroup: 1,
        kind: 'function'
    },
    {
        // public Window(String title) {   - a constructor has no return type
        pattern: /^[ \t]*(?:public|private|protected)[ \t]+([A-Z][\w]*)[ \t]*\([^;]*\)[ \t]*(?:\{|throws)/,
        nameGroup: 1,
        kind: 'function'
    },
    {
        // public final class App {   interface Listener {   enum Color {
        pattern: /^[ \t]*(?:(?:public|private|protected|static|final|abstract|sealed|strictfp)[ \t]+)*(?:class|interface|enum|record|@interface)[ \t]+([A-Za-z_]\w*)/,
        nameGroup: 1,
        kind: 'class'
    }
];

const POWERSHELL_RULES: readonly FunctionRule[] = [
    {
        // function Get-Status {   filter Where-Like {   workflow Build {
        pattern: /^[ \t]*(?:function|filter|workflow|configuration)[ \t]+(?:[\w-]+[ \t]*:[ \t]*)?([\w-]+)/,
        nameGroup: 1,
        kind: 'function'
    },
    {
        // class Widget {
        pattern: /^[ \t]*class[ \t]+([A-Za-z_][\w-]*)/,
        nameGroup: 1,
        kind: 'class'
    }
];

const SHELL_RULES: readonly FunctionRule[] = [
    {
        // greet() {   function greet {
        pattern: /^[ \t]*(?:function[ \t]+)?([\w.-]+)[ \t]*\([ \t]*\)[ \t]*\{/,
        nameGroup: 1,
        kind: 'function'
    },
    {
        // function greet {
        pattern: /^[ \t]*function[ \t]+([\w.-]+)[ \t]*(?:\(\))?[ \t]*\{/,
        nameGroup: 1,
        kind: 'function'
    }
];

const SQL_RULES: readonly FunctionRule[] = [
    {
        // CREATE OR REPLACE PROCEDURE dbo.refresh_totals (
        pattern: /^[ \t]*(?:create[ \t]+(?:or[ \t]+replace[ \t]+)?|alter[ \t]+)(?:procedure|proc|function)[ \t]+(?:\[?[\w$]+\]?\.)?(\[?[\w$]+\]?)/i,
        nameGroup: 1,
        kind: 'function'
    },
    {
        // CREATE TABLE dbo.orders (
        pattern: /^[ \t]*create[ \t]+table[ \t]+(?:\[?[\w$]+\]?\.)?(\[?[\w$]+\]?)/i,
        nameGroup: 1,
        kind: 'section'
    },
    {
        // CREATE VIEW dbo.active AS   CREATE TRIGGER orders_audit
        pattern: /^[ \t]*create[ \t]+(?:view|materialized[ \t]+view|trigger)[ \t]+(?:\[?[\w$]+\]?\.)?(\[?[\w$]+\]?)/i,
        nameGroup: 1,
        kind: 'section'
    }
];

const GO_RULES: readonly FunctionRule[] = [
    {
        // func Serve(addr string) error {   func (s *Server) Stop() {
        pattern: /^[ \t]*func[ \t]+(?:\([^)\n]*\)[ \t]*)?([A-Za-z_]\w*)[ \t]*[(]/,
        nameGroup: 1,
        kind: 'function'
    },
    {
        // type Server struct {
        pattern: /^[ \t]*type[ \t]+([A-Za-z_]\w*)[ \t]+(?:struct|interface)[ \t]*{/,
        nameGroup: 1,
        kind: 'class'
    }
];

const RUST_RULES: readonly FunctionRule[] = [
    {
        // pub fn parse(input: &str) -> Result<()> {   async fn run() {
        pattern: /^[ \t]*(?:pub(?:\([^)\n]*\))?[ \t]+)?(?:default[ \t]+)?(?:const[ \t]+)?(?:async[ \t]+)?(?:unsafe[ \t]+)?(?:extern[ \t]+"[^"\n]*"[ \t]+)?fn[ \t]+([A-Za-z_]\w*)/,
        nameGroup: 1,
        kind: 'function'
    },
    {
        // pub struct Server {   enum Direction {   trait Handler {
        pattern: /^[ \t]*(?:pub(?:\([^)\n]*\))?[ \t]+)?(?:struct|enum|trait|union)[ \t]+([A-Za-z_]\w*)/,
        nameGroup: 1,
        kind: 'class'
    }
];

const C_HASH_COMMENTS = ['//', '/*', '*'];
const HASH_COMMENTS = ['#'];
const XML_COMMENTS = ['<!--'];
const DASH_COMMENTS = ['--'];

/**
 * The table, keyed by the language ids this app registers in
 * `notepadia-language-contribution.ts`.
 */
export const FUNCTION_LIST_LANGUAGES: Readonly<Record<string, FunctionListLanguage>> = {
    javascript: { rules: JS_LIKE_RULES, commentPrefixes: C_HASH_COMMENTS },
    typescript: { rules: TYPESCRIPT_RULES, commentPrefixes: C_HASH_COMMENTS },
    python: {
        rules: [
            { pattern: /^[ \t]*(?:async[ \t]+)?def[ \t]+([A-Za-z_]\w*)/, nameGroup: 1, kind: 'function' },
            { pattern: /^[ \t]*class[ \t]+([A-Za-z_]\w*)/, nameGroup: 1, kind: 'class' }
        ],
        commentPrefixes: HASH_COMMENTS
    },
    c: { rules: C_RULES, commentPrefixes: C_HASH_COMMENTS },
    cpp: { rules: C_RULES, commentPrefixes: C_HASH_COMMENTS },
    csharp: { rules: CSHARP_RULES, commentPrefixes: ['///', '//'] },
    java: { rules: JAVA_RULES, commentPrefixes: ['///', '//'] },
    php: {
        rules: [
            {
                pattern: /^[ \t]*(?:(?:public|private|protected|static|final|abstract)[ \t]+)*function[ \t]*&?[ \t]*([A-Za-z_]\w*)/,
                nameGroup: 1,
                kind: 'function'
            },
            {
                pattern: /^[ \t]*(?:(?:abstract|final)[ \t]+)?(?:class|interface|trait)[ \t]+([A-Za-z_]\w*)/,
                nameGroup: 1,
                kind: 'class'
            }
        ],
        commentPrefixes: ['//', '#', '/*']
    },
    ruby: {
        rules: [
            { pattern: /^[ \t]*def[ \t]+(?:self\.)?([A-Za-z_][\w]*[?!=]?)/, nameGroup: 1, kind: 'function' },
            { pattern: /^[ \t]*(?:class|module)[ \t]+([A-Z][\w:]*)/, nameGroup: 1, kind: 'class' }
        ],
        commentPrefixes: HASH_COMMENTS
    },
    powershell: {
        rules: POWERSHELL_RULES,
        commentPrefixes: ['#', '<#']
    },
    shellscript: { rules: SHELL_RULES, commentPrefixes: HASH_COMMENTS },
    sql: { rules: SQL_RULES, commentPrefixes: DASH_COMMENTS },
    json: {
        // A key at exactly one level of indentation, which is what a
        // conventionally formatted JSON object looks like. Matching any
        // indentation would list every leaf in the document.
        rules: [
            { pattern: /^[ ]{2}"([^"\n]{1,120})"[ \t]*:/, nameGroup: 1, kind: 'section' },
            { pattern: /^[ ]{2}"([^"\n]{1,120})"[ \t]*\{/, nameGroup: 1, kind: 'section' }
        ],
        commentPrefixes: ['//', '/*']
    },
    xml: {
        rules: [{ pattern: /^[ \t]*<[A-Za-z][^<>\n]*\bid[ \t]*=[ \t]*["']([^"'\n]{1,120})["']/, nameGroup: 1, kind: 'section' }],
        commentPrefixes: XML_COMMENTS
    },
    html: {
        rules: [{ pattern: /^[ \t]*<[A-Za-z][^<>\n]*\bid[ \t]*=[ \t]*["']([^"'\n]{1,120})["']/, nameGroup: 1, kind: 'section' }],
        commentPrefixes: XML_COMMENTS
    },
    markdown: {
        rules: [{ pattern: /^[ ]{0,3}(?:#{1,6})[ \t]+(\S.*?)[ \t]*#*[ \t]*$/, nameGroup: 1, kind: 'section' }],
        commentPrefixes: []
    },
    ini: {
        rules: [{ pattern: /^[ \t]*\[([^\]\r\n]{1,120})\]/, nameGroup: 1, kind: 'section' }],
        commentPrefixes: [';', '#']
    },
    go: { rules: GO_RULES, commentPrefixes: C_HASH_COMMENTS },
    rust: { rules: RUST_RULES, commentPrefixes: ['//', '///']
    }
};

/**
 * Ids that mean the same language but are not the ones this app registers, so
 * a rule set is still found when a file arrives from somewhere else.
 */
const LANGUAGE_ALIASES: Readonly<Record<string, string>> = {
    bash: 'shellscript',
    sh: 'shellscript',
    zsh: 'shellscript',
    shell: 'shellscript',
    'c++': 'cpp',
    cplusplus: 'cpp',
    'c#': 'csharp',
    ps1: 'powershell',
    py: 'python',
    js: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    ts: 'typescript',
    md: 'markdown',
    htm: 'html',
    golang: 'go'
};

/** The rule set for a language, or undefined when there is nothing to list. */
export function functionListLanguage(languageId: string): FunctionListLanguage | undefined {
    const id = (languageId || '').toLowerCase();
    return FUNCTION_LIST_LANGUAGES[id] ?? FUNCTION_LIST_LANGUAGES[LANGUAGE_ALIASES[id]];
}

function isCommentLine(line: string, prefixes: readonly string[]): boolean {
    const trimmed = line.trimStart();
    return prefixes.some(prefix => trimmed.startsWith(prefix));
}

/**
 * Every function, class and section in one document, in the order they appear.
 *
 * Pure and line-based: a rule never sees more than a single line, so a pattern
 * cannot walk the file, and the two caps above bound the work even for a file
 * that is one enormous line.
 */
export function parseFunctionList(text: string, languageId: string): FunctionEntry[] {
    const language = functionListLanguage(languageId);
    if (!language || !text) {
        return [];
    }
    const entries: FunctionEntry[] = [];
    const lines = text.split(/\r\n|\r|\n/);
    for (let index = 0; index < lines.length && entries.length < MAX_FUNCTION_ENTRIES; index++) {
        const line = lines[index];
        if (line.length > MAX_RULE_LINE_LENGTH || isCommentLine(line, language.commentPrefixes)) {
            continue;
        }
        for (const rule of language.rules) {
            // No `g` flag on any rule, so exec() carries no state between lines.
            const match = rule.pattern.exec(line);
            const name = match && match[rule.nameGroup];
            if (name) {
                entries.push({ name: name.trim(), kind: rule.kind, line: index + 1 });
                break;
            }
        }
    }
    return entries;
}
