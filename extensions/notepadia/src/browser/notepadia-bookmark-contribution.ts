import { inject, injectable } from '@theia/core/shared/inversify';
import * as monaco from '@theia/monaco-editor-core';
import { DisposableCollection } from '@theia/core/lib/common/disposable';
import { FrontendApplication, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { Command, CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import { MenuContribution, MenuModelRegistry } from '@theia/core/lib/common/menu';
import { KeybindingContribution, KeybindingRegistry } from '@theia/core/lib/browser/keybinding';
import { CommonMenus } from '@theia/core/lib/browser/common-menus';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';

/**
 * Notepad++-style bookmarks. Bookmarks live per-model (uri -> sorted line
 * numbers) and render in the line-number gutter of every editor hosting that
 * model via a Monaco decoration collection. Navigation is within the current
 * file; bookmarks are session-scoped (Notepad++ also keeps them per session).
 */
export namespace NotepadiaBookmarkCommands {
    export const TOGGLE: Command = { id: 'notepadia.bookmark.toggle', label: 'Toggle Bookmark' };
    export const NEXT: Command = { id: 'notepadia.bookmark.next', label: 'Next Bookmark' };
    export const PREVIOUS: Command = { id: 'notepadia.bookmark.previous', label: 'Previous Bookmark' };
    export const CLEAR: Command = { id: 'notepadia.bookmark.clear', label: 'Clear All Bookmarks' };
}

@injectable()
export class NotepadiaBookmarkContribution implements CommandContribution, MenuContribution, KeybindingContribution, FrontendApplicationContribution {

    protected static readonly DECORATION_CLASS = 'notepadia-bookmark-glyph';

    protected readonly bookmarks = new Map<string, Set<number>>();
    protected readonly collections = new Map<string, {
        control: monaco.editor.ICodeEditor;
        collection: monaco.editor.IEditorDecorationsCollection;
    }>();

    constructor(
        @inject(EditorManager) protected readonly editorManager: EditorManager
    ) { }

    async onStart(_app: FrontendApplication): Promise<void> {
        const disposables = new DisposableCollection();
        disposables.push(this.editorManager.onCurrentEditorChanged(() => {
            const current = this.currentModelKey();
            if (current) {
                this.applyToCurrent();
            }
        }));
        disposables.push(this.editorManager.onCreated(() => this.applyToCurrent()));
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(NotepadiaBookmarkCommands.TOGGLE, { execute: () => this.toggle() });
        commands.registerCommand(NotepadiaBookmarkCommands.NEXT, { execute: () => this.navigate(1) });
        commands.registerCommand(NotepadiaBookmarkCommands.PREVIOUS, { execute: () => this.navigate(-1) });
        commands.registerCommand(NotepadiaBookmarkCommands.CLEAR, { execute: () => this.clear() });
    }

    registerMenus(menus: MenuModelRegistry): void {
        const bookmarks = [...CommonMenus.EDIT, 'a_notepadia-bookmarks'];
        menus.registerSubmenu(bookmarks, 'Bookmarks');
        menus.registerMenuAction(bookmarks, { commandId: NotepadiaBookmarkCommands.TOGGLE.id, order: 'a' });
        menus.registerMenuAction(bookmarks, { commandId: NotepadiaBookmarkCommands.NEXT.id, order: 'b' });
        menus.registerMenuAction(bookmarks, { commandId: NotepadiaBookmarkCommands.PREVIOUS.id, order: 'c' });
        menus.registerMenuAction(bookmarks, { commandId: NotepadiaBookmarkCommands.CLEAR.id, order: 'd' });
    }

    registerKeybindings(registry: KeybindingRegistry): void {
        registry.registerKeybinding({ command: NotepadiaBookmarkCommands.TOGGLE.id, keybinding: 'ctrl+f2', when: 'editorTextFocus' });
        registry.registerKeybinding({ command: NotepadiaBookmarkCommands.NEXT.id, keybinding: 'f2', when: 'editorTextFocus' });
        registry.registerKeybinding({ command: NotepadiaBookmarkCommands.PREVIOUS.id, keybinding: 'shift+f2', when: 'editorTextFocus' });
    }

    protected currentEditor(): MonacoEditor | undefined {
        const widget = this.editorManager.currentEditor;
        return widget ? MonacoEditor.get(widget) : undefined;
    }

    protected currentModelKey(): string | undefined {
        const model = this.currentEditor()?.getControl().getModel();
        return model ? model.uri.toString() : undefined;
    }

    protected toggle(): void {
        const editor = this.currentEditor();
        const model = editor?.getControl().getModel();
        if (!editor || !model) {
            return;
        }
        const line = editor.getControl().getPosition()?.lineNumber ?? 1;
        const key = model.uri.toString();
        const set = this.bookmarks.get(key) || new Set<number>();
        if (set.has(line)) {
            set.delete(line);
        } else {
            set.add(line);
        }
        if (set.size === 0) {
            this.bookmarks.delete(key);
        } else {
            this.bookmarks.set(key, set);
        }
        this.applyTo(key);
    }

    protected navigate(direction: 1 | -1): void {
        const editor = this.currentEditor();
        const model = editor?.getControl().getModel();
        if (!editor || !model) {
            return;
        }
        const key = model.uri.toString();
        const set = this.bookmarks.get(key);
        if (!set || set.size === 0) {
            return;
        }
        const current = editor.getControl().getPosition()?.lineNumber ?? 1;
        const lines = Array.from(set).sort((a, b) => a - b);
        let target: number;
        if (direction === 1) {
            target = lines.find(l => l > current) ?? lines[0];
        } else {
            const below = lines.filter(l => l < current);
            target = below.length > 0 ? below[below.length - 1] : lines[lines.length - 1];
        }
        editor.getControl().setPosition({ lineNumber: target, column: 1 });
        editor.getControl().revealLineInCenter(target);
    }

    protected clear(): void {
        const key = this.currentModelKey();
        if (!key) {
            return;
        }
        this.bookmarks.delete(key);
        this.applyTo(key);
    }

    protected decorationsFor(key: string): monaco.editor.IModelDeltaDecoration[] {
        const set = this.bookmarks.get(key);
        if (!set) {
            return [];
        }
        return Array.from(set).sort((a, b) => a - b).map(line => ({
            range: new monaco.Range(line, 1, line, 1),
            options: { isWholeLine: true, linesDecorationsClassName: NotepadiaBookmarkContribution.DECORATION_CLASS }
        }));
    }

    protected applyToCurrent(): void {
        const key = this.currentModelKey();
        if (key) {
            this.applyTo(key);
        }
    }

    protected applyTo(key: string): void {
        const editor = this.currentEditor();
        const control = editor?.getControl();
        const model = control?.getModel();
        if (!control || !model || model.uri.toString() !== key) {
            return;
        }
        let entry = this.collections.get(key);
        if (!entry || entry.control !== control || entry.control.getModel() !== model) {
            entry = { control, collection: control.createDecorationsCollection([]) };
            this.collections.set(key, entry);
        }
        entry.collection.set(this.decorationsFor(key));
    }
}