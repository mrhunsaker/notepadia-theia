import { inject, injectable } from '@theia/core/shared/inversify';
import { FrontendApplication, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { BoxLayout, BoxPanel } from '@theia/core/shared/@lumino/widgets';
import { PreferenceService } from '@theia/core/lib/common/preferences';
import { NotepadiaToolbarWidget } from './notepadia-toolbar-widget';
import { NOTEPADIA_TOOLBAR_VISIBLE_PREFERENCE } from './notepadia-shell-contribution';

/** Body class mirroring the toolbar preference, for CSS and for the e2e suite. */
export const NOTEPADIA_TOOLBAR_HIDDEN_CLASS = 'notepadia-toolbar-hidden';

/**
 * The Notepad++ toolbar strip is 26px high. Kept in one place so the size the
 * toolbar reserves in the shell layout cannot drift from the strip's height.
 */
const TOOLBAR_STRIP_HEIGHT = 26;

/**
 * Mounts the Notepad++ toolbar (A3) into the shell's root layout and keeps it
 * in sync with `notepadia.toolbar.visible`.
 *
 * The widget is added in `onDidInitializeLayout` rather than `onStart` on
 * purpose. Theia runs every contribution's `onStart` before the layout is
 * initialised, and `BrowserMenuBarContribution` adds the menu bar during that
 * phase. The toolbar is inserted directly after the shell's top panel in the
 * root vertical box layout, so it always forms its own row below the menu bar.
 * Adding it to the `top` area would put it inside the menu bar's flex row,
 * which is also hidden as a whole by `ElectronMenuContribution` when the
 * native menu bar is used.
 *
 * The command and the preference themselves are owned by
 * `NotepadiaShellContribution` (A2), which already registers
 * `notepadia.view.toggleToolbar` and the `View > Toolbar` menu entry. This
 * contribution only reacts to the preference, so the toggle keeps working from
 * the menu, the settings UI, or a settings.json edited by hand.
 */
@injectable()
export class NotepadiaToolbarContribution implements FrontendApplicationContribution {

    constructor(
        @inject(ApplicationShell) protected readonly shell: ApplicationShell,
        @inject(NotepadiaToolbarWidget) protected readonly toolbar: NotepadiaToolbarWidget,
        @inject(PreferenceService) protected readonly preferenceService: PreferenceService
    ) { }

    async onDidInitializeLayout(_app: FrontendApplication): Promise<void> {
        const layout = this.shell.layout;
        if (layout instanceof BoxLayout) {
            const topPanelIndex = layout.widgets.indexOf(this.shell.topPanel);
            const toolbarIndex = topPanelIndex + 1;
            layout.insertWidget(toolbarIndex, this.toolbar);
            // Lumino's BoxLayout appends a newly attached widget to the parent
            // node instead of inserting it before the widget at `toolbarIndex`.
            // That leaves the visual order right but puts the toolbar last in
            // keyboard/tab order, after the status bar. Move the node to match
            // the layout's widget order.
            const reference = this.shell.node.children[toolbarIndex];
            if (reference && reference !== this.toolbar.node) {
                this.shell.node.insertBefore(this.toolbar.node, reference);
            }
            BoxPanel.setStretch(this.toolbar, 0);
            BoxPanel.setSizeBasis(this.toolbar, TOOLBAR_STRIP_HEIGHT);
        } else {
            // The shell layout is a root BoxLayout in Theia 1.75. Keep a
            // graceful fallback for a future shell implementation rather than
            // losing the toolbar entirely.
            await this.shell.addWidget(this.toolbar, { area: 'top' });
        }

        await this.preferenceService.ready;
        this.applyVisibility();

        this.preferenceService.onPreferenceChanged(event => {
            if (event.preferenceName === NOTEPADIA_TOOLBAR_VISIBLE_PREFERENCE) {
                this.applyVisibility();
            }
        });
    }

    protected applyVisibility(): void {
        const visible = this.preferenceService.get<boolean>(NOTEPADIA_TOOLBAR_VISIBLE_PREFERENCE, true);
        this.toolbar.setHidden(!visible);
        document.body.classList.toggle(NOTEPADIA_TOOLBAR_HIDDEN_CLASS, !visible);
        // Hiding a root-layout child changes the space available to the editor,
        // and the editor below it will not resize on its own.
        this.shell.update();
    }
}
