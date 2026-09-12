import { inject, injectable } from '@theia/core/shared/inversify';
import { CommandRegistry, MessageService } from '@theia/core/lib/common';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';

/**
 * Handles OS-level file drops onto the browser window.
 *
 * The Theia browser application does not open OS-dropped files by itself. To
 * avoid silently swallowing a drop, we intercept drops that no other component
 * handled (event.defaultPrevented is false) and offer the built-in
 * "Upload Files..." flow, which copies the files into the workspace where they
 * can be opened like any other file. Drops targeting the file tree keep their
 * own native handling.
 */
@injectable()
export class NotepadiaDropContribution implements FrontendApplicationContribution {

    constructor(
        @inject(CommandRegistry) protected readonly commands: CommandRegistry,
        @inject(MessageService) protected readonly messageService: MessageService
    ) { }

    onStart(): void {
        window.addEventListener('drop', event => {
            if (event.defaultPrevented) {
                return;
            }
            const files = event.dataTransfer?.files;
            if (!files || files.length === 0) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            void this.messageService.info(
                'Dropped files cannot be opened directly. Copy them into the workspace to open them here.',
                'Upload Files...'
            ).then(choice => {
                if (choice) {
                    void this.commands.executeCommand('file.upload');
                }
            });
        }, true);
    }
}