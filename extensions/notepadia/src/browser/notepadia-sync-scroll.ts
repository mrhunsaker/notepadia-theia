import { inject, injectable } from '@theia/core/shared/inversify';
import * as monaco from '@theia/monaco-editor-core';
import { Command, CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import { MenuContribution, MenuModelRegistry } from '@theia/core/lib/common/menu';
import { CommonMenus } from '@theia/core/lib/browser/common-menus';
import {
    ApplicationShell,
    FrontendApplication,
    FrontendApplicationContribution
} from '@theia/core/lib/browser';
import { DisposableCollection } from '@theia/core/lib/common/disposable';
import { EditorWidget } from '@theia/editor/lib/browser/editor-widget';
import { PreferenceService } from '@theia/core/lib/common/preferences';
import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';
import { resolveMirrorLeft, resolveMirrorTop } from '../common/sync-scroll';

/**
 * `View > Synchronize Vertical/Horizontal Scrolling` (C3 step 4).
 *
 * Notepad++'s signature split-view feature, and one with no Theia or Monaco
 * equivalent at all: it is a relationship *between* two editors rather than a
 * setting on either one.
 *
 * Both toggles start off. Mirroring scroll position by default would make a
 * freshly opened split feel broken, which is the opposite of what the setting
 * is for, and Notepad++ does not do it either.
 *
 * The mapping itself lives in common/sync-scroll.ts so it can be unit tested;
 * this file is the event wiring.
 */

export const NOTEPADIA_SYNC_VERTICAL_PREFERENCE = 'notepadia.view.syncVerticalScroll';
export const NOTEPADIA_SYNC_HORIZONTAL_PREFERENCE = 'notepadia.view.syncHorizontalScroll';

export namespace NotepadiaSyncScrollCommands {
    export const SYNC_VERTICAL: Command = {
        id: 'notepadia.view.syncVerticalScroll',
        label: 'Synchronize Vertical Scrolling'
    };
    export const SYNC_HORIZONTAL: Command = {
        id: 'notepadia.view.syncHorizontalScroll',
        label: 'Synchronize Horizontal Scrolling'
    };
}

@injectable()
export class NotepadiaSyncScrollContribution implements
    CommandContribution, MenuContribution, FrontendApplicationContribution {

    protected readonly toDispose = new DisposableCollection();

    /** Scroll listener of each pane, by widget id, disposed with the pane. */
    protected readonly scrollListeners = new Map<string, DisposableCollection>();

    /**
     * The re-entrancy guard.
     *
     * Scrolling one pane writes the other's scroll offset, which fires that
     * pane's own `onDidScrollChange`. Without this flag that second event would
     * be mirrored straight back and the two panes would push each other forever.
     *
     * It is cleared on the next animation frame rather than straight after the
     * write, because the write and the event it provokes are not the same tick.
     */
    protected mirroring = false;

    constructor(
        @inject(ApplicationShell) protected readonly shell: ApplicationShell,
        @inject(PreferenceService) protected readonly preferenceService: PreferenceService
    ) { }

    onStart(_app: FrontendApplication): void {
        this.observePanes();
        this.toDispose.push(this.shell.onDidAddWidget(() => this.observePanes()));
        this.toDispose.push(this.shell.onDidRemoveWidget(widget => this.forget(widget)));
    }

    /**
     * Subscribe to the scroll events of every editor pane, and drop the
     * subscriptions of panes that have closed.
     *
     * Panes are tracked by widget id so re-running this after a pane opens,
     * closes or is revealed cannot stack up duplicate listeners, which would
     * make one scroll write to the other pane several times over.
     */
    protected observePanes(): void {
        const live = new Set<string>();
        for (const widget of this.panes()) {
            const editor = MonacoEditor.get(widget);
            if (!editor) {
                continue;
            }
            live.add(widget.id);
            if (this.scrollListeners.has(widget.id)) {
                continue;
            }
            const control = editor.getControl();
            const listeners = new DisposableCollection();
            listeners.push(control.onDidScrollChange(() => this.mirror(widget.id, control)));
            this.scrollListeners.set(widget.id, listeners);
        }
        for (const widget of this.panes()) {
            if (!live.has(widget.id) && this.scrollListeners.has(widget.id)) {
                this.forget(widget);
            }
        }
    }

    /** Release a closed pane's listener so it cannot keep being written to. */
    protected forget(widget: { id: string }): void {
        const listeners = this.scrollListeners.get(widget.id);
        if (listeners) {
            listeners.dispose();
            this.scrollListeners.delete(widget.id);
        }
    }

    /**
     * Mirror one pane's scroll onto the other.
     *
     * Only two panes exist (C3's constraint), so "the other" is unambiguous:
     * the single remaining editor that is not the one that scrolled. With any
     * other number there is no agreed "other", so nothing is mirrored.
     */
    protected mirror(sourceId: string, source: monaco.editor.IStandaloneCodeEditor): void {
        if (this.mirroring) {
            return;
        }
        const vertical = this.preference(NOTEPADIA_SYNC_VERTICAL_PREFERENCE);
        const horizontal = this.preference(NOTEPADIA_SYNC_HORIZONTAL_PREFERENCE);
        if (!vertical && !horizontal) {
            return;
        }
        const target = this.otherPane(sourceId);
        if (!target) {
            return;
        }
        const sourceInfo = source.getLayoutInfo();
        const targetInfo = target.getLayoutInfo();

        let wrote = false;
        this.mirroring = true;
        try {
            if (vertical) {
                const result = resolveMirrorTop({
                    enabled: true,
                    sourceScrollTop: source.getScrollTop(),
                    targetScrollTop: target.getScrollTop(),
                    sourceTotalHeight: source.getScrollHeight(),
                    sourceViewportHeight: sourceInfo.height,
                    targetTotalHeight: target.getScrollHeight(),
                    targetViewportHeight: targetInfo.height
                });
                if (result.apply) {
                    target.setScrollTop(result.scrollTop);
                    wrote = true;
                }
            }
            if (horizontal) {
                const result = resolveMirrorLeft({
                    enabled: true,
                    sourceScrollLeft: source.getScrollLeft(),
                    targetScrollLeft: target.getScrollLeft(),
                    sourceScrollWidth: source.getScrollWidth(),
                    sourceViewportWidth: sourceInfo.width,
                    targetScrollWidth: target.getScrollWidth(),
                    targetViewportWidth: targetInfo.width
                });
                if (result.apply) {
                    target.setScrollLeft(result.scrollLeft);
                    wrote = true;
                }
            }
        } finally {
            if (!wrote) {
                this.mirroring = false;
            }
        }
        if (wrote) {
            window.requestAnimationFrame(() => {
                this.mirroring = false;
            });
        }
    }

    /**
     * The editor panes currently on screen, one per pane.
     *
     * Tabs stacked behind the current one are excluded: `shell.widgets` lists
     * every editor the shell knows about, and mirroring into the scroll offset
     * of a pane nobody is looking at would be both wrong and needless work.
     * `Widget.isVisible` is Lumino's `Flag.IsVisible`, cleared whenever a widget
     * is hidden, so it is the "a pane is showing this editor" test.
     *
     * `shell.widgets` is typed as `Widget[]` while `MonacoEditor.get` wants the
     * narrower `EditorWidget`; the cast is safe because `get` only reads
     * `.editor` off the argument.
     */
    protected panes(): EditorWidget[] {
        const panes: EditorWidget[] = [];
        for (const widget of this.shell.widgets) {
            if (widget.isVisible && MonacoEditor.get(widget as EditorWidget)) {
                panes.push(widget as EditorWidget);
            }
        }
        return panes;
    }

    /** The editor pane that is not the one given, when there is exactly one. */
    protected otherPane(sourceId: string): monaco.editor.IStandaloneCodeEditor | undefined {
        const others = this.panes().filter(pane => pane.id !== sourceId);
        return others.length === 1 ? MonacoEditor.get(others[0])?.getControl() : undefined;
    }

    /** Editor panes currently on screen. */
    protected paneCount(): number {
        return this.panes().length;
    }

    protected preference(name: string): boolean {
        return this.preferenceService.get<boolean>(name, false);
    }

    protected toggle(name: string): void {
        this.preferenceService.set(name, !this.preference(name)).catch(() => { });
    }

    registerCommands(commands: CommandRegistry): void {
        // Both are only meaningful once there is a second pane to scroll with.
        commands.registerCommand(NotepadiaSyncScrollCommands.SYNC_VERTICAL, {
            isEnabled: () => this.paneCount() === 2,
            isToggled: () => this.preference(NOTEPADIA_SYNC_VERTICAL_PREFERENCE),
            execute: () => this.toggle(NOTEPADIA_SYNC_VERTICAL_PREFERENCE)
        });
        commands.registerCommand(NotepadiaSyncScrollCommands.SYNC_HORIZONTAL, {
            isEnabled: () => this.paneCount() === 2,
            isToggled: () => this.preference(NOTEPADIA_SYNC_HORIZONTAL_PREFERENCE),
            execute: () => this.toggle(NOTEPADIA_SYNC_HORIZONTAL_PREFERENCE)
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        const sync = [...CommonMenus.VIEW, '5_notepadia-sync-scroll'];
        menus.registerSubmenu(sync, 'Synchronize Scrolling');
        menus.registerMenuAction(sync, {
            commandId: NotepadiaSyncScrollCommands.SYNC_VERTICAL.id,
            order: 'a'
        });
        menus.registerMenuAction(sync, {
            commandId: NotepadiaSyncScrollCommands.SYNC_HORIZONTAL.id,
            order: 'b'
        });
    }
}