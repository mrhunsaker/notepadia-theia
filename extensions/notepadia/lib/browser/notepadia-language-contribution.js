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
exports.NotepadiaLanguageContribution = exports.NotepadiaLanguageCommands = void 0;
exports.notepadiaLanguageName = notepadiaLanguageName;
const inversify_1 = require("@theia/core/shared/inversify");
const editor_command_1 = require("@theia/editor/lib/browser/editor-command");
const editor_manager_1 = require("@theia/editor/lib/browser/editor-manager");
const monaco = __importStar(require("@theia/monaco-editor-core"));
const notepadia_language_tokens_1 = require("./notepadia-language-tokens");
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
function notepadiaLanguageName(id, fallback = 'Plain Text') {
    if (!id) {
        return fallback;
    }
    const entry = notepadia_language_tokens_1.NOTEPADIA_LANGUAGES.find(item => item.id === id);
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
        for (const entry of notepadia_language_tokens_1.NOTEPADIA_LANGUAGES) {
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
            monaco.languages.setMonarchTokensProvider(entry.id, (0, notepadia_language_tokens_1.createMonarchTokens)(entry));
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
    registerCommands(commands) {
        commands.registerCommand(NotepadiaLanguageCommands.CHANGE, {
            execute: () => commands.executeCommand(editor_command_1.EditorCommands.CHANGE_LANGUAGE.id)
        });
        notepadia_language_tokens_1.NOTEPADIA_LANGUAGES.forEach(entry => {
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
        notepadia_language_tokens_1.NOTEPADIA_LANGUAGES.forEach((entry, index) => {
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