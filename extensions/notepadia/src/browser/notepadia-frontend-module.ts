import { ContainerModule } from '@theia/core/shared/inversify';
import {
    CommandContribution,
    MenuContribution
} from '@theia/core/lib/common';
import {
    FrontendApplicationContribution,
    KeybindingContribution,
    WidgetFactory
} from '@theia/core/lib/browser';

import { NotepadiaContribution } from './notepadia-contribution';
import { NotepadiaDropContribution } from './notepadia-drop-contribution';
import { NotepadiaEditorKeybindingContribution } from './notepadia-editor-keybinding-contribution';
import { NotepadiaEncodingContribution } from './notepadia-encoding-contribution';
import { NotepadiaEolContribution } from './notepadia-eol-contribution';
import { NotepadiaBookmarkContribution } from './notepadia-bookmark-contribution';
import { NotepadiaKeybindingContribution } from './notepadia-keybinding-contribution';
import { NotepadiaLanguageContribution } from './notepadia-language-contribution';
import { NotepadiaRecentFilesContribution } from './notepadia-recent-files-contribution';
import { NotepadiaMenuContribution } from './notepadia-menu-contribution';
import { NotepadiaStatusBarContribution } from './notepadia-status-bar-contribution';
import { NotepadiaDocumentListWidget } from './notepadia-document-list-widget';
import { NotepadiaDocumentListContribution } from './notepadia-document-list-contribution';

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

    bind(NotepadiaLanguageContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(NotepadiaLanguageContribution);
    bind(MenuContribution).toService(NotepadiaLanguageContribution);
    bind(FrontendApplicationContribution).toService(NotepadiaLanguageContribution);

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

    bind(NotepadiaDocumentListWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: NotepadiaDocumentListWidget.ID,
        createWidget: () => ctx.container.get(NotepadiaDocumentListWidget)
    }));

    bind(NotepadiaDocumentListContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(NotepadiaDocumentListContribution);
    bind(MenuContribution).toService(NotepadiaDocumentListContribution);
});
