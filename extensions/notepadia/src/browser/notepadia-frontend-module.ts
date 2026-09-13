import { ContainerModule } from '@theia/core/shared/inversify';
import {
    CommandContribution,
    MenuContribution
} from '@theia/core/lib/common';
import {
    FrontendApplicationContribution,
    KeybindingContribution
} from '@theia/core/lib/browser';

import { NotepadiaContribution } from './notepadia-contribution';
import { NotepadiaDropContribution } from './notepadia-drop-contribution';
import { NotepadiaEditorKeybindingContribution } from './notepadia-editor-keybinding-contribution';
import { NotepadiaEncodingContribution } from './notepadia-encoding-contribution';
import { NotepadiaEolContribution } from './notepadia-eol-contribution';
import { NotepadiaBookmarkContribution } from './notepadia-bookmark-contribution';
import { NotepadiaKeybindingContribution } from './notepadia-keybinding-contribution';
import { NotepadiaRecentFilesContribution } from './notepadia-recent-files-contribution';
import { NotepadiaMenuContribution } from './notepadia-menu-contribution';
import { NotepadiaStatusBarContribution } from './notepadia-status-bar-contribution';

export default new ContainerModule((bind) => {
    bind(NotepadiaContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(NotepadiaContribution);

    bind(NotepadiaEncodingContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(NotepadiaEncodingContribution);
    bind(MenuContribution).toService(NotepadiaEncodingContribution);

    bind(NotepadiaEolContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(NotepadiaEolContribution);
    bind(MenuContribution).toService(NotepadiaEolContribution);

    bind(NotepadiaRecentFilesContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(NotepadiaRecentFilesContribution);

    bind(NotepadiaBookmarkContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(NotepadiaBookmarkContribution);
    bind(MenuContribution).toService(NotepadiaBookmarkContribution);
    bind(KeybindingContribution).toService(NotepadiaBookmarkContribution);
    bind(FrontendApplicationContribution).toService(NotepadiaBookmarkContribution);

    bind(NotepadiaDropContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(NotepadiaDropContribution);

    bind(NotepadiaMenuContribution).toSelf().inSingletonScope();
    bind(MenuContribution).toService(NotepadiaMenuContribution);

    bind(NotepadiaKeybindingContribution).toSelf().inSingletonScope();
    bind(KeybindingContribution).toService(NotepadiaKeybindingContribution);

    bind(NotepadiaEditorKeybindingContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(NotepadiaEditorKeybindingContribution);

    bind(NotepadiaStatusBarContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(NotepadiaStatusBarContribution);
});
