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
import { NotepadiaViewContribution } from './notepadia-view-contribution';
import { NotepadiaSyncScrollContribution } from './notepadia-sync-scroll';
import { NotepadiaStatusBarContribution } from './notepadia-status-bar-contribution';
import { NotepadiaDocumentListWidget } from './notepadia-document-list-widget';
import { NotepadiaDocumentListContribution } from './notepadia-document-list-contribution';
import { NotepadiaOpenDocuments } from './notepadia-open-documents';
import { NotepadiaWindowMenuContribution } from './notepadia-window-menu-contribution';
import { NotepadiaFaviconContribution } from './notepadia-favicon-contribution';
import { NotepadiaUpdaterContribution } from './notepadia-updater-contribution';
import { NotepadiaColumnEditorContribution } from './notepadia-column-editor';
import { NotepadiaBlankAndLineOperationsContribution } from './notepadia-blank-and-line-operations';
import { NotepadiaSearchMarkContribution } from './notepadia-search-mark';
import { NotepadiaFindState } from './notepadia-find-state';
import { NotepadiaFindDialog } from './notepadia-find-dialog';
import { NotepadiaFindContribution } from './notepadia-find-contribution';
import { NotepadiaMacroContribution } from './notepadia-macro-contribution';
import { NotepadiaRunContribution } from './notepadia-run-contribution';
import { NotepadiaSessionContribution } from './notepadia-session-contribution';
import { NotepadiaCharacterPanelWidget } from './notepadia-character-panel-widget';
import { NotepadiaCharacterPanelContribution } from './notepadia-character-panel-contribution';
import { NotepadiaPrintContribution } from './notepadia-print-contribution';
import { NotepadiaLocalFilesContribution } from './notepadia-local-files-contribution';
import { NotepadiaThemeContribution } from './notepadia-theme-contribution';
import { NotepadiaShellContribution } from './notepadia-shell-contribution';
import { NotepadiaFileOperationsContribution } from './notepadia-file-operations-contribution';
import {
    NotepadiaBackupContribution,
    NotepadiaBackupPreferences
} from './notepadia-backup-contribution';
import { NotepadiaPreferenceContribution } from './notepadia-preference-contribution';
import { NotepadiaEditExtrasContribution } from './notepadia-edit-extras-contribution';
import { NotepadiaClipboardHistoryState } from './notepadia-clipboard-history-state';
import { NotepadiaClipboardHistoryWidget } from './notepadia-clipboard-history-widget';
import { NotepadiaClipboardHistoryContribution } from './notepadia-clipboard-history-contribution';
import { NotepadiaTabDecorator } from './notepadia-tab-decorator';
import { NotepadiaTabContextMenuContribution } from './notepadia-tab-context-menu';
import { TabBarDecorator } from '@theia/core/lib/browser/shell/tab-bar-decorator';
import { NotepadiaToolbarWidget } from './notepadia-toolbar-widget';
import { NotepadiaToolbarContribution } from './notepadia-toolbar-contribution';
import { PreferenceContribution } from '@theia/core/lib/common/preferences';
import { UntitledResourceResolver } from '@theia/core/lib/common/resource';
import { NotepadiaUpdaterPath, NotepadiaUpdaterService } from '../common/notepadia-updater-protocol';
import { NotepadiaRunPath, NotepadiaRunService } from '../common/notepadia-run-protocol';

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

    // C1: Reload from Disk, Save a Copy As..., Rename... and Delete from Disk.
    bind(NotepadiaFileOperationsContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(NotepadiaFileOperationsContribution);
    bind(MenuContribution).toService(NotepadiaFileOperationsContribution);

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

    // C3 - the View menu's Show Symbol, folding, split, Full Screen, Post-It
    // and Summary entries. Sync scrolling is a separate contribution because it
    // owns its own scroll listeners.
    bind(NotepadiaViewContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(NotepadiaViewContribution);
    bind(MenuContribution).toService(NotepadiaViewContribution);
    bind(FrontendApplicationContribution).toService(NotepadiaViewContribution);

    bind(NotepadiaSyncScrollContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(NotepadiaSyncScrollContribution);
    bind(MenuContribution).toService(NotepadiaSyncScrollContribution);
    bind(FrontendApplicationContribution).toService(NotepadiaSyncScrollContribution);

    bind(NotepadiaMenuContribution).toSelf().inSingletonScope();
    bind(MenuContribution).toService(NotepadiaMenuContribution);

    bind(NotepadiaKeybindingContribution).toSelf().inSingletonScope();
    bind(KeybindingContribution).toService(NotepadiaKeybindingContribution);

    bind(NotepadiaEditorKeybindingContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(NotepadiaEditorKeybindingContribution);

    // Bound after NotepadiaEditExtrasContribution (C2), which it injects for the
    // Read-Only status item.
    bind(NotepadiaStatusBarContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(NotepadiaStatusBarContribution);

    bind(NotepadiaOvertypeContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(NotepadiaOvertypeContribution);
    bind(FrontendApplicationContribution).toService(NotepadiaOvertypeContribution);

    // C4 - one model of the open documents behind both the Document List and
    // the Window menu / Windows... dialog.
    bind(NotepadiaOpenDocuments).toSelf().inSingletonScope();

    bind(NotepadiaDocumentListWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: NotepadiaDocumentListWidget.ID,
        createWidget: () => ctx.container.get(NotepadiaDocumentListWidget)
    }));

    bind(NotepadiaDocumentListContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(NotepadiaDocumentListContribution);
    bind(MenuContribution).toService(NotepadiaDocumentListContribution);

    // C4 - the Notepad++ Window menu and the Windows... dialog.
    bind(NotepadiaWindowMenuContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(NotepadiaWindowMenuContribution);
    bind(MenuContribution).toService(NotepadiaWindowMenuContribution);
    bind(FrontendApplicationContribution).toService(NotepadiaWindowMenuContribution);

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
    bind(FrontendApplicationContribution).toService(NotepadiaSearchMarkContribution);

    // B2 - Notepad++ tabbed Find dialog. The dialog itself is a modeless
    // floating panel (not a Shell widget), so it is bound as a singleton and
    // injected straight into its contribution rather than created by a
    // WidgetFactory.
    bind(NotepadiaFindState).toSelf().inSingletonScope();
    bind(NotepadiaFindDialog).toSelf().inSingletonScope();
    bind(NotepadiaFindContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(NotepadiaFindContribution);

    bind(NotepadiaMacroContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(NotepadiaMacroContribution);
    bind(MenuContribution).toService(NotepadiaMacroContribution);

    // C5 - the Run menu. The desktop half arrives over its own Electron IPC
    // channel and is only bound in the packaged app, so in the browser the
    // contribution falls back to opening http(s) commands and explaining why
    // anything else needs the desktop build.
    bind(NotepadiaRunContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(NotepadiaRunContribution);
    bind(MenuContribution).toService(NotepadiaRunContribution);
    bind(FrontendApplicationContribution).toService(NotepadiaRunContribution);

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

    // C2 - Copy to Clipboard, Paste Special, Insert Date & Time, the read-only
    // flag, Begin/End Select, Multi-Select All, Column Mode and the Clipboard
    // History panel. The history is a singleton in its own right because the
    // contribution that records copies and the panel that lists them are
    // separate bindings; the state is what they share.
    //
    // Bound before the status bar so the status bar can inject
    // NotepadiaEditExtrasContribution for its Read-Only label.
    bind(NotepadiaClipboardHistoryState).toSelf().inSingletonScope();
    bind(NotepadiaClipboardHistoryWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: NotepadiaClipboardHistoryWidget.ID,
        createWidget: () => ctx.container.get(NotepadiaClipboardHistoryWidget)
    }));
    bind(NotepadiaClipboardHistoryContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(NotepadiaClipboardHistoryContribution);
    bind(NotepadiaEditExtrasContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(NotepadiaEditExtrasContribution);
    bind(FrontendApplicationContribution).toService(NotepadiaEditExtrasContribution);

    bind(NotepadiaPrintContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(NotepadiaPrintContribution);
    bind(MenuContribution).toService(NotepadiaPrintContribution);

    // D1 - the user's own disk, which a browser-hosted app otherwise has no
    // way to reach. Owns the Ctrl+S write-back handler for tabs that carry a
    // FileSystemFileHandle, so it is bound before anything that also claims
    // `file.save` would have a chance to run first.
    bind(NotepadiaLocalFilesContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(NotepadiaLocalFilesContribution);
    bind(MenuContribution).toService(NotepadiaLocalFilesContribution);

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

    // D3 - crash recovery for unsaved buffers. Theia already warns before
    // closing a dirty tab; this keeps the text so a crash, a killed browser or
    // a closed tab can be recovered on the next launch. Bound after the
    // editors it observes so its first restore pass runs against a populated
    // shell.
    bind(NotepadiaBackupContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(NotepadiaBackupContribution);
    bind(PreferenceContribution).toConstantValue(NotepadiaBackupPreferences);

    // The `ElectronMainConnectionProvider` (and therefore `window.electronTheiaCore`)
    // only exists in the packaged/desktop app, so the updater service proxy is only
    // created there. In the browser app the contribution degrades to a no-op.
    if (isBound(ElectronMainConnectionProvider)) {
        bind(NotepadiaUpdaterService).toDynamicValue(context =>
            ElectronIpcConnectionProvider.createProxy<NotepadiaUpdaterService>(context.container, NotepadiaUpdaterPath)
        ).inSingletonScope();
        bind(NotepadiaRunService).toDynamicValue(context =>
            ElectronIpcConnectionProvider.createProxy<NotepadiaRunService>(context.container, NotepadiaRunPath)
        ).inSingletonScope();
    }
});
