import { inject, injectable } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution, Saveable, Title, Widget } from '@theia/core/lib/browser';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { TabBarDecorator } from '@theia/core/lib/browser/shell/tab-bar-decorator';
import { WidgetDecoration } from '@theia/core/lib/browser/widget-decoration';
import { Emitter, Event } from '@theia/core/lib/common/event';
import { Disposable } from '@theia/core/lib/common/disposable';
import * as monaco from '@theia/monaco-editor-core';
import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import { EditorWidget } from '@theia/editor/lib/browser/editor-widget';

/**
 * Notepad++ tab state icons (A4): a blue floppy for a clean file, a red floppy
 * for a modified file, and a padlock for a read-only file.
 *
 * The tab-bar renderer honours only `badge`/`tailDecorations`/`iconOverlay`
 * decoration data and has no per-tab CSS class mechanism, so the decoration
 * data is deliberately empty and the classes are maintained directly on the
 * `.lm-TabBar-tab` DOM nodes. `style/notepadia-shell.css` paints the matching
 * floppy/lock artwork onto those classes.
 */
export const NOTEPADIA_TAB_SAVED_CLASS = 'notepadia-tab-saved';
export const NOTEPADIA_TAB_DIRTY_CLASS = 'notepadia-tab-dirty';
export const NOTEPADIA_TAB_READONLY_CLASS = 'notepadia-tab-readonly';
export const NOTEPADIA_TAB_STATE_CLASSES = [
    NOTEPADIA_TAB_SAVED_CLASS,
    NOTEPADIA_TAB_DIRTY_CLASS,
    NOTEPADIA_TAB_READONLY_CLASS
];

/**
 * Prefix of the `<li>` id emitted by the tab renderer: `shell-tab-<widgetId>`.
 * Split off by both the decorator and the shell contribution's middle-click
 * close handler.
 */
export const NOTEPADIA_TAB_ID_PREFIX = 'shell-tab-';

@injectable()
export class NotepadiaTabDecorator implements TabBarDecorator, FrontendApplicationContribution {

    readonly id = 'notepadia-tab-decorator';

    protected readonly onDidChangeDecorationsEmitter = new Emitter<void>();
    readonly onDidChangeDecorations: Event<void> = this.onDidChangeDecorationsEmitter.event;

    /** Dirty-state listeners keyed by widget id, disposed when the widget is removed. */
    protected readonly dirtyListeners = new Map<string, Disposable>();
    /** Read-only config listeners keyed by editor id. */
    protected readonly readOnlyListeners = new Map<string, Disposable>();

    protected tabBarObserver: MutationObserver | undefined;
    protected syncQueued = false;

    constructor(
        @inject(ApplicationShell) protected readonly shell: ApplicationShell,
        @inject(EditorManager) protected readonly editorManager: EditorManager
    ) { }

    decorate(_title: Title<Widget>): WidgetDecoration.Data[] {
        // See the class comment: the renderer cannot express a per-tab CSS class,
        // so the state classes are painted directly onto the tab element in sync().
        return [];
    }

    async onStart(): Promise<void> {
        for (const widget of this.shell.widgets) {
            this.trackWidget(widget);
        }
        this.shell.onDidAddWidget(widget => this.trackWidget(widget));
        this.shell.onDidRemoveWidget(widget => {
            this.disposeListeners(widget.id);
        });
        this.editorManager.onCreated(editor => this.trackEditor(editor));
        // Lumino re-renders a tab bar by swapping the `.lm-TabBar-tab` nodes in
        // its `.lm-TabBar-content` list, and active/inactive switches come back
        // as `class` attribute changes on the tab elements. Neither notifies our
        // decoration service, so a MutationObserver repaints the classes.
        this.tabBarObserver = this.observeTabBars();
        // Existing tabs are already in the DOM; paint their initial state.
        this.notify();
    }

    protected trackWidget(widget: Widget): void {
        if (this.dirtyListeners.has(widget.id)) {
            return;
        }
        const saveable = Saveable.get(widget);
        if (saveable) {
            this.dirtyListeners.set(widget.id, saveable.onDirtyChanged(() => this.notify()));
        }
    }

    protected trackEditor(editor: EditorWidget): void {
        const control = MonacoEditor.get(editor)?.getControl();
        if (!control) {
            return;
        }
        this.readOnlyListeners.set(editor.id, control.onDidChangeConfiguration(event => {
            if (event.hasChanged(monaco.editor.EditorOption.readOnly)) {
                this.notify();
            }
        }));
    }

    protected disposeListeners(widgetId: string): void {
        const dirtyListener = this.dirtyListeners.get(widgetId);
        if (dirtyListener) {
            dirtyListener.dispose();
            this.dirtyListeners.delete(widgetId);
        }
        const readOnlyListener = this.readOnlyListeners.get(widgetId);
        if (readOnlyListener) {
            readOnlyListener.dispose();
            this.readOnlyListeners.delete(widgetId);
        }
    }

    protected notify(): void {
        this.onDidChangeDecorationsEmitter.fire();
        this.scheduleSync();
    }

    protected scheduleSync(): void {
        if (this.syncQueued) {
            return;
        }
        this.syncQueued = true;
        requestAnimationFrame(() => {
            this.syncQueued = false;
            this.sync();
        });
    }

    protected sync(): void {
        const tabs = Array.from(this.shell.node.querySelectorAll<HTMLElement>('.lm-TabBar .lm-TabBar-tab'));
        for (const tab of tabs) {
            const widget = this.findWidgetForTab(tab);
            this.applyStateClasses(tab, widget);
        }
        // Flush class mutations we caused so they do not retrigger a sync.
        this.tabBarObserver?.takeRecords();
    }

    protected findWidgetForTab(tab: HTMLElement): Widget | undefined {
        const tabId = tab.id || '';
        if (!tabId.startsWith(NOTEPADIA_TAB_ID_PREFIX)) {
            return undefined;
        }
        // Hidden bars emit `shell-tab-<widgetId>-hidden`; those resolve to no widget.
        return this.shell.getWidgetById(tabId.slice(NOTEPADIA_TAB_ID_PREFIX.length));
    }

    protected stateClasses(widget: Widget | undefined): string[] {
        if (!(widget instanceof EditorWidget)) {
            return [];
        }
        // Read-only wins over the floppy state: a read-only file is never writable,
        // so Notepad++ shows the padlock in place of any dirty/saved marker.
        if (this.isReadOnly(widget)) {
            return [NOTEPADIA_TAB_READONLY_CLASS];
        }
        return Saveable.isDirty(widget) ? [NOTEPADIA_TAB_DIRTY_CLASS] : [NOTEPADIA_TAB_SAVED_CLASS];
    }

    protected isReadOnly(widget: EditorWidget): boolean {
        return MonacoEditor.get(widget)?.getControl().getOption(monaco.editor.EditorOption.readOnly) ?? false;
    }

    protected applyStateClasses(tab: HTMLElement, widget: Widget | undefined): void {
        const expected = new Set(this.stateClasses(widget));
        const actual = new Set(NOTEPADIA_TAB_STATE_CLASSES.filter(c => tab.classList.contains(c)));
        const toRemove = [...actual].filter(c => !expected.has(c));
        const toAdd = [...expected].filter(c => !actual.has(c));
        if (toRemove.length) {
            tab.classList.remove(...toRemove);
        }
        if (toAdd.length) {
            tab.classList.add(...toAdd);
        }
    }

    protected observeTabBars(): MutationObserver {
        const observer = new MutationObserver(mutations => {
            const relevant = mutations.some(mutation => {
                const target = mutation.target as Node | null;
                if (!target || !(target instanceof Element)) {
                    return false;
                }
                return Boolean(target.closest('.lm-TabBar-content'));
            });
            if (relevant) {
                this.scheduleSync();
            }
        });
        // Observing `document.body` covers every tab bar (main area and side
        // panels) without tracking re-renders of individual tab bars.
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });
        return observer;
    }
}