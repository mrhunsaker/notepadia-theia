import type * as monaco from '@theia/monaco-editor-core';

/**
 * Notepad++-style Language menu. The built-in "Change Language Mode..."
 * quick-pick lists every *registered* language; this build ships almost none,
 * so the curated list below is registered up-front with lightweight Monarch
 * tokenizers (keywords, strings, comments, numbers) to make each language
 * selectable and syntax-tinted, matching how Notepad++ exposes its languages.
 */
export interface NotepadiaLanguageEntry {
    readonly id: string;
    readonly name: string;
    /** File extensions used for auto-detection. Optional: if the extension is
     * already owned by another registered language it is silently dropped. */
    readonly extensions?: string[];
    readonly keywords: string[];
    /** Literals Alabaster treats as statically known constants rather than
     * keywords, so they pick up the constant colour. */
    readonly constants?: string[];
    /** Keywords that introduce a named function or type definition. The
     * identifier after them is the global definition Alabaster colours. */
    readonly functionKeywords?: string[];
    readonly typeKeywords?: string[];
    /** SQL, HTML and PowerShell are case-insensitive. */
    readonly ignoreCase?: boolean;
    readonly lineComment?: string;
    readonly blockComment?: [string, string];
}

export const NOTEPADIA_LANGUAGES: ReadonlyArray<NotepadiaLanguageEntry> = [
    {
        id: 'javascript', name: 'JavaScript', extensions: ['.js', '.mjs', '.cjs'],
        keywords: ['async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends', 'false', 'finally', 'for', 'function', 'get', 'if', 'import', 'in', 'instanceof', 'let', 'new', 'null', 'of', 'return', 'set', 'static', 'super', 'switch', 'this', 'throw', 'true', 'try', 'typeof', 'undefined', 'var', 'void', 'while', 'with', 'yield'],
        constants: ['true', 'false', 'null', 'undefined', 'NaN', 'Infinity'],
        functionKeywords: ['function'],
        typeKeywords: ['class'],
        lineComment: '//', blockComment: ['/*', '*/']
    },
    {
        id: 'typescript', name: 'TypeScript', extensions: ['.ts', '.mts', '.cts'],
        keywords: ['abstract', 'any', 'async', 'await', 'boolean', 'break', 'case', 'catch', 'class', 'const', 'constructor', 'continue', 'debugger', 'declare', 'default', 'delete', 'do', 'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'function', 'get', 'if', 'implements', 'import', 'in', 'infer', 'instanceof', 'interface', 'keyof', 'let', 'namespace', 'never', 'new', 'null', 'number', 'object', 'of', 'override', 'private', 'protected', 'public', 'readonly', 'return', 'set', 'static', 'string', 'super', 'switch', 'this', 'throw', 'true', 'try', 'type', 'typeof', 'undefined', 'unique', 'unknown', 'var', 'void', 'while', 'with', 'yield'],
        constants: ['true', 'false', 'null', 'undefined', 'NaN', 'Infinity'],
        functionKeywords: ['function'],
        typeKeywords: ['class', 'interface', 'enum', 'type', 'namespace'],
        lineComment: '//', blockComment: ['/*', '*/']
    },
    {
        id: 'html', name: 'HTML', extensions: ['.html', '.htm'],
        keywords: ['a', 'body', 'br', 'div', 'em', 'form', 'head', 'html', 'img', 'input', 'li', 'link', 'meta', 'p', 'script', 'span', 'strong', 'style', 'table', 'td', 'th', 'title', 'tr', 'ul'],
        ignoreCase: true,
        blockComment: ['<!--', '-->']
    },
    {
        id: 'css', name: 'CSS', extensions: ['.css'],
        keywords: ['align', 'background', 'border', 'bottom', 'color', 'display', 'font', 'font-family', 'font-size', 'font-weight', 'height', 'left', 'line-height', 'margin', 'opacity', 'padding', 'position', 'right', 'text-align', 'top', 'transition', 'width', 'z-index'],
        ignoreCase: true,
        blockComment: ['/*', '*/']
    },
    {
        id: 'markdown', name: 'Markdown', extensions: ['.md'],
        keywords: []
    },
    {
        id: 'yaml', name: 'YAML', extensions: ['.yml', '.yaml'],
        keywords: ['true', 'false', 'null', 'yes', 'no', 'on', 'off'],
        constants: ['true', 'false', 'null', 'yes', 'no', 'on', 'off'],
        ignoreCase: true,
        lineComment: '#'
    },
    {
        id: 'xml', name: 'XML', extensions: ['.xml'],
        keywords: [],
        blockComment: ['<!--', '-->']
    },
    {
        id: 'python', name: 'Python', extensions: ['.py'],
        keywords: ['and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'False', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'None', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'True', 'try', 'while', 'with', 'yield'],
        constants: ['True', 'False', 'None', 'NotImplemented', 'Ellipsis'],
        functionKeywords: ['def'],
        typeKeywords: ['class'],
        lineComment: '#',
    },
    {
        id: 'c', name: 'C', extensions: ['.c', '.h'],
        keywords: ['auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum', 'extern', 'float', 'for', 'goto', 'if', 'int', 'long', 'register', 'return', 'short', 'signed', 'sizeof', 'static', 'struct', 'switch', 'typedef', 'union', 'unsigned', 'void', 'volatile', 'while'],
        constants: ['NULL', 'true', 'false'],
        typeKeywords: ['struct', 'union', 'enum'],
        lineComment: '//', blockComment: ['/*', '*/']
    },
    {
        id: 'cpp', name: 'C++', extensions: ['.cpp', '.cc', '.cxx', '.hpp', '.hh'],
        keywords: ['alignas', 'alignof', 'and', 'asm', 'auto', 'bool', 'break', 'case', 'catch', 'char', 'class', 'const', 'constexpr', 'continue', 'decltype', 'default', 'delete', 'do', 'double', 'else', 'enum', 'explicit', 'export', 'extern', 'false', 'float', 'for', 'friend', 'goto', 'if', 'inline', 'int', 'long', 'mutable', 'namespace', 'new', 'noexcept', 'nullptr', 'operator', 'private', 'protected', 'public', 'register', 'return', 'short', 'signed', 'sizeof', 'static', 'struct', 'switch', 'template', 'this', 'throw', 'true', 'try', 'typedef', 'typename', 'union', 'unsigned', 'using', 'virtual', 'void', 'volatile', 'while'],
        constants: ['true', 'false', 'nullptr'],
        typeKeywords: ['class', 'struct', 'union', 'enum', 'namespace'],
        lineComment: '//', blockComment: ['/*', '*/']
    },
    {
        id: 'csharp', name: 'C#', extensions: ['.cs'],
        keywords: ['abstract', 'as', 'async', 'await', 'base', 'bool', 'break', 'byte', 'case', 'catch', 'char', 'class', 'const', 'continue', 'decimal', 'default', 'delegate', 'do', 'double', 'else', 'enum', 'event', 'explicit', 'extern', 'false', 'finally', 'fixed', 'float', 'for', 'foreach', 'get', 'goto', 'if', 'implicit', 'in', 'int', 'interface', 'internal', 'is', 'lock', 'long', 'namespace', 'new', 'null', 'object', 'operator', 'out', 'override', 'params', 'private', 'protected', 'public', 'readonly', 'ref', 'return', 'sbyte', 'sealed', 'set', 'short', 'sizeof', 'static', 'string', 'struct', 'switch', 'this', 'throw', 'true', 'try', 'typeof', 'uint', 'ulong', 'unchecked', 'unsafe', 'ushort', 'using', 'virtual', 'void', 'volatile', 'while'],
        constants: ['true', 'false', 'null'],
        typeKeywords: ['class', 'struct', 'interface', 'enum', 'record', 'namespace'],
        lineComment: '//', blockComment: ['/*', '*/']
    },
    {
        id: 'java', name: 'Java', extensions: ['.java'],
        keywords: ['abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum', 'extends', 'final', 'finally', 'float', 'for', 'goto', 'if', 'implements', 'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new', 'null', 'package', 'private', 'protected', 'public', 'return', 'short', 'static', 'strictfp', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws', 'transient', 'true', 'try', 'void', 'volatile', 'while'],
        constants: ['true', 'false', 'null'],
        typeKeywords: ['class', 'interface', 'enum', 'record'],
        lineComment: '//', blockComment: ['/*', '*/']
    },
    {
        id: 'json', name: 'JSON', extensions: ['.json', '.jsonc', '.json5'],
        keywords: ['true', 'false', 'null'],
        constants: ['true', 'false', 'null']
    },
    {
        id: 'php', name: 'PHP', extensions: ['.php'],
        keywords: ['as', 'break', 'case', 'catch', 'class', 'const', 'continue', 'declare', 'default', 'do', 'echo', 'else', 'elseif', 'extends', 'final', 'finally', 'for', 'foreach', 'function', 'global', 'if', 'implements', 'interface', 'namespace', 'new', 'print', 'private', 'protected', 'public', 'return', 'static', 'switch', 'throw', 'trait', 'try', 'use', 'var', 'while', 'yield'],
        constants: ['true', 'false', 'null'],
        functionKeywords: ['function'],
        typeKeywords: ['class', 'interface', 'trait', 'enum', 'namespace'],
        lineComment: '//', blockComment: ['/*', '*/']
    },
    {
        id: 'powershell', name: 'PowerShell', extensions: ['.ps1', '.psm1', '.psd1', '.pssc'],
        keywords: ['and', 'begin', 'break', 'catch', 'class', 'continue', 'contains', 'data', 'define', 'do', 'dynamicparam', 'else', 'elseif', 'end', 'enum', 'eq', 'exit', 'filter', 'finally', 'for', 'foreach', 'from', 'function', 'ge', 'gt', 'if', 'in', 'le', 'like', 'lt', 'match', 'ne', 'not', 'notcontains', 'notlike', 'notmatch', 'or', 'param', 'process', 'return', 'switch', 'throw', 'trap', 'try', 'until', 'using', 'var', 'while', 'workflow', 'xor'],
        constants: ['$true', '$false', '$null'],
        functionKeywords: ['function', 'filter', 'workflow'],
        typeKeywords: ['class', 'enum'],
        lineComment: '#', blockComment: ['<#', '#>']
    },
    {
        id: 'ruby', name: 'Ruby', extensions: ['.rb'],
        keywords: ['alias', 'and', 'begin', 'break', 'case', 'class', 'def', 'defined?', 'do', 'else', 'elsif', 'end', 'ensure', 'false', 'for', 'if', 'in', 'module', 'next', 'nil', 'not', 'or', 'redo', 'rescue', 'retry', 'return', 'self', 'super', 'then', 'true', 'undef', 'unless', 'until', 'when', 'while', 'yield'],
        constants: ['true', 'false', 'nil'],
        functionKeywords: ['def'],
        typeKeywords: ['class', 'module'],
        lineComment: '#'
    },
    {
        id: 'go', name: 'Go', extensions: ['.go'],
        keywords: ['break', 'case', 'chan', 'const', 'continue', 'default', 'defer', 'else', 'fallthrough', 'for', 'func', 'go', 'goto', 'if', 'import', 'interface', 'map', 'package', 'range', 'return', 'select', 'struct', 'switch', 'type', 'var'],
        constants: ['true', 'false', 'nil', 'iota'],
        functionKeywords: ['func'],
        typeKeywords: ['type'],
        lineComment: '//', blockComment: ['/*', '*/']
    },
    {
        id: 'rust', name: 'Rust', extensions: ['.rs'],
        keywords: ['as', 'async', 'await', 'break', 'const', 'continue', 'crate', 'dyn', 'else', 'enum', 'extern', 'false', 'fn', 'for', 'if', 'impl', 'in', 'let', 'loop', 'match', 'mod', 'move', 'mut', 'pub', 'ref', 'return', 'self', 'static', 'struct', 'super', 'trait', 'true', 'type', 'unsafe', 'use', 'where', 'while'],
        constants: ['true', 'false'],
        functionKeywords: ['fn'],
        typeKeywords: ['struct', 'enum', 'trait', 'type', 'mod', 'union'],
        lineComment: '//', blockComment: ['/*', '*/']
    },
    {
        id: 'shellscript', name: 'Shell Script', extensions: ['.sh', '.bash', '.zsh'],
        keywords: ['case', 'do', 'done', 'elif', 'else', 'esac', 'exit', 'export', 'fi', 'for', 'function', 'if', 'in', 'local', 'readonly', 'return', 'then', 'unset', 'until', 'while'],
        functionKeywords: ['function'],
        lineComment: '#'
    },
    {
        id: 'sql', name: 'SQL', extensions: ['.sql'],
        keywords: ['alter', 'and', 'as', 'asc', 'begin', 'by', 'case', 'commit', 'constraint', 'create', 'database', 'default', 'delete', 'desc', 'distinct', 'drop', 'else', 'end', 'exists', 'from', 'group', 'having', 'in', 'index', 'insert', 'into', 'is', 'join', 'key', 'like', 'limit', 'not', 'null', 'on', 'or', 'order', 'outer', 'primary', 'procedure', 'references', 'rollback', 'select', 'set', 'table', 'then', 'transaction', 'trigger', 'union', 'unique', 'update', 'values', 'view', 'when', 'where'],
        constants: ['null', 'true', 'false'],
        ignoreCase: true,
        lineComment: '--'
    },
    { id: 'plaintext', name: 'Plain Text', keywords: [] }
];

export function createMonarchTokens(entry: NotepadiaLanguageEntry): monaco.languages.IMonarchLanguage {
    switch (entry.id) {
        case 'json':
            return jsonMonarchTokens(entry);
        case 'powershell':
            return powershellMonarchTokens(entry);
        case 'html':
        case 'xml':
            return markupMonarchTokens(entry);
        case 'css':
            return cssMonarchTokens(entry);
        case 'markdown':
            return markdownMonarchTokens(entry);
        case 'yaml':
            return yamlMonarchTokens(entry);
        default:
            return genericMonarchTokens(entry);
    }
}

function genericMonarchTokens(entry: NotepadiaLanguageEntry): monaco.languages.IMonarchLanguage {
    const root: monaco.languages.IMonarchLanguageRule[] = [];
    if (entry.lineComment) {
        root.push([new RegExp(escapeRegex(entry.lineComment) + '.*$'), 'comment']);
    }
    if (entry.blockComment) {
        const [open] = entry.blockComment;
        root.push([new RegExp(escapeRegex(open)), 'comment', 'comment.block']);
    }
    addDefinitionRules(entry, root);
    addConstantRules(entry, root);
    root.push(
        [/"/, 'string', 'string.double'],
        [/'/, 'string', 'string.single'],
        [/[a-zA-Z_\u00C0-\uFFFF][\w\u00C0-\uFFFF]*/, entry.keywords.length
            ? { cases: { '@keywords': 'keyword', '@default': 'identifier' } }
            : 'identifier'],
        [/[0-9]+(\.[0-9]+)?/, 'number'],
        [/[\s]+/, 'white'],
        [/[;:.{}()[\],]+/, 'delimiter'],
        [/[=+\-*/%<>!&|^~?:]+/, 'operator'],
        [/[{}()[\]]/, '@brackets']
    );
    return {
        keywords: entry.keywords,
        constants: entry.constants,
        ignoreCase: entry.ignoreCase,
        tokenizer: {
            root,
            'comment.block': [
                [/.*\*\//, 'comment', '@pop'],
                [/[^*]+/, 'comment'],
                [/\*/, 'comment']
            ],
            'string.double': [
                [/[^"]*"/, 'string', '@pop'],
                [/./, 'string']
            ],
            'string.single': [
                [/[^']*'/, 'string', '@pop'],
                [/./, 'string']
            ]
        }
    };
}

function addDefinitionRules(entry: NotepadiaLanguageEntry, root: monaco.languages.IMonarchLanguageRule[]): void {
    const flags = entry.ignoreCase ? 'i' : '';
    const name = '(?!(?:class|struct|interface|enum|record)\\b)[a-zA-Z_$][\\w$]*';
    const add = (keywords: string[] | undefined, token: string): void => {
        if (!keywords?.length) {
            return;
        }
        const alternatives = keywords.map(keyword => escapeRegex(keyword)).join('|');
        root.push([new RegExp(`\\b(${alternatives})(\\s+)(${name})`, flags), ['keyword', 'white', token]]);
    };
    add(entry.functionKeywords, 'entity.name.function');
    add(entry.typeKeywords, 'entity.name.type');
}

function addConstantRules(entry: NotepadiaLanguageEntry, root: monaco.languages.IMonarchLanguageRule[]): void {
    const constants = (entry.constants ?? []).filter(item => !item.startsWith('$'));
    if (!constants.length) {
        return;
    }
    const alternatives = constants.map(item => escapeRegex(item)).join('|');
    const flags = entry.ignoreCase ? 'i' : '';
    root.push([new RegExp(`\\b(?:${alternatives})\\b`, flags), 'constant']);
}

function jsonMonarchTokens(entry: NotepadiaLanguageEntry): monaco.languages.IMonarchLanguage {
    return {
        keywords: entry.keywords,
        constants: entry.constants,
        tokenizer: {
            root: [
                [/"(?:[^"\\]|\\.)*"(?=\s*:)/, 'string.key.json'],
                [/"(?:[^"\\]|\\.)*"/, 'string.value.json'],
                [/\b(?:true|false|null)\b/, 'constant'],
                [/\b-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/, 'number'],
                [/[{}[\]]/, '@brackets'],
                [/[,:]/, 'delimiter'],
                [/[ \t\r\n]+/, 'white']
            ]
        }
    };
}

function markupMonarchTokens(entry: NotepadiaLanguageEntry): monaco.languages.IMonarchLanguage {
    const name = '[A-Za-z_][\\w:.-]*';
    return {
        ignoreCase: entry.ignoreCase,
        tokenizer: {
            root: [
                [/<!--/, 'comment', '@comment'],
                [/<!\[CDATA\[/, 'string', '@cdata'],
                [/<\?/, 'delimiter', '@processing'],
                [/<!DOCTYPE[^>]*>/i, 'keyword'],
                [new RegExp(`(<\\/?)((?:${name}))`), ['delimiter', 'tag'], '@tag'],
                [/[^<]+/, ''],
                [/</, 'delimiter']
            ],
            tag: [
                [/\s+/, 'white'],
                [/=("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^\s>]+)/, ['delimiter', 'string']],
                [new RegExp(name), 'attribute.name'],
                [/\/?>/, 'delimiter', '@pop'],
                [/./, 'delimiter']
            ],
            comment: [
                [/-->/, 'comment', '@pop'],
                [/./, 'comment']
            ],
            cdata: [
                [/\]\]>/, 'string', '@pop'],
                [/./, 'string']
            ],
            processing: [
                [/\?>/, 'delimiter', '@pop'],
                [/./, 'metatag']
            ]
        }
    };
}

function cssMonarchTokens(entry: NotepadiaLanguageEntry): monaco.languages.IMonarchLanguage {
    return {
        ignoreCase: entry.ignoreCase,
        tokenizer: {
            root: [
                [/\/\*/, 'comment', '@comment'],
                [/"(?:[^"\\]|\\.)*"/, 'string'],
                [/'(?:[^'\\]|\\.)*'/, 'string'],
                [/#[0-9a-fA-F]{3,8}\b/, 'constant.other.color'],
                [/@[a-zA-Z-]+/, 'keyword'],
                [/\b\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|vmin|vmax|s|ms|deg|fr|pt|pc|cm|mm|in|ex|ch)?\b/, 'number'],
                [/[.#][a-zA-Z_-][\w-]*/, 'entity.other.attribute-name.class.css'],
                [/::?[a-zA-Z-]+/, 'entity.other.attribute-name.pseudo-class'],
                [/[a-zA-Z-]+(?=\s*:)/, 'support.type.property-name'],
                [/!important\b/, 'keyword'],
                [/[{}();,]/, 'delimiter'],
                [/:/, 'delimiter'],
                [/[a-zA-Z_-][\w-]*/, 'support.constant.property-value'],
                [/\s+/, 'white'],
                [/[=+\-*/%<>!&|^~?]/, 'operator'],
                [/./, 'delimiter']
            ],
            comment: [
                [/\*\//, 'comment', '@pop'],
                [/./, 'comment']
            ]
        }
    };
}

function markdownMonarchTokens(entry: NotepadiaLanguageEntry): monaco.languages.IMonarchLanguage {
    return {
        keywords: entry.keywords,
        tokenizer: {
            root: [
                [/^#{1,6}\s+.*$/, 'markup.heading'],
                [/^```.*$/, 'punctuation.definition.fenced.markdown', '@fenced'],
                [/^~~~.*$/, 'punctuation.definition.fenced.markdown', '@fencedTilde'],
                [/^(?: {4}|\t).*$/, 'markup.raw.block'],
                [/^\s*>\s?.*$/, 'markup.quote'],
                [/^\s*(?:[-*+]|\d+\.)\s+/, 'punctuation.definition.list.begin.markdown'],
                [/^\s*(?:---+|\*\*\*+|___+)\s*$/, 'punctuation.definition'],
                [/`[^`]+`/, 'markup.inline.raw'],
                [/\*\*[^*]+\*\*/, 'markup.bold'],
                [/__[^_]+__/, 'markup.bold'],
                [/\*[^*]+\*/, 'markup.italic'],
                [/_([^_]+)_/, 'markup.italic'],
                [/(!?\[)([^\]]*)(\]\()([^)]*)(\))/, ['punctuation.definition', 'string.other.link.title.markdown', 'punctuation.definition', 'string.other.link', 'punctuation.definition']],
                [/<(https?:\/\/[^>]+)>/, 'string.other.link'],
                [/<!--/, 'comment', '@comment'],
                [/[^`*_![<#>\n]+/, ''],
                [/./, '']
            ],
            fenced: [
                [/^```\s*$/, 'punctuation.definition.fenced.markdown', '@pop'],
                [/^.+$/, 'markup.raw.block.fenced.markdown']
            ],
            fencedTilde: [
                [/^~~~\s*$/, 'punctuation.definition.fenced.markdown', '@pop'],
                [/^.+$/, 'markup.raw.block.fenced.markdown']
            ],
            comment: [
                [/-->/, 'comment', '@pop'],
                [/./, 'comment']
            ]
        }
    };
}

function yamlMonarchTokens(entry: NotepadiaLanguageEntry): monaco.languages.IMonarchLanguage {
    return {
        ignoreCase: entry.ignoreCase,
        tokenizer: {
            root: [
                [/^\s*#.*$/, 'comment'],
                [/^(?:---|\.\.\.)\s*$/, 'punctuation.definition'],
                [/^(\s*)(-\s+)([^\s:#][^:#\n]*)(?=\s*:)/, ['white', 'punctuation.definition', 'key']],
                [/^(\s*)([^\s:#][^:#\n]*)(?=\s*:)/, ['white', 'key']],
                [/^(\s*)(-\s+)/, ['white', 'punctuation.definition']],
                [/\b(?:true|false|null|yes|no|on|off)\b/i, 'constant'],
                [/[-+]?\b\d+(?:\.\d+)?\b/, 'number'],
                [/"(?:[^"\\]|\\.)*"/, 'string'],
                [/'(?:[^']|'')*'/, 'string'],
                [/#.*$/, 'comment'],
                [/:/, 'delimiter'],
                [/\s+/, 'white'],
                [/[^\s#]+/, 'string']
            ]
        }
    };
}

function powershellMonarchTokens(entry: NotepadiaLanguageEntry): monaco.languages.IMonarchLanguage {
    const root: monaco.languages.IMonarchLanguageRule[] = [
        [/#.*$/, 'comment'],
        [/<#/, 'comment', 'comment.block'],
        [/"@/, 'string', 'here.double'],
        [/@'/, 'string', 'here.single'],
        [/"/, 'string', 'string.double'],
        [/'/, 'string', 'string.single']
    ];
    addDefinitionRules(entry, root);
    root.push(
        [/\$(?:true|false|null)\b/i, 'constant'],
        [/\$[\w:]+/, 'variable'],
        [/\b\d+(\.\d+)?\b/, 'number'],
        [/\b[A-Z][a-zA-Z0-9]*-[a-zA-Z][a-zA-Z0-9]*\b/, 'function'],
        [/[a-zA-Z_][\w-]*/, { cases: { '@keywords': 'keyword', '@default': 'identifier' } }],
        [/[\s]+/, 'white'],
        [/[;:.{}()[\],]+/, 'delimiter'],
        [/[=+\-*/%<>!&|^~?:]+/, 'operator'],
        [/[{}()[\]]/, '@brackets']
    );
    return {
        keywords: entry.keywords,
        ignoreCase: true,
        tokenizer: {
            root,
            'comment.block': [
                [/#>/, 'comment', '@pop'],
                [/[^#]+/, 'comment'],
                [/#/, 'comment']
            ],
            'string.double': [
                [/\\./, 'string'],
                [/"/, 'string', '@pop'],
                [/[^"]/, 'string']
            ],
            'string.single': [
                [/''/, 'string'],
                [/'/, 'string', '@pop'],
                [/[^']/, 'string']
            ],
            'here.double': [
                [/"@/, 'string', '@pop'],
                [/[^@"]+/, 'string'],
                [/[@"]/, 'string']
            ],
            'here.single': [
                [/'@/, 'string', '@pop'],
                [/[^@']+/, 'string'],
                [/[@']/, 'string']
            ]
        }
    };
}

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
