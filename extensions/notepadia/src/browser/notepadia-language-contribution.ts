import { inject, injectable } from '@theia/core/shared/inversify';
import { Command, CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import { MenuContribution, MenuModelRegistry } from '@theia/core/lib/common/menu';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { EditorCommands } from '@theia/editor/lib/browser/editor-command';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import * as monaco from '@theia/monaco-editor-core';

/**
 * Notepad++-style Language menu. The built-in "Change Language Mode..."
 * quick-pick lists every *registered* language; this build ships almost none,
 * so the curated list below is registered up-front with lightweight Monarch
 * tokenizers (keywords, strings, comments, numbers) to make each language
 * selectable and syntax-tinted, matching how Notepad++ exposes its languages.
 */
export namespace NotepadiaLanguageCommands {
    /**
     * Wrapper around the built-in command: the built-in registration is gated
     * by `isVisible: canConfigureLanguage`, which hides it from menus.
     */
    export const CHANGE: Command = { id: 'notepadia.language.change', label: 'Change Language Mode...' };
}

export interface NotepadiaLanguageEntry {
    readonly id: string;
    readonly name: string;
    /** File extensions used for auto-detection. Optional: if the extension is
     * already owned by another registered language it is silently dropped. */
    readonly extensions?: string[];
    readonly keywords: string[];
    readonly lineComment?: string;
    readonly blockComment?: [string, string];
}

export const NOTEPADIA_LANGUAGES: ReadonlyArray<NotepadiaLanguageEntry> = [
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
export function notepadiaLanguageName(id?: string, fallback = 'Plain Text'): string {
    if (!id) {
        return fallback;
    }
    const entry = NOTEPADIA_LANGUAGES.find(item => item.id === id);
    if (entry) {
        return entry.name;
    }
    const language = monaco.languages.getLanguages().find(item => item.id === id);
    return language?.aliases?.find(alias => alias !== id) ?? id;
}

@injectable()
export class NotepadiaLanguageContribution implements CommandContribution, MenuContribution, FrontendApplicationContribution {

    constructor(
        @inject(EditorManager) protected readonly editorManager: EditorManager
    ) { }

    onStart(): void {
        this.registerLanguages();
    }

    protected registerLanguages(): void {
        for (const entry of NOTEPADIA_LANGUAGES) {
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
            monaco.languages.setLanguageConfiguration(entry.id, {
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

    protected monarchTokens(entry: NotepadiaLanguageEntry): monaco.languages.IMonarchLanguage {
        if (entry.id === 'json') {
            return this.jsonMonarchTokens(entry);
        }
        if (entry.id === 'powershell') {
            return this.powershellMonarchTokens(entry);
        }
        return this.genericMonarchTokens(entry);
    }

    protected genericMonarchTokens(entry: NotepadiaLanguageEntry): monaco.languages.IMonarchLanguage {
        const root: monaco.languages.IMonarchLanguage['tokenizer']['root'] = [];
        if (entry.lineComment) {
            root.push([new RegExp(this.escapeRegex(entry.lineComment) + '.*$'), 'comment']);
        }
        if (entry.blockComment) {
            const [open] = entry.blockComment;
            root.push([new RegExp(this.escapeRegex(open)), 'comment', 'comment.block']);
        }
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
    protected jsonMonarchTokens(entry: NotepadiaLanguageEntry): monaco.languages.IMonarchLanguage {
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
    protected powershellMonarchTokens(entry: NotepadiaLanguageEntry): monaco.languages.IMonarchLanguage {
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

    protected escapeRegex(value: string): string {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(NotepadiaLanguageCommands.CHANGE, {
            execute: () => commands.executeCommand(EditorCommands.CHANGE_LANGUAGE.id)
        });

        NOTEPADIA_LANGUAGES.forEach(entry => {
            commands.registerCommand({ id: `notepadia.language.${entry.id}`, label: entry.name }, {
                execute: () => this.setLanguage(entry.id)
            });
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        const language = ['menubar', '6_language'];
        menus.registerSubmenu(language, 'Language');

        menus.registerMenuAction(language, {
            commandId: NotepadiaLanguageCommands.CHANGE.id,
            order: '0'
        });

        NOTEPADIA_LANGUAGES.forEach((entry, index) => {
            menus.registerMenuAction(language, {
                commandId: `notepadia.language.${entry.id}`,
                order: String(index + 1).padStart(2, '0')
            });
        });
    }

    protected setLanguage(languageId: string): void {
        const editor = this.editorManager.currentEditor;
        editor?.editor.setLanguage(languageId);
    }
}