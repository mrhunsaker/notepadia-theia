import { inject, injectable } from '@theia/core/shared/inversify';
import { FrontendApplication, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { CommandRegistry } from '@theia/core/lib/common/command';
import { PreferenceService } from '@theia/core/lib/common/preferences';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import { NotepadiaToolbarWidget } from './notepadia-toolbar-widget';

/**
 * Owns the Notepad++ toolbar widget: attaches it to the shell top panel,
 * below the menubar, on startup and keeps its visibility in step with the
 * `notepadia.toolbar.visible` preference (View > Toolbar).
 */
@injectable()
export class NotepadiaToolbarContribution implements FrontendApplicationContribution {

    protected toolbar: NotepadiaToolbarWidget | undefined;

    constructor(
        @inject(ApplicationShell) protected readonly shell: ApplicationShell,
        @inject(CommandRegistry) protected readonly commands: CommandRegistry,
        @inject(EditorManager) protected readonly editorManager: EditorManager,
        @inject(PreferenceService) protected readonly preferenceService: PreferenceService
    ) { }

    async onDidInitializeLayout(_app: FrontendApplication): Promise<void> {
        if (this.toolbar) {
            return;
        }
        this.toolbar = new NotepadiaToolbarWidget(
            this.commands,
            this.editorManager,
            this.preferenceService,
            this.shell
        );
        await this.shell.addWidget(this.toolbar, { area: 'top' });
        this.toolbar.syncVisibility();
    }
}