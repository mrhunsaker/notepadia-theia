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
import { ElectronIpcConnectionProvider, ElectronMainConnectionProvider } from '@theia/core/lib/electron-browser/messaging/electron-ipc-connection-source';

import { NotepadiaContribution } from './notepadia-contribution';
import { NotepadiaUntitledResourceResolver } from './notepadia-untitled-resource-resolver';
import { NotepadiaDropContribution } from './notepadia-drop-contribution';
import { NotepadiaEditorKeybindingContribution } from './notepadia-editor-keybinding-contribution';
import { NotepadiaEncodingContribution } from './notepadia-encoding-contribution';
import { NotepadiaEolContribution } from './notepadia-eol-contribution';
import { NotepadiaOvertypeContribution } from './notepadia-overtype-contribution';
import { NotepadiaBookmarkContribution } from './notepadia-bookmark-contribution';
import { NotepadiaKeybindingContribution } from './notepadia-keybinding-contribution';
import { NotepadiaLanguageContribution } from './notepadia-language-contribution';
import { NotepadiaRecentFilesContribution } from './notepadia-recent-files-contribution';
import { NotepadiaMenuContribution } from './notepadia-menu-contribution';
import { NotepadiaStatusBarContribution } from './notepadia-status-bar-contribution';
import { NotepadiaDocumentListWidget } from './notepadia-document-list-widget';
import { NotepadiaDocumentListContribution } from './notepadia-document-list-contribution';
import { NotepadiaFaviconContribution } from './notepadia-favicon-contribution';
import { NotepadiaUpdaterContribution } from './notepadia-updater-contribution';
import { NotepadiaColumnEditorContribution } from './notepadia-column-editor';
import { NotepadiaBlankAndLineOperationsContribution } from './notepadia-blank-and-line-operations';
import { NotepadiaSearchMarkContribution } from './notepadia-search-mark';
import { NotepadiaMacroContribution } from './notepadia-macro-contribution';
import { NotepadiaSessionContribution } from './notepadia-session-contribution';
import { NotepadiaCharacterPanelWidget } from './notepadia-character-panel-widget';
import { NotepadiaCharacterPanelContribution } from './notepadia-character-panel-contribution';
import { NotepadiaPrintContribution } from './notepadia-print-contribution';
import { NotepadiaThemeContribution } from './notepadia-theme-contribution';
import { NotepadiaShellContribution } from './notepadia-shell-contribution';
import { NotepadiaPreferenceContribution } from './notepadia-preference-contribution';
import { NotepadiaTabDecorator } from './notepadia-tab-decorator';
import { NotepadiaTabContextMenuContribution } from './notepadia-tab-context-menu';
import { TabBarDecorator } from '@theia/core/lib/browser/shell/tab-bar-decorator';
import { NotepadiaToolbarWidget } from './notepadia-toolbar-widget';
import { NotepadiaToolbarContribution } from './notepadia-toolbar-contribution';
import { PreferenceContribution } from '@theia/core/lib/common/preferences';
import { UntitledResourceResolver } from '@theia/core/lib/common/resource';
import { NotepadiaUpdaterPath, NotepadiaUpdaterService } from '../common/notepadia-updater-protocol';

// Product stylesheet layer. The webpack application build resolves this css
// through the extension's src directory; the build's copy-static step also
// emits it beside lib/browser.
import '../../src/browser/style/index.css';

export default new ContainerModule((bind, _unbind, isBound, rebind) => {
    bind(NotepadiaContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(NotepadiaContribution);
    bind(FrontendApplicationContribution).toService(NotepadiaContribution);

    // New unsaved documents are named `new 1`, `new 2`, ... like Notepad++.
    // The core `ResourceResolver` to-service binding follows the same symbol,
    // so rebinding the resolver here also replaces the resource resolver.
    bind(NotepadiaUntitledResourceResolver).toSelf().inSingletonScope();
    rebind(UntitledResourceResolver).to(NotepadiaUntitledResourceResolver).inSingletonScope();

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

    bind(NotepadiaOvertypeContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(NotepadiaOvertypeContribution);
    bind(FrontendApplicationContribution).toService(NotepadiaOvertypeContribution);

    bind(NotepadiaDocumentListWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: NotepadiaDocumentListWidget.ID,
        createWidget: () => ctx.container.get(NotepadiaDocumentListWidget)
    }));

    bind(NotepadiaDocumentListContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(NotepadiaDocumentListContribution);
    bind(MenuContribution).toService(NotepadiaDocumentListContribution);

    bind(NotepadiaFaviconContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(NotepadiaFaviconContribution);

    bind(NotepadiaUpdaterContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(NotepadiaUpdaterContribution);
    bind(MenuContribution).toService(NotepadiaUpdaterContribution);
    bind(FrontendApplicationContribution).toService(NotepadiaUpdaterContribution);

    bind(NotepadiaColumnEditorContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(NotepadiaColumnEditorContribution);
    bind(MenuContribution).toService(NotepadiaColumnEditorContribution);

    bind(NotepadiaBlankAndLineOperationsContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(NotepadiaBlankAndLineOperationsContribution);
    bind(MenuContribution).toService(NotepadiaBlankAndLineOperationsContribution);

    bind(NotepadiaSearchMarkContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(NotepadiaSearchMarkContribution);
    bind(MenuContribution).toService(NotepadiaSearchMarkContribution);
    bind(FrontendApplicationContribution).toService(NotepadiaSearchMarkContribution);

    bind(NotepadiaMacroContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(NotepadiaMacroContribution);
    bind(MenuContribution).toService(NotepadiaMacroContribution);

    bind(NotepadiaSessionContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(NotepadiaSessionContribution);
    bind(MenuContribution).toService(NotepadiaSessionContribution);

    bind(NotepadiaCharacterPanelWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: NotepadiaCharacterPanelWidget.ID,
        createWidget: () => ctx.container.get(NotepadiaCharacterPanelWidget)
    }));

    bind(NotepadiaCharacterPanelContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(NotepadiaCharacterPanelContribution);
    bind(MenuContribution).toService(NotepadiaCharacterPanelContribution);

    bind(NotepadiaPrintContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(NotepadiaPrintContribution);
    bind(MenuContribution).toService(NotepadiaPrintContribution);

    bind(NotepadiaThemeContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(NotepadiaThemeContribution);

    bind(NotepadiaShellContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(NotepadiaShellContribution);
    bind(CommandContribution).toService(NotepadiaShellContribution);
    bind(MenuContribution).toService(NotepadiaShellContribution);

    // A4 - Notepad++ tab bar: state icons and the tab context menu.
    bind(NotepadiaTabDecorator).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(NotepadiaTabDecorator);
    bind(TabBarDecorator).toService(NotepadiaTabDecorator);

    bind(NotepadiaTabContextMenuContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(NotepadiaTabContextMenuContribution);
    bind(MenuContribution).toService(NotepadiaTabContextMenuContribution);
    bind(FrontendApplicationContribution).toService(NotepadiaTabContextMenuContribution);

    // The toolbar is a single long-lived widget in the shell's top area rather
    // than a WidgetFactory-created view, so it is bound as a singleton and
    // injected straight into its contribution.
    bind(NotepadiaToolbarWidget).toSelf().inSingletonScope();
    bind(NotepadiaToolbarContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(NotepadiaToolbarContribution);

    bind(PreferenceContribution).toConstantValue(NotepadiaPreferenceContribution);

    // The `ElectronMainConnectionProvider` (and therefore `window.electronTheiaCore`)
    // only exists in the packaged/desktop app, so the updater service proxy is only
    // created there. In the browser app the contribution degrades to a no-op.
    if (isBound(ElectronMainConnectionProvider)) {
        bind(NotepadiaUpdaterService).toDynamicValue(context =>
            ElectronIpcConnectionProvider.createProxy<NotepadiaUpdaterService>(context.container, NotepadiaUpdaterPath)
        ).inSingletonScope();
    }
});
