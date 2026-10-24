"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotepadiaLanguageContribution = exports.NOTEPADIA_LANGUAGES = exports.NotepadiaLanguageCommands = void 0;
exports.notepadiaLanguageName = notepadiaLanguageName;
const inversify_1 = require("@theia/core/shared/inversify");
const editor_command_1 = require("@theia/editor/lib/browser/editor-command");
const editor_manager_1 = require("@theia/editor/lib/browser/editor-manager");
const monaco = __importStar(require("@theia/monaco-editor-core"));
/**
 * Notepad++-style Language menu. The built-in "Change Language Mode..."
 * quick-pick lists every *registered* language; this build ships almost none,
 * so the curated list below is registered up-front with lightweight Monarch
 * tokenizers (keywords, strings, comments, numbers) to make each language
 * selectable and syntax-tinted, matching how Notepad++ exposes its languages.
 */
var NotepadiaLanguageCommands;
(function (NotepadiaLanguageCommands) {
    /**
     * Wrapper around the built-in command: the built-in registration is gated
     * by `isVisible: canConfigureLanguage`, which hides it from menus.
     */
    NotepadiaLanguageCommands.CHANGE = { id: 'notepadia.language.change', label: 'Change Language Mode...' };
})(NotepadiaLanguageCommands || (exports.NotepadiaLanguageCommands = NotepadiaLanguageCommands = {}));
exports.NOTEPADIA_LANGUAGES = [
    {
        id: 'javascript', name: 'JavaScript', extensions: ['.js', '.mjs', '.cjs'],
        keywords: ['async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends', 'false', 'finally', 'for', 'function', 'get', 'if', 'import', 'in', 'instanceof', 'let', 'new', 'null', 'of', 'return', 'set', 'static', 'super', 'switch', 'this', 'throw', 'true', 'try', 'typeof', 'undefined', 'var', 'void', 'while', 'with', 'yield'],
        lineComment: '//', blockComment: ['/*', '*/']
    },
    {
        id: 'typescript', name: 'TypeScript', extensions: ['.ts', '.mts', '.cts'],
        keywords: ['abstract', 'any', 'async', 'await', 'boolean', 'break', 'case', 'catch', 'class', 'const', 'constructor', 'continue', 'debugger', 'declare', 'default', 'delete', 'do', 'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'function', 'get', 'if', 'implements', 'import', 'in', 'infer', 'instanceof', 'interface', 'keyof', 'let', 'namespace', 'never', 'new', 'null', 'number', 'object', 'of', 'override', 'private', 'protected', 'public', 'readonly', 'return', 'set', 'static', 'string', 'super', 'switch', 'this', 'throw', 'true', 'try', 'type', 'typeof', 'undefined', 'unique', 'unknown', 'var', 'void', 'while', 'with', 'yield'],
        lineComment: '//', blockComment: ['/*', '*/']
    },
    {
        id: 'html', name: 'HTML', extensions: ['.html', '.htm'],
        keywords: ['a', 'body', 'br', 'div', 'em', 'form', 'head', 'html', 'img', 'input', 'li', 'link', 'meta', 'p', 'script', 'span', 'strong', 'style', 'table', 'td', 'th', 'title', 'tr', 'ul'],
        blockComment: ['<!--', '-->']
    },
    {
        id: 'css', name: 'CSS', extensions: ['.css'],
        keywords: ['align', 'background', 'border', 'bottom', 'color', 'display', 'font', 'font-family', 'font-size', 'font-weight', 'height', 'left', 'line-height', 'margin', 'opacity', 'padding', 'position', 'right', 'text-align', 'top', 'transition', 'width', 'z-index'],
        blockComment: ['/*', '*/']
    },
    {
        id: 'markdown', name: 'Markdown', extensions: ['.md'],
        keywords: []
    },
    {
        id: 'yaml', name: 'YAML', extensions: ['.yml', '.yaml'],
        keywords: ['true', 'false', 'null', 'yes', 'no', 'on', 'off'],
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
        lineComment: '#',
    },
    {
        id: 'c', name: 'C', extensions: ['.c', '.h'],
        keywords: ['auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum', 'extern', 'float', 'for', 'goto', 'if', 'int', 'long', 'register', 'return', 'short', 'signed', 'sizeof', 'static', 'struct', 'switch', 'typedef', 'union', 'unsigned', 'void', 'volatile', 'while'],
        lineComment: '//', blockComment: ['/*', '*/']
    },
    {
        id: 'cpp', name: 'C++', extensions: ['.cpp', '.cc', '.cxx', '.hpp', '.hh'],
        keywords: ['alignas', 'alignof', 'and', 'asm', 'auto', 'bool', 'break', 'case', 'catch', 'char', 'class', 'const', 'constexpr', 'continue', 'decltype', 'default', 'delete', 'do', 'double', 'else', 'enum', 'explicit', 'export', 'extern', 'false', 'float', 'for', 'friend', 'goto', 'if', 'inline', 'int', 'long', 'mutable', 'namespace', 'new', 'noexcept', 'nullptr', 'operator', 'private', 'protected', 'public', 'register', 'return', 'short', 'signed', 'sizeof', 'static', 'struct', 'switch', 'template', 'this', 'throw', 'true', 'try', 'typedef', 'typename', 'union', 'unsigned', 'using', 'virtual', 'void', 'volatile', 'while'],
        lineComment: '//', blockComment: ['/*', '*/']
    },
    {
        id: 'csharp', name: 'C#', extensions: ['.cs'],
        keywords: ['abstract', 'as', 'async', 'await', 'base', 'bool', 'break', 'byte', 'case', 'catch', 'char', 'class', 'const', 'continue', 'decimal', 'default', 'delegate', 'do', 'double', 'else', 'enum', 'event', 'explicit', 'extern', 'false', 'finally', 'fixed', 'float', 'for', 'foreach', 'get', 'goto', 'if', 'implicit', 'in', 'int', 'interface', 'internal', 'is', 'lock', 'long', 'namespace', 'new', 'null', 'object', 'operator', 'out', 'override', 'params', 'private', 'protected', 'public', 'readonly', 'ref', 'return', 'sbyte', 'sealed', 'set', 'short', 'sizeof', 'static', 'string', 'struct', 'switch', 'this', 'throw', 'true', 'try', 'typeof', 'uint', 'ulong', 'unchecked', 'unsafe', 'ushort', 'using', 'virtual', 'void', 'volatile', 'while'],
        lineComment: '//', blockComment: ['/*', '*/']
    },
    {
        id: 'java', name: 'Java', extensions: ['.java'],
        keywords: ['abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum', 'extends', 'final', 'finally', 'float', 'for', 'goto', 'if', 'implements', 'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new', 'null', 'package', 'private', 'protected', 'public', 'return', 'short', 'static', 'strictfp', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws', 'transient', 'true', 'try', 'void', 'volatile', 'while'],
        lineComment: '//', blockComment: ['/*', '*/']
    },
    {
        id: 'json', name: 'JSON', extensions: ['.json', '.jsonc', '.json5'],
        keywords: ['true', 'false', 'null']
    },
    {
        id: 'php', name: 'PHP', extensions: ['.php'],
        keywords: ['as', 'break', 'case', 'catch', 'class', 'const', 'continue', 'declare', 'default', 'do', 'echo', 'else', 'elseif', 'extends', 'final', 'finally', 'for', 'foreach', 'function', 'global', 'if', 'implements', 'interface', 'namespace', 'new', 'print', 'private', 'protected', 'public', 'return', 'static', 'switch', 'throw', 'trait', 'try', 'use', 'var', 'while', 'yield'],
        lineComment: '//', blockComment: ['/*', '*/']
    },
    {
        id: 'powershell', name: 'PowerShell', extensions: ['.ps1', '.psm1', '.psd1', '.pssc'],
        keywords: ['and', 'begin', 'break', 'catch', 'class', 'continue', 'contains', 'data', 'define', 'do', 'dynamicparam', 'else', 'elseif', 'end', 'enum', 'eq', 'exit', 'filter', 'finally', 'for', 'foreach', 'from', 'function', 'ge', 'gt', 'if', 'in', 'le', 'like', 'lt', 'match', 'ne', 'not', 'notcontains', 'notlike', 'notmatch', 'or', 'param', 'process', 'return', 'switch', 'throw', 'trap', 'try', 'until', 'using', 'var', 'while', 'workflow', 'xor'],
        lineComment: '#', blockComment: ['<#', '#>']
    },
    {
        id: 'ruby', name: 'Ruby', extensions: ['.rb'],
        keywords: ['alias', 'and', 'begin', 'break', 'case', 'class', 'def', 'defined?', 'do', 'else', 'elsif', 'end', 'ensure', 'false', 'for', 'if', 'in', 'module', 'next', 'nil', 'not', 'or', 'redo', 'rescue', 'retry', 'return', 'self', 'super', 'then', 'true', 'undef', 'unless', 'until', 'when', 'while', 'yield'],
        lineComment: '#'
    },
    {
        id: 'go', name: 'Go', extensions: ['.go'],
        keywords: ['break', 'case', 'chan', 'const', 'continue', 'default', 'defer', 'else', 'fallthrough', 'for', 'func', 'go', 'goto', 'if', 'import', 'interface', 'map', 'package', 'range', 'return', 'select', 'struct', 'switch', 'type', 'var'],
        lineComment: '//', blockComment: ['/*', '*/']
    },
    {
        id: 'rust', name: 'Rust', extensions: ['.rs'],
        keywords: ['as', 'async', 'await', 'break', 'const', 'continue', 'crate', 'dyn', 'else', 'enum', 'extern', 'false', 'fn', 'for', 'if', 'impl', 'in', 'let', 'loop', 'match', 'mod', 'move', 'mut', 'pub', 'ref', 'return', 'self', 'static', 'struct', 'super', 'trait', 'true', 'type', 'unsafe', 'use', 'where', 'while'],
        lineComment: '//', blockComment: ['/*', '*/']
    },
    {
        id: 'shellscript', name: 'Shell Script', extensions: ['.sh', '.bash', '.zsh'],
        keywords: ['case', 'do', 'done', 'elif', 'else', 'esac', 'exit', 'export', 'fi', 'for', 'function', 'if', 'in', 'local', 'readonly', 'return', 'then', 'unset', 'until', 'while'],
        lineComment: '#'
    },
    {
        id: 'sql', name: 'SQL', extensions: ['.sql'],
        keywords: ['alter', 'and', 'as', 'asc', 'begin', 'by', 'case', 'commit', 'constraint', 'create', 'database', 'default', 'delete', 'desc', 'distinct', 'drop', 'else', 'end', 'exists', 'from', 'group', 'having', 'in', 'index', 'insert', 'into', 'is', 'join', 'key', 'like', 'limit', 'not', 'null', 'on', 'or', 'order', 'outer', 'primary', 'procedure', 'references', 'rollback', 'select', 'set', 'table', 'then', 'transaction', 'trigger', 'union', 'unique', 'update', 'values', 'view', 'when', 'where'],
        lineComment: '--'
    },
    { id: 'plaintext', name: 'Plain Text', keywords: [] }
];
/**
 * Convenience name lookup shared with the status bar.
 */
function notepadiaLanguageName(id, fallback = 'Plain Text') {
    if (!id) {
        return fallback;
    }
    const entry = exports.NOTEPADIA_LANGUAGES.find(item => item.id === id);
    if (entry) {
        return entry.name;
    }
    const language = monaco.languages.getLanguages().find(item => item.id === id);
    return language?.aliases?.find(alias => alias !== id) ?? id;
}
let NotepadiaLanguageContribution = class NotepadiaLanguageContribution {
    editorManager;
    constructor(editorManager) {
        this.editorManager = editorManager;
    }
    onStart() {
        this.registerLanguages();
    }
    registerLanguages() {
        for (const entry of exports.NOTEPADIA_LANGUAGES) {
            if (monaco.languages.getLanguages().some(language => language.id === entry.id)) {
                continue;
            }
            const extensions = (entry.extensions ?? []).filter(ext => {
                for (const language of monaco.languages.getLanguages()) {
                    if (language.id === 'plaintext') {
                        continue;
                    }
                    if (language.extensions?.some(item => item === ext)) {
                        return false;
                    }
                }
                return true;
            });
            monaco.languages.register({
                id: entry.id,
                aliases: [entry.name],
                extensions,
                ...(entry.id === 'markdown' ? { filenames: ['README'] } : {})
            });
            monaco.languages.setMonarchTokensProvider(entry.id, this.monarchTokens(entry));
            monaco.languages.setLanguageConfiguration(entry.id, entry.id === 'markdown' ? {
                brackets: [
                    ['(', ')'],
                    ['[', ']'],
                    ['{', '}']
                ],
                autoClosingPairs: [
                    { open: '(', close: ')' },
                    { open: '[', close: ']' },
                    { open: '{', close: '}' },
                    { open: '"', close: '"' }
                ],
                surroundingPairs: [
                    { open: '(', close: ')' },
                    { open: '[', close: ']' },
                    { open: '{', close: '}' },
                    { open: '"', close: '"' },
                    { open: "'", close: "'" }
                ]
            } : {
                brackets: [
                    ['(', ')'],
                    ['[', ']'],
                    ['{', '}']
                ],
                autoClosingPairs: [
                    { open: '(', close: ')' },
                    { open: '[', close: ']' },
                    { open: '{', close: '}' },
                    { open: '"', close: '"' },
                    { open: "'", close: "'" }
                ],
                surroundingPairs: [
                    { open: '(', close: ')' },
                    { open: '[', close: ']' },
                    { open: '{', close: '}' },
                    { open: '"', close: '"' },
                    { open: "'", close: "'" }
                ]
            });
        }
    }
    monarchTokens(entry) {
        if (entry.id === 'json') {
            return this.jsonMonarchTokens(entry);
        }
        if (entry.id === 'powershell') {
            return this.powershellMonarchTokens(entry);
        }
        return this.genericMonarchTokens(entry);
    }
    genericMonarchTokens(entry) {
        const root = [];
        if (entry.lineComment) {
            root.push([new RegExp(this.escapeRegex(entry.lineComment) + '.*$'), 'comment']);
        }
        if (entry.blockComment) {
            const [open] = entry.blockComment;
            root.push([new RegExp(this.escapeRegex(open)), 'comment', 'comment.block']);
        }
        root.push([/"/, 'string', 'string.double'], ...(entry.id === 'markdown' ? [] : [[/'/, 'string', 'string.single']]), [/[a-zA-Z_\u00C0-\uFFFF][\w\u00C0-\uFFFF]*/, entry.keywords.length
                ? { cases: { '@keywords': 'keyword', '@default': 'identifier' } }
                : 'identifier'], [/[0-9]+(\.[0-9]+)?/, 'number'], [/[\s]+/, 'white'], [/[;:.{}()[\],]+/, 'delimiter'], [/[=+\-*/%<>!&|^~?:]+/, 'operator'], [/[{}()[\]]/, '@brackets']);
        return {
            keywords: entry.keywords,
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
    /**
     * JSON: double-quoted strings only (escapes handled), numbers,
     * true/false/null literals, structural punctuation and bracket nesting.
     */
    jsonMonarchTokens(entry) {
        return {
            keywords: entry.keywords,
            tokenizer: {
                root: [
                    [/"(?:[^"\\]|\\.)*"/, 'string'],
                    [/\b(?:true|false|null)\b/, 'keyword'],
                    [/\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/, 'number'],
                    [/[{}[\]]/, '@brackets'],
                    [/[,:]/, 'delimiter'],
                    [/[ \t\r\n]+/, 'white']
                ]
            }
        };
    }
    /**
     * PowerShell: both comment markers (# and <# #>), single/double-quoted
     * strings plus here-strings ("@ ... "@, '@ ... '@), variables ($x),
     * cmdlets (Verb-Noun), operators and keywords like if/elseif/for/finally.
     */
    powershellMonarchTokens(entry) {
        return {
            keywords: entry.keywords,
            tokenizer: {
                root: [
                    [/#.*$/, 'comment'],
                    [/<#/, 'comment', 'comment.block'],
                    [/"@/, 'string', 'here.double'],
                    [/@'/, 'string', 'here.single'],
                    [/"/, 'string', 'string.double'],
                    [/'/, 'string', 'string.single'],
                    [/\$[\w:]+/, 'variable'],
                    [/\b\d+(\.\d+)?\b/, 'number'],
                    [/\b[A-Z][a-zA-Z0-9]*-[a-zA-Z][a-zA-Z0-9]*\b/, 'function'],
                    [/[a-zA-Z_][\w-]*/, entry.keywords.length
                            ? { cases: { '@keywords': 'keyword', '@default': 'identifier' } }
                            : 'identifier'],
                    [/[\s]+/, 'white'],
                    [/[;:.{}()[\],]+/, 'delimiter'],
                    [/[=+\-*/%<>!&|^~?:]+/, 'operator'],
                    [/[{}()[\]]/, '@brackets']
                ],
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
    escapeRegex(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    registerCommands(commands) {
        commands.registerCommand(NotepadiaLanguageCommands.CHANGE, {
            execute: () => commands.executeCommand(editor_command_1.EditorCommands.CHANGE_LANGUAGE.id)
        });
        exports.NOTEPADIA_LANGUAGES.forEach(entry => {
            commands.registerCommand({ id: `notepadia.language.${entry.id}`, label: entry.name }, {
                execute: () => this.setLanguage(entry.id)
            });
        });
    }
    registerMenus(menus) {
        const language = ['menubar', '6_language'];
        menus.registerSubmenu(language, 'Language');
        menus.registerMenuAction(language, {
            commandId: NotepadiaLanguageCommands.CHANGE.id,
            order: '0'
        });
        exports.NOTEPADIA_LANGUAGES.forEach((entry, index) => {
            menus.registerMenuAction(language, {
                commandId: `notepadia.language.${entry.id}`,
                order: String(index + 1).padStart(2, '0')
            });
        });
    }
    setLanguage(languageId) {
        const editor = this.editorManager.currentEditor;
        editor?.editor.setLanguage(languageId);
    }
};
exports.NotepadiaLanguageContribution = NotepadiaLanguageContribution;
exports.NotepadiaLanguageContribution = NotepadiaLanguageContribution = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)(editor_manager_1.EditorManager)),
    __metadata("design:paramtypes", [editor_manager_1.EditorManager])
], NotepadiaLanguageContribution);
//# sourceMappingURL=notepadia-language-contribution.js.map