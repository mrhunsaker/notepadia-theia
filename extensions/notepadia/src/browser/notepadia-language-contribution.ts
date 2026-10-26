import { inject, injectable } from '@theia/core/shared/inversify';
import { Command, CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import { MenuContribution, MenuModelRegistry } from '@theia/core/lib/common/menu';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { EditorCommands } from '@theia/editor/lib/browser/editor-command';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import * as monaco from '@theia/monaco-editor-core';
import { NOTEPADIA_LANGUAGES, createMonarchTokens } from './notepadia-language-tokens';

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
            monaco.languages.setMonarchTokensProvider(entry.id, createMonarchTokens(entry));
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