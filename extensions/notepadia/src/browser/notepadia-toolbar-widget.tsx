import * as React from '@theia/core/shared/react';
import { inject, injectable } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { KeybindingRegistry } from '@theia/core/lib/browser/keybinding';
import { CommandRegistry } from '@theia/core/lib/common/command';
import { PreferenceService } from '@theia/core/lib/common/preferences';
import { Disposable } from '@theia/core/lib/common/disposable';
import { toolbarIcon } from './icons/notepadia-toolbar-icons';
import {
    NOTEPADIA_TOOLBAR_ITEMS,
    NotepadiaToolbarButton,
    NotepadiaToolbarItem,
    isToolbarButton,
    nextFocusIndex,
    toolbarButtons
} from './notepadia-toolbar-items';

interface ButtonState {
    readonly enabled: boolean;
    readonly toggled: boolean;
}

/**
 * The Notepad++ toolbar (A3).
 *
 * Every button is a thin shell over a registered command: the click handler
 * calls `CommandRegistry.executeCommand`, and the enabled/toggled rendering
 * comes from that same command's `isEnabled`/`isToggled` handlers. Nothing here
 * re-implements editor behaviour, so a toolbar button and its menu entry can
 * never drift apart.
 *
 * Accessibility follows the ARIA toolbar pattern: one `role="toolbar"`
 * container, a single tab stop, and Left/Right/Home/End to move between
 * buttons. Disabled buttons use `aria-disabled` rather than the `disabled`
 * attribute so they stay reachable and discoverable by keyboard and screen
 * reader users — a `disabled` button is removed from the tab sequence entirely
 * and silently vanishes from the user's mental model of the toolbar.
 */
@injectable()
export class NotepadiaToolbarWidget extends ReactWidget {

    static readonly ID = 'notepadia-toolbar';

    /**
     * `isEnabled` for commands like Undo, Cut and Paste depends on editor and
     * selection state that fires no application-level event, so events alone
     * leave buttons visibly stale. The poll recomputes the state signature and
     * only re-renders when it actually changed, which keeps the cost to ~30
     * cheap predicate calls per tick and zero React work at rest.
     */
    protected static readonly REFRESH_INTERVAL_MS = 300;

    protected readonly items: readonly NotepadiaToolbarItem[] = NOTEPADIA_TOOLBAR_ITEMS;
    protected readonly buttons: readonly NotepadiaToolbarButton[] = toolbarButtons(NOTEPADIA_TOOLBAR_ITEMS);

    protected state = new Map<string, ButtonState>();
    protected stateSignature = '';
    /** Index into `buttons` holding the toolbar's single tab stop. */
    protected focusIndex = 0;

    // Constructor injection rather than `@inject` properties: this extension
    // compiles with full `strict`, so `strictPropertyInitialization` would
    // reject injected fields that have no initializer.
    constructor(
        @inject(CommandRegistry) protected readonly commandRegistry: CommandRegistry,
        @inject(KeybindingRegistry) protected readonly keybindings: KeybindingRegistry,
        @inject(ApplicationShell) protected readonly shell: ApplicationShell,
        @inject(PreferenceService) protected readonly preferences: PreferenceService
    ) {
        super();
        this.id = NotepadiaToolbarWidget.ID;
        this.addClass('notepadia-toolbar');
        this.title.label = 'Toolbar';
        this.title.caption = 'Notepadia toolbar';
        this.title.closable = false;
        // A top-area widget is laid out by Lumino from its node height; the
        // scrollbars ReactWidget installs by default would fight that.
        this.scrollOptions = undefined;

        this.toDispose.push(this.commandRegistry.onCommandsChanged(() => this.refresh()));
        this.toDispose.push(this.shell.onDidChangeActiveWidget(() => this.refresh()));
        this.toDispose.push(this.shell.onDidChangeCurrentWidget(() => this.refresh()));

        this.refresh(true);
    }

    protected override onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        const timer = window.setInterval(() => this.refresh(), NotepadiaToolbarWidget.REFRESH_INTERVAL_MS);
        this.toDisposeOnDetach.push(Disposable.create(() => window.clearInterval(timer)));
        this.refresh(true);
    }

    protected override onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        this.focusButton(this.focusIndex);
    }

    /**
     * Recomputes every button's enabled/toggled state and re-renders only when
     * the result differs from what is currently on screen.
     */
    protected refresh(force = false): void {
        const next = new Map<string, ButtonState>();
        const parts: string[] = [];
        for (const button of this.buttons) {
            const enabled = this.commandRegistry.isEnabled(button.commandId);
            const toggled = button.toggle === true && this.isToggled(button);
            next.set(button.id, { enabled, toggled });
            parts.push(`${button.id}:${enabled ? 1 : 0}${toggled ? 1 : 0}`);
        }
        const signature = parts.join('|');
        if (!force && signature === this.stateSignature) {
            return;
        }
        this.state = next;
        this.stateSignature = signature;
        this.update();
    }

    /**
     * Theia's own handler for `editor.action.toggleWordWrap` flips the
     * `editor.wordWrap` preference but ships without an `isToggled`, so the
     * command registry can never report `aria-pressed` for it. Mirror the
     * command's own toggle semantics here: word wrap is "on" whenever the
     * preference is anything other than `off`. Every other toggle reads its
     * state straight from the registry.
     */
    protected isToggled(button: NotepadiaToolbarButton): boolean {
        if (button.commandId === 'editor.action.toggleWordWrap') {
            return this.preferences.get<string>('editor.wordWrap') !== 'off';
        }
        return this.commandRegistry.isToggled(button.commandId);
    }

    protected stateFor(button: NotepadiaToolbarButton): ButtonState {
        return this.state.get(button.id) ?? { enabled: false, toggled: false };
    }

    /** "Save (Ctrl+S)" when a keybinding exists, otherwise just the label. */
    protected tooltipFor(button: NotepadiaToolbarButton): string {
        const [binding] = this.keybindings.getKeybindingsForCommand(button.commandId);
        if (!binding) {
            return button.label;
        }
        const accelerator = this.keybindings.acceleratorFor(binding, '+').join(', ');
        return accelerator ? `${button.label} (${accelerator})` : button.label;
    }

    protected execute(button: NotepadiaToolbarButton): void {
        if (!this.stateFor(button).enabled) {
            return;
        }
        this.commandRegistry.executeCommand(button.commandId)
            // A failing command is the command's problem to report; the toolbar
            // must not surface an unhandled rejection for it.
            .catch(() => { /* no-op */ })
            .then(() => this.refresh());
    }

    /** Moves the single tab stop and puts DOM focus on the new button. */
    protected focusButton(index: number): void {
        const count = this.buttons.length;
        if (count === 0) {
            return;
        }
        const clamped = Math.min(Math.max(index, 0), count - 1);
        const changed = clamped !== this.focusIndex;
        this.focusIndex = clamped;
        if (changed) {
            this.update();
        }
        // React 18+ renders asynchronously, so the node for the new tab stop
        // may not exist yet on this frame.
        window.requestAnimationFrame(() => {
            const target = this.node.querySelector<HTMLElement>(`[data-toolbar-index="${clamped}"]`);
            target?.focus();
        });
    }

    protected handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
        let delta: number | undefined;
        switch (event.key) {
            case 'ArrowRight': delta = 1; break;
            case 'ArrowLeft': delta = -1; break;
            case 'Home':
                event.preventDefault();
                this.focusButton(0);
                return;
            case 'End':
                event.preventDefault();
                this.focusButton(this.buttons.length - 1);
                return;
            default:
                return;
        }
        event.preventDefault();
        this.focusButton(nextFocusIndex(this.focusIndex, delta, this.buttons.length));
    };

    protected renderButton(button: NotepadiaToolbarButton, index: number): React.ReactNode {
        const { enabled, toggled } = this.stateFor(button);
        const classes = ['notepadia-toolbar-button'];
        if (toggled) {
            classes.push('notepadia-toolbar-button-toggled');
        }
        if (!enabled) {
            classes.push('notepadia-toolbar-button-disabled');
        }
        return (
            <button
                key={button.id}
                type="button"
                id={`notepadia-toolbar-${button.id}`}
                className={classes.join(' ')}
                data-toolbar-index={index}
                data-toolbar-id={button.id}
                data-command-id={button.commandId}
                title={this.tooltipFor(button)}
                aria-label={button.label}
                aria-disabled={enabled ? undefined : true}
                aria-pressed={button.toggle ? toggled : undefined}
                tabIndex={index === this.focusIndex ? 0 : -1}
                onClick={() => this.execute(button)}
                onFocus={() => { this.focusIndex = index; }}
            >
                {toolbarIcon(button.icon)}
            </button>
        );
    }

    protected render(): React.ReactNode {
        let buttonIndex = -1;
        return (
            <div
                className="notepadia-toolbar-container"
                role="toolbar"
                aria-label="Notepadia toolbar"
                aria-orientation="horizontal"
                onKeyDown={this.handleKeyDown}
            >
                {this.items.map(item => {
                    if (!isToolbarButton(item)) {
                        return <span key={item.id} className="notepadia-toolbar-separator" role="separator" aria-orientation="vertical" />;
                    }
                    buttonIndex += 1;
                    return this.renderButton(item, buttonIndex);
                })}
            </div>
        );
    }
}
