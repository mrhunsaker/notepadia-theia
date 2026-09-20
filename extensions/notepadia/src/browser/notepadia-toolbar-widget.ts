import * as React from '@theia/core/shared/react';
import { Message } from '@theia/core/shared/@lumino/messaging';
import { Widget } from '@theia/core/shared/@lumino/widgets';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { DisposableCollection } from '@theia/core/lib/common/disposable';
import { CommandRegistry } from '@theia/core/lib/common/command';
import { PreferenceService } from '@theia/core/lib/common/preferences';
import { ApplicationShell, NavigatableWidget, Saveable } from '@theia/core/lib/browser';
import { CommonCommands } from '@theia/core/lib/browser/common-commands';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import { NotepadiaCommands } from './notepadia-contribution';
import { NotepadiaPrintCommands } from './notepadia-print-contribution';
import { NotepadiaMacroCommands } from './notepadia-macro-contribution';
import { NOTEPADIA_TOOLBAR_VISIBLE_PREFERENCE } from './notepadia-shell-contribution';

export const NOTEPADIA_TOOLBAR_ID = 'notepadia.toolbar';

/**
 * Decorative glyph class used in place of a codicon; the icon itself is drawn
 * by CSS (see style/notepadia-toolbar.css) so no color string lives here.
 */
const PRINTER_GLYPH = 'notepadia-toolbar-print-glyph';

interface NotepadiaToolbarItem {
    readonly commandId: string;
    readonly tooltip: string;
    /** `codicon codicon-*` pair or a custom glyph class (the printer). */
    readonly glyph: string;
    readonly separatorBefore?: boolean;
    /** Commands that read like a switch get `aria-pressed` and a pressed style. */
    readonly toggle?: boolean;
}

const TOOLBAR_ITEMS: NotepadiaToolbarItem[] = [
    { commandId: NotepadiaCommands.NEW_DOCUMENT.id, tooltip: 'New', glyph: 'codicon codicon-new-file' },
    { commandId: CommonCommands.OPEN.id, tooltip: 'Open', glyph: 'codicon codicon-folder-opened' },
    { commandId: CommonCommands.SAVE.id, tooltip: 'Save', glyph: 'codicon codicon-save' },
    { commandId: CommonCommands.SAVE_ALL.id, tooltip: 'Save All', glyph: 'codicon codicon-save-all' },
    { commandId: NotepadiaCommands.CLOSE.id, tooltip: 'Close', glyph: 'codicon codicon-close' },
    { commandId: NotepadiaCommands.CLOSE_ALL.id, tooltip: 'Close All', glyph: 'codicon codicon-close-all' },
    { commandId: NotepadiaPrintCommands.PRINT.id, tooltip: 'Print', glyph: PRINTER_GLYPH },
    { commandId: CommonCommands.CUT.id, tooltip: 'Cut', glyph: 'codicon codicon-screen-cut', separatorBefore: true },
    { commandId: CommonCommands.COPY.id, tooltip: 'Copy', glyph: 'codicon codicon-copy' },
    { commandId: CommonCommands.PASTE.id, tooltip: 'Paste', glyph: 'codicon codicon-clippy' },
    { commandId: CommonCommands.UNDO.id, tooltip: 'Undo', glyph: 'codicon codicon-undo' },
    { commandId: CommonCommands.REDO.id, tooltip: 'Redo', glyph: 'codicon codicon-redo' },
    { commandId: CommonCommands.FIND.id, tooltip: 'Find', glyph: 'codicon codicon-search', separatorBefore: true },
    { commandId: CommonCommands.REPLACE.id, tooltip: 'Replace', glyph: 'codicon codicon-replace' },
    { commandId: 'search-in-workspace.open', tooltip: 'Find in Files', glyph: 'codicon codicon-files' },
    { commandId: NotepadiaCommands.ZOOM_IN.id, tooltip: 'Zoom In', glyph: 'codicon codicon-zoom-in', separatorBefore: true },
    { commandId: NotepadiaCommands.ZOOM_OUT.id, tooltip: 'Zoom Out', glyph: 'codicon codicon-zoom-out' },
    { commandId: NotepadiaCommands.ZOOM_RESET.id, tooltip: 'Reset Zoom', glyph: 'codicon codicon-percentage' },
    { commandId: 'notepadia.view.toggleSyncVerticalScroll', tooltip: 'Sync Vertical Scroll', glyph: 'codicon codicon-arrow-up', separatorBefore: true, toggle: true },
    { commandId: 'notepadia.view.toggleSyncHorizontalScroll', tooltip: 'Sync Horizontal Scroll', glyph: 'codicon codicon-arrow-right', toggle: true },
    { commandId: 'editor.action.toggleWordWrap', tooltip: 'Word Wrap', glyph: 'codicon codicon-word-wrap', separatorBefore: true, toggle: true },
    { commandId: NotepadiaCommands.TOGGLE_WHITESPACE.id, tooltip: 'Show All Characters', glyph: 'codicon codicon-eye', toggle: true },
    { commandId: 'editor.action.showHideIndentGuides', tooltip: 'Indent Guide', glyph: 'codicon codicon-list-selection', toggle: true },
    { commandId: NotepadiaCommands.TOGGLE_DOCUMENT_MAP.id, tooltip: 'Document Map', glyph: 'codicon codicon-map', toggle: true },
    { commandId: 'notepadia.view.toggleFunctionList', tooltip: 'Function List', glyph: 'codicon codicon-symbol-function', toggle: true },
    { commandId: NotepadiaMacroCommands.START.id, tooltip: 'Start Recording', glyph: 'codicon codicon-record', separatorBefore: true, toggle: true },
    { commandId: NotepadiaMacroCommands.STOP.id, tooltip: 'Stop Recording', glyph: 'codicon codicon-debug-stop', toggle: true },
    { commandId: NotepadiaMacroCommands.RUN.id, tooltip: 'Play Macro', glyph: 'codicon codicon-play' }
];

/**
 * A3: the Notepad++ toolbar. A ReactWidget attached to the shell top panel
 * below the menubar; one button per toolbar command, separated into the same
 * groups Notepad++ uses. Accessible as a toolbar with a single tab stop and
 * roving (arrow-key) focus; Escape hands focus back to the editor.
 */
export class NotepadiaToolbarWidget extends ReactWidget {

    /** Roving focus: the button currently holding the single tab stop. */
    protected focusIndex = 0;

    protected readonly saveableSubscriptions: Map<Widget, DisposableCollection> = new Map();

    constructor(
        protected readonly commands: CommandRegistry,
        protected readonly editorManager: EditorManager,
        protected readonly preferenceService: PreferenceService,
        protected readonly shell: ApplicationShell
    ) {
        super();
        this.id = NOTEPADIA_TOOLBAR_ID;
        this.title.label = 'Notepadia Toolbar';
        this.title.caption = 'Notepad++ style toolbar';
        this.title.closable = false;
        this.toDispose.push(
            this.commands.onCommandsChanged(() => this.update()),
            this.commands.onDidExecuteCommand(() => this.update()),
            this.editorManager.onCurrentEditorChanged(() => this.update()),
            this.preferenceService.onPreferenceChanged(event => {
                if (event.preferenceName === NOTEPADIA_TOOLBAR_VISIBLE_PREFERENCE) {
                    this.syncVisibility();
                }
            })
        );
        this.wireDirtyTracking();
    }

    render(): React.ReactNode {
        const children: React.ReactNode[] = [];
        TOOLBAR_ITEMS.forEach((item, index) => {
            if (item.separatorBefore) {
                children.push(React.createElement('span', {
                    key: `separator-${index}`,
                    className: 'notepadia-toolbar-separator',
                    'aria-hidden': true
                }));
            }
            const enabled = this.commands.isEnabled(item.commandId);
            const pressed = item.toggle ? this.commands.isToggled(item.commandId) : false;
            const buttonProps: React.ButtonHTMLAttributes<HTMLButtonElement> & { key: string; 'data-index': number } = {
                key: item.commandId,
                type: 'button',
                className: 'notepadia-toolbar-btn',
                title: item.tooltip,
                'aria-label': item.tooltip,
                tabIndex: this.focusIndex === index ? 0 : -1,
                disabled: !enabled,
                'data-index': index,
                onClick: () => { void this.commands.executeCommand(item.commandId); }
            };
            if (item.toggle) {
                buttonProps['aria-pressed'] = !!pressed;
            }
            const glyph = item.glyph === PRINTER_GLYPH
                ? React.createElement('i', { className: `notepadia-toolbar-glyph ${PRINTER_GLYPH}`, 'aria-hidden': true })
                : React.createElement('i', { className: `notepadia-toolbar-glyph ${item.glyph}`, 'aria-hidden': true });
            children.push(React.createElement('button', buttonProps, glyph));
        });
        return React.createElement('div', {
            role: 'toolbar',
            className: 'notepadia-toolbar-row',
            'aria-label': 'Notepadia toolbar'
        }, ...children);
    }

    /**
     * Hides or shows the toolbar in response to the `notepadia.toolbar.visible`
     * preference (View > Toolbar). Drops the roving focus when hiding so no
     * hidden element keeps the keyboard focus.
     */
    syncVisibility(): void {
        const visible = this.preferenceService.get<boolean>(NOTEPADIA_TOOLBAR_VISIBLE_PREFERENCE, true);
        if (visible) {
            this.show();
        } else {
            if (this.node.contains(document.activeElement)) {
                this.focusEditor();
            }
            this.hide();
        }
    }

    protected onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        this.node.addEventListener('keydown', this.onKeyDown);
        this.node.addEventListener('focusin', this.onFocusIn);
    }

    protected onBeforeDetach(msg: Message): void {
        this.node.removeEventListener('keydown', this.onKeyDown);
        this.node.removeEventListener('focusin', this.onFocusIn);
        super.onBeforeDetach(msg);
    }

    protected onKeyDown = (event: KeyboardEvent): void => {
        switch (event.key) {
            case 'ArrowRight':
                event.preventDefault();
                this.moveFocus(1);
                break;
            case 'ArrowLeft':
                event.preventDefault();
                this.moveFocus(-1);
                break;
            case 'Home':
                event.preventDefault();
                this.moveFocusTo(this.firstEnabledIndex());
                break;
            case 'End':
                event.preventDefault();
                this.moveFocusTo(this.lastEnabledIndex());
                break;
            case 'Escape':
                event.preventDefault();
                event.stopPropagation();
                this.focusEditor();
                break;
        }
    };

    protected onFocusIn = (event: FocusEvent): void => {
        const button = (event.target as HTMLElement).closest<HTMLElement>('.notepadia-toolbar-btn');
        const index = button ? Number(button.dataset.index) : NaN;
        if (this.enabledIndexes().includes(index) && this.focusIndex !== index) {
            this.focusIndex = index;
            this.update();
        }
    };

    /** Moves the roving focus by delta across the enabled buttons (wrapping). */
    protected moveFocus(delta: number): void {
        const enabled = this.enabledIndexes();
        if (enabled.length === 0) {
            return;
        }
        const position = enabled.indexOf(this.focusIndex);
        const next = (position === -1 ? 0 : position) + delta;
        const target = enabled[((next % enabled.length) + enabled.length) % enabled.length];
        this.moveFocusTo(target);
    }

    protected moveFocusTo(index: number): void {
        this.focusIndex = index;
        this.update();
        window.requestAnimationFrame(() => {
            const button = this.node.querySelector<HTMLButtonElement>(`[data-index="${index}"]`);
            button?.focus();
        });
    }

    protected enabledIndexes(): number[] {
        const indexes: number[] = [];
        TOOLBAR_ITEMS.forEach((item, index) => {
            if (this.commands.isEnabled(item.commandId)) {
                indexes.push(index);
            }
        });
        return indexes;
    }

    protected firstEnabledIndex(): number {
        const enabled = this.enabledIndexes();
        return enabled[0] ?? this.focusIndex;
    }

    protected lastEnabledIndex(): number {
        const enabled = this.enabledIndexes();
        return enabled[enabled.length - 1] ?? this.focusIndex;
    }

    protected focusEditor(): void {
        const editor = this.editorManager.currentEditor;
        if (editor) {
            editor.focus();
        }
    }

    /**
     * Save/Save All enable and disable with the dirty state of the open
     * editors, so the toolbar re-renders whenever a Saveable's dirty flag
     * changes (including after typing in a fresh tab).
     */
    protected wireDirtyTracking(): void {
        this.toDispose.push(this.shell.onDidAddWidget(widget => {
            if (NavigatableWidget.is(widget)) {
                this.watchDirty(widget);
            }
        }));
        this.toDispose.push(this.shell.onDidRemoveWidget(widget => {
            if (NavigatableWidget.is(widget)) {
                const subscriptions = this.saveableSubscriptions.get(widget);
                if (subscriptions) {
                    subscriptions.dispose();
                    this.saveableSubscriptions.delete(widget);
                }
            }
        }));
        for (const widget of this.openWidgets()) {
            this.watchDirty(widget);
        }
    }

    protected watchDirty(widget: NavigatableWidget): void {
        if (this.saveableSubscriptions.has(widget)) {
            return;
        }
        const subscriptions = new DisposableCollection();
        const saveable = Saveable.get(widget);
        if (saveable) {
            subscriptions.push(saveable.onDirtyChanged(() => this.update()));
        }
        this.saveableSubscriptions.set(widget, subscriptions);
        this.toDispose.push(subscriptions);
    }

    protected openWidgets(): NavigatableWidget[] {
        const result: NavigatableWidget[] = [];
        for (const widget of this.shell.widgets) {
            if (NavigatableWidget.is(widget)) {
                result.push(widget);
            }
        }
        return result;
    }
}