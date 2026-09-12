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
import { NotepadiaKeybindingContribution } from './notepadia-keybinding-contribution';
import { NotepadiaMenuContribution } from './notepadia-menu-contribution';
import { NotepadiaStatusBarContribution } from './notepadia-status-bar-contribution';

export default new ContainerModule((bind) => {
    bind(NotepadiaContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(NotepadiaContribution);

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
