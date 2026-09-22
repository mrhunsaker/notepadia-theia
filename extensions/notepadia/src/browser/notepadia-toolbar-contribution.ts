import { inject, injectable } from '@theia/core/shared/inversify';
import { FrontendApplication, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { BoxPanel } from '@theia/core/shared/@lumino/widgets';
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
 * Mounts the Notepad++ toolbar (A3) into the shell's top area and keeps it in
 * sync with `notepadia.toolbar.visible`.
 *
 * The widget is added in `onDidInitializeLayout` rather than `onStart` on
 * purpose. Theia runs every contribution's `onStart` before the layout is
 * initialised, and `BrowserMenuBarContribution` adds the menu bar during that
 * phase. Theia 1.75 lays the top area out as a flex *row*, so a second widget
 * would otherwise sit beside the menu bar; the wrapping rules in
 * `style/notepadia-toolbar.css` (`#theia-top-panel { flex-wrap: wrap }`, the
 * toolbar at `flex: 0 0 100%`) turn it into its own strip below the menu bar.
 *
 * Lumino hard-sizes the top panel to its fit minimum (the menu bar row), so
 * no CSS can grow it enough for a second row. The contribution instead raises
 * the panel's box-layout size basis — the value the shell layout uses for the
 * panel's height — by exactly one toolbar strip, and lowers it again when the
 * toolbar is hidden. Without this the editor area would sit directly under
 * the menu bar and cover the toolbar.
 *
 * The command and the preference themselves are owned by
 * `NotepadiaShellContribution` (A2), which already registers
 * `notepadia.view.toggleToolbar` and the `View > Toolbar` menu entry. This
 * contribution only reacts to the preference, so the toggle keeps working from
 * the menu, the settings UI, or a settings.json edited by hand.
 */
@injectable()
export class NotepadiaToolbarContribution implements FrontendApplicationContribution {

    /** The top panel's height before the toolbar strip is added. */
    protected baseTopPanelHeight = TOOLBAR_STRIP_HEIGHT;

    constructor(
        @inject(ApplicationShell) protected readonly shell: ApplicationShell,
        @inject(NotepadiaToolbarWidget) protected readonly toolbar: NotepadiaToolbarWidget,
        @inject(PreferenceService) protected readonly preferenceService: PreferenceService
    ) { }

    async onDidInitializeLayout(_app: FrontendApplication): Promise<void> {
        await this.shell.addWidget(this.toolbar, { area: 'top' });

        // The menu bar is added during `onStart`, so the panel should already
        // be measured. Guard against a pre-layout zero just in case.
        this.baseTopPanelHeight = this.shell.topPanel.node.offsetHeight || TOOLBAR_STRIP_HEIGHT;

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
        BoxPanel.setSizeBasis(this.shell.topPanel, this.baseTopPanelHeight + (visible ? TOOLBAR_STRIP_HEIGHT : 0));
        // Hiding a child of the top panel changes the panel's height, and the
        // editor below it will not resize on its own.
        this.shell.update();
    }
}
