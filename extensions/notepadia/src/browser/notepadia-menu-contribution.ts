import { injectable } from '@theia/core/shared/inversify';
import {
    MenuContribution,
    MenuModelRegistry
} from '@theia/core/lib/common';
import { CommonCommands, CommonMenus } from '@theia/core/lib/browser';
import { NotepadiaCommands } from './notepadia-contribution';
import { NotepadiaShellCommands } from './notepadia-shell-contribution';
import { NotepadiaFindCommands } from './notepadia-find-contribution';
import { NotepadiaSearchMarkCommands } from './notepadia-search-mark';
import { NotepadiaEditExtrasCommands, NOTEPADIA_EDIT_MENU_PATHS } from './notepadia-edit-extras-contribution';
import { NotepadiaClipboardHistoryCommands } from './notepadia-clipboard-history-contribution';
import { NotepadiaCharacterPanelCommands } from './notepadia-character-panel-contribution';

@injectable()
export class NotepadiaMenuContribution implements MenuContribution {
    registerMenus(menus: MenuModelRegistry): void {
        const menubar = ['menubar'];

        const file = [...CommonMenus.FILE];
        const fileNewText = [...CommonMenus.FILE_NEW_TEXT];
        const fileOpen = [...CommonMenus.FILE_OPEN];
        const fileSave = [...CommonMenus.FILE_SAVE];
        const fileAutoSave = [...CommonMenus.FILE_AUTOSAVE];
        const fileClose = [...CommonMenus.FILE_CLOSE];
        const fileDownloadUpload = [...CommonMenus.FILE, '4_downloadupload'];
        const fileWorkspace = [...CommonMenus.FILE, '2_workspace'];
        const fileSettingsOpen = [...CommonMenus.FILE_SETTINGS_SUBMENU_OPEN];
        const fileSettingsTheme = [...CommonMenus.FILE_SETTINGS_SUBMENU_THEME];

        const editFind = [...CommonMenus.EDIT_FIND];
        const editLines = [...CommonMenus.EDIT, '3_notepadia-lines'];
        const editLineOperations = [...CommonMenus.EDIT, '4_notepadia-line-operations'];
        const editConvertCase = [...CommonMenus.EDIT, '5_notepadia-convert-case'];

        // C2. The Edit menu in Notepad++ reads: clipboard (with the two
        // submenus), line operations, selection, line conversions, insert, the
        // rest of the line commands, then the two panels at the foot. These
        // group names sort lexicographically against Theia's, so they are named
        // to land in that order rather than relying on registration order.
        const editCopyToClipboard = NOTEPADIA_EDIT_MENU_PATHS.copyToClipboard;
        const editPasteSpecial = NOTEPADIA_EDIT_MENU_PATHS.pasteSpecial;
        const editSelect = NOTEPADIA_EDIT_MENU_PATHS.select;
        const editInsert = NOTEPADIA_EDIT_MENU_PATHS.insert;
        const editMultiSelect = [...editSelect, 'multiselect'];
        const editClipboardHistory = NOTEPADIA_EDIT_MENU_PATHS.clipboardHistory;
        const editCharacterPanel = NOTEPADIA_EDIT_MENU_PATHS.characterPanel;

        const search = [...menubar, '3_search'];
        const settings = [...menubar, '7_settings'];

        menus.registerSubmenu(editLineOperations, 'Line Operations');
        menus.registerSubmenu(editConvertCase, 'Convert Case');
        menus.registerSubmenu(editCopyToClipboard, 'Copy to Clipboard');
        menus.registerSubmenu(editPasteSpecial, 'Paste Special');
        menus.registerSubmenu(editSelect, 'Select');
        menus.registerSubmenu(editMultiSelect, 'Multi-Select All');
        menus.registerSubmenu(editInsert, 'Insert');
        menus.registerSubmenu([...editInsert, 'datetime'], 'Date & Time');

        menus.registerSubmenu(search, 'Search');
        menus.registerSubmenu(settings, 'Settings');

        // Hide Theia/workspace infra clutter from the File menu so it matches
        // Notepad++ (New, Open..., Save, Save As, Save All, Recent Files,
        // Close, Close All). The commands stay available; their menu entries
        // are only removed from the File subtree.
        const unregister = (commandId: string | undefined, path: string[]): void => {
            if (commandId) {
                menus.unregisterMenuAction(commandId, path);
            }
        };
        unregister(CommonCommands.NEW_UNTITLED_TEXT_FILE.id, fileNewText);
        unregister(CommonCommands.PICK_NEW_FILE.id, fileNewText);
        unregister('file.newFolder', fileNewText);
        unregister('workbench.action.newWindow', fileNewText);
        // C1: `workspace:open` is the only menu route to choosing a folder as
        // the workspace root, and a browser user has no other way to point the
        // app at a directory, so it must stay. Theia's own "Open..." entry for
        // it is unregistered here and re-added below as "Open Folder as
        // Workspace..." in the Notepad++ position, so the command keeps its
        // route without a second, ambiguously named entry.
        unregister('workspace:open', fileOpen);        unregister('workspace:openWorkspace', fileOpen);
        unregister('workspace:openRecent', fileOpen);
        unregister('workspace:addFolder', fileWorkspace);
        unregister('workspace:saveAs', fileWorkspace);
        unregister(CommonCommands.SAVE.id, fileSave);
        unregister(CommonCommands.SAVE_ALL.id, fileSave);
        unregister(CommonCommands.SAVE_AS.id, fileSave);
        unregister(CommonCommands.AUTO_SAVE.id, fileAutoSave);
        // D1: Theia's own `file.upload` and `file.download` are only enabled
        // when a node is selected in the Files tree, so as File menu entries
        // they can never run - a dead control. NotepadiaLocalFilesContribution
        // registers working equivalents instead ("Upload to Workspace..." and
        // "Save To This Computer..."), so these stay hidden.
        unregister('file.upload', fileDownloadUpload);
        unregister('file.download', fileDownloadUpload);
        unregister(CommonCommands.CLOSE_MAIN_TAB.id, fileClose);
        unregister('workspace:close', fileClose);
        unregister(CommonCommands.OPEN_PREFERENCES.id, fileSettingsOpen);
        unregister('keymaps:open', fileSettingsOpen);
        unregister(CommonCommands.SELECT_COLOR_THEME.id, fileSettingsTheme);
        unregister(CommonCommands.SELECT_ICON_THEME.id, fileSettingsTheme);

        // Edit - keep Find/Replace only under Search (Notepad++ behavior)
        unregister(CommonCommands.FIND.id, editFind);
        unregister(CommonCommands.REPLACE.id, editFind);
        unregister('search-in-workspace.open', editFind);
        unregister('search-in-workspace.replace', editFind);

        // Edit - Theia's workspace clipboard clutter does not live here in
        // Notepad++. `core.copy.path` ("Copy Path") and the workspace
        // contribution's "Copy Download Link" are file-navigator notions that
        // leak into the clipboard group and read as dead weight next to the
        // Copy to Clipboard submenu; both are still reachable from the file
        // context menus where they mean something.
        const editClipboard = [...CommonMenus.EDIT, '2_clipboard'];
        unregister(CommonCommands.COPY_PATH.id, editClipboard);
        unregister('file.copyDownloadLink', editClipboard);
        unregister('navigator.copyRelativeFilePath', editClipboard);

        // File (Notepad++ order)
        menus.registerMenuAction(file, {
            commandId: NotepadiaCommands.NEW_DOCUMENT.id,
            label: 'New',
            order: '0a'
        });
        menus.registerMenuAction(file, {
            commandId: CommonCommands.OPEN.id,
            label: 'Open...',
            order: '0b'
        });
        // Notepad++ order: New, Open..., Open Folder as Workspace..., then the
        // recent-file list. D1 nests "Open From This Computer..." and "Upload
        // to Workspace..." at 0b.1/0b.2, directly under Open....
        menus.registerMenuAction(file, {
            commandId: 'workspace:open',
            label: 'Open Folder as Workspace...',
            order: '0c'
        });
        menus.registerMenuAction(file, {
            commandId: CommonCommands.SAVE.id,
            label: 'Save',
            order: '0d'
        });
        menus.registerMenuAction(file, {
            commandId: CommonCommands.SAVE_AS.id,
            label: 'Save As...',
            order: '0e'
        });
        menus.registerMenuAction(file, {
            commandId: CommonCommands.SAVE_ALL.id,
            label: 'Save All',
            order: '0f'
        });
        menus.registerMenuAction(file, {
            commandId: NotepadiaCommands.CLOSE.id,
            label: 'Close',
            order: '0g'
        });
        menus.registerMenuAction(file, {
            commandId: NotepadiaCommands.CLOSE_ALL.id,
            label: 'Close All',
            order: '0h'
        });
        menus.registerMenuAction(file, {
            commandId: CommonCommands.CLOSE_OTHER_TABS.id,
            label: 'Close All But Active',
            order: '0i'
        });
        // C2: Notepad++ keeps the read-only flag in the File menu, not the Edit
        // menu - it is a property of the document rather than of an edit. It
        // follows the recent-file list and precedes Save, which is Notepad++'s
        // position. Theia's File submenus sort as a child of the File menu
        // rather than as a command, and Recent Files registers as
        // `0c_notepadia-recent`, so an order of `0cz` is what lands directly
        // behind it: the flag sorts after that group and before `0d` (Save).
        // With no recent files the group is absent and the flag simply follows
        // Open Folder as Workspace..., which is the same place in the list.
        menus.registerMenuAction(file, {
            commandId: NotepadiaEditExtrasCommands.SET_READ_ONLY.id,
            label: 'Set/Clear Read-Only',
            order: '0cz'
        });

        // Edit - line and block operations
        menus.registerMenuAction(editLines, {
            commandId: NotepadiaCommands.INDENT.id,
            label: 'Indent',
            order: 'a'
        });
        menus.registerMenuAction(editLines, {
            commandId: NotepadiaCommands.UNINDENT.id,
            label: 'Unindent',
            order: 'b'
        });
        menus.registerMenuAction(editLines, {
            commandId: NotepadiaCommands.DUPLICATE_LINE.id,
            label: 'Duplicate Current Line',
            order: 'c'
        });
        menus.registerMenuAction(editLines, {
            commandId: NotepadiaCommands.DELETE_LINE.id,
            label: 'Delete Current Line',
            order: 'd'
        });
        menus.registerMenuAction(editLines, {
            commandId: NotepadiaCommands.MOVE_LINE_UP.id,
            label: 'Move Current Line Up',
            order: 'e'
        });
        menus.registerMenuAction(editLines, {
            commandId: NotepadiaCommands.MOVE_LINE_DOWN.id,
            label: 'Move Current Line Down',
            order: 'f'
        });
        menus.registerMenuAction(editLines, {
            commandId: NotepadiaCommands.JOIN_LINES.id,
            label: 'Join Lines',
            order: 'g'
        });
        menus.registerMenuAction(editLines, {
            commandId: NotepadiaCommands.TOGGLE_COMMENT.id,
            label: 'Toggle Comment',
            order: 'h'
        });

        // Edit - Line Operations submenu
        menus.registerMenuAction(editLineOperations, {
            commandId: NotepadiaCommands.TRIM_TRAILING_WHITESPACE.id,
            label: 'Trim Trailing Whitespace',
            order: 'a'
        });
        menus.registerMenuAction(editLineOperations, {
            commandId: NotepadiaCommands.REMOVE_DUPLICATE_LINES.id,
            label: 'Remove Duplicate Lines',
            order: 'b'
        });
        menus.registerMenuAction(editLineOperations, {
            commandId: NotepadiaCommands.SORT_LINES_ASCENDING.id,
            label: 'Sort Lines Ascending',
            order: 'c'
        });
        menus.registerMenuAction(editLineOperations, {
            commandId: NotepadiaCommands.SORT_LINES_DESCENDING.id,
            label: 'Sort Lines Descending',
            order: 'd'
        });
        menus.registerMenuAction(editLineOperations, {
            commandId: NotepadiaCommands.REVERSE_LINES.id,
            label: 'Reverse Lines',
            order: 'e'
        });

        // Edit - Convert Case submenu
        menus.registerMenuAction(editConvertCase, {
            commandId: NotepadiaCommands.UPPER_CASE.id,
            label: 'UPPER CASE',
            order: 'a'
        });
        menus.registerMenuAction(editConvertCase, {
            commandId: NotepadiaCommands.LOWER_CASE.id,
            label: 'lower case',
            order: 'b'
        });

        // Edit > Copy to Clipboard. Notepad++'s entries are about where the
        // document lives, not about its contents - the text itself is already
        // on the clipboard after any ordinary Copy.
        menus.registerMenuAction(editCopyToClipboard, {
            commandId: NotepadiaEditExtrasCommands.COPY_FULL_FILE_PATH.id,
            label: 'Current Full File Path',
            order: 'a'
        });
        menus.registerMenuAction(editCopyToClipboard, {
            commandId: NotepadiaEditExtrasCommands.COPY_FILE_NAME.id,
            label: 'Current Filename',
            order: 'b'
        });
        menus.registerMenuAction(editCopyToClipboard, {
            commandId: NotepadiaEditExtrasCommands.COPY_DIRECTORY_PATH.id,
            label: 'Current Directory Path',
            order: 'c'
        });

        // Edit > Paste Special
        menus.registerMenuAction(editPasteSpecial, {
            commandId: NotepadiaEditExtrasCommands.PASTE_AND_INDENT.id,
            label: 'Paste and Indent',
            order: 'a'
        });
        menus.registerMenuAction(editPasteSpecial, {
            commandId: NotepadiaEditExtrasCommands.PASTE_AND_UNINDENT.id,
            label: 'Paste and Unindent',
            order: 'b'
        });
        menus.registerMenuAction(editPasteSpecial, {
            commandId: NotepadiaEditExtrasCommands.PASTE_UNFORMATTED.id,
            label: 'Paste Unformatted',
            order: 'c'
        });

        // Edit > Select. Notepad++'s Ctrl+A stays Ctrl+A; the menu entry is
        // here so the shortcut is discoverable and so the submenu reads as the
        // selection group it is.
        menus.registerMenuAction(editSelect, {
            commandId: CommonCommands.SELECT_ALL.id,
            label: 'Select All',
            order: 'a'
        });
        menus.registerMenuAction(editSelect, {
            commandId: NotepadiaEditExtrasCommands.BEGIN_END_SELECT.id,
            label: 'Begin/End Select',
            order: 'b'
        });
        // Notepad++'s Column Mode sits next to the existing Column Editor in
        // Line Operations, so it is registered there too (at `z`, behind the
        // editor's `y`) rather than under Select.
        menus.registerMenuAction(editLineOperations, {
            commandId: NotepadiaEditExtrasCommands.COLUMN_MODE.id,
            label: 'Column Mode',
            order: 'z'
        });
        menus.registerMenuAction(editMultiSelect, {
            commandId: NotepadiaEditExtrasCommands.MULTI_SELECT_ALL.id,
            label: 'Multi-Select All',
            order: 'a'
        });
        menus.registerMenuAction(editMultiSelect, {
            commandId: NotepadiaEditExtrasCommands.MULTI_SELECT_ALL_MATCH_CASE.id,
            label: 'Match case',
            order: 'b'
        });
        menus.registerMenuAction(editMultiSelect, {
            commandId: NotepadiaEditExtrasCommands.MULTI_SELECT_ALL_WHOLE_WORD.id,
            label: 'Whole word',
            order: 'c'
        });

        // Edit > Insert > Date & Time
        menus.registerMenuAction([...editInsert, 'datetime'], {
            commandId: NotepadiaEditExtrasCommands.DATE_TIME_SHORT.id,
            label: 'Date & Time (short)',
            order: 'a'
        });
        menus.registerMenuAction([...editInsert, 'datetime'], {
            commandId: NotepadiaEditExtrasCommands.DATE_TIME_LONG.id,
            label: 'Date & Time (long)',
            order: 'b'
        });
        menus.registerMenuAction([...editInsert, 'datetime'], {
            commandId: NotepadiaEditExtrasCommands.DATE_TIME_CUSTOM.id,
            label: 'Date & Time (customized)...',
            order: 'c'
        });

        // The two panels Notepad++ keeps at the foot of the Edit menu.
        menus.registerMenuAction(editClipboardHistory, {
            commandId: NotepadiaClipboardHistoryCommands.TOGGLE.id,
            label: 'Clipboard History',
            order: 'a'
        });
        menus.registerMenuAction(editCharacterPanel, {
            commandId: NotepadiaCharacterPanelCommands.TOGGLE.id,
            label: 'Character Panel',
            order: 'a'
        });

        // Search
        menus.registerMenuAction(search, {
            commandId: CommonCommands.FIND.id,
            label: 'Find...',
            order: 'a'
        });
        menus.registerMenuAction(search, {
            commandId: NotepadiaCommands.FIND_NEXT.id,
            label: 'Find Next',
            order: 'b'
        });
        menus.registerMenuAction(search, {
            commandId: NotepadiaCommands.FIND_PREVIOUS.id,
            label: 'Find Previous',
            order: 'c'
        });
        menus.registerMenuAction(search, {
            commandId: CommonCommands.REPLACE.id,
            label: 'Replace...',
            order: 'd'
        });
        menus.registerMenuAction(search, {
            commandId: 'search-in-workspace.open',
            label: 'Find in Files',
            order: 'e'
        });
        menus.registerMenuAction(search, {
            commandId: 'search-in-workspace.replace',
            label: 'Replace in Files...',
            order: 'f'
        });
        menus.registerMenuAction(search, {
            commandId: NotepadiaFindCommands.OPEN_MARK.id,
            label: 'Mark...',
            order: 'g'
        });
        menus.registerMenuAction(search, {
            commandId: NotepadiaCommands.GO_TO_LINE.id,
            label: 'Go To Line...',
            order: 'h'
        });
        menus.registerMenuAction(search, {
            commandId: NotepadiaCommands.MATCHING_BRACKET.id,
            label: 'Matching Bracket',
            order: 'i'
        });
        // Notepad++ keeps a Mark submenu next to Bookmark at the foot of the
        // Search menu. Its entries open the Find dialog on the Mark tab and
        // run the action there (see NotepadiaFindContribution).
        const searchMark = [...search, 'notepadia-mark'];
        menus.registerSubmenu(searchMark, 'Mark');
        menus.registerMenuAction(searchMark, {
            commandId: NotepadiaSearchMarkCommands.MARK_ALL.id,
            label: 'Mark All',
            order: 'a'
        });
        menus.registerMenuAction(searchMark, {
            commandId: NotepadiaSearchMarkCommands.CLEAR.id,
            label: 'Clear All Marks',
            order: 'b'
        });
        menus.registerMenuAction(searchMark, {
            commandId: NotepadiaSearchMarkCommands.SELECT_FIND_NEXT.id,
            label: 'Select and Find Next',
            order: 'c'
        });

        // View
        const viewZoom = [...CommonMenus.VIEW, '1_notepadia-zoom'];
        const viewTabSize = [...CommonMenus.VIEW, '2_notepadia-tab-size'];
        const viewTabBar = [...CommonMenus.VIEW, '3_notepadia-tab-bar'];
        menus.registerSubmenu(viewZoom, 'Zoom');
        menus.registerSubmenu(viewTabSize, 'Tab Size');
        menus.registerSubmenu(viewTabBar, 'Tab Bar');
        menus.registerMenuAction(viewZoom, {
            commandId: NotepadiaCommands.ZOOM_IN.id,
            label: 'Zoom In',
            order: 'a'
        });
        menus.registerMenuAction(viewZoom, {
            commandId: NotepadiaCommands.ZOOM_OUT.id,
            label: 'Zoom Out',
            order: 'b'
        });
        menus.registerMenuAction(viewZoom, {
            commandId: NotepadiaCommands.ZOOM_RESET.id,
            label: 'Reset Zoom',
            order: 'c'
        });
        menus.registerMenuAction(viewTabSize, {
            commandId: NotepadiaCommands.TAB_SIZE_2.id,
            label: '2',
            order: 'a'
        });
        menus.registerMenuAction(viewTabSize, {
            commandId: NotepadiaCommands.TAB_SIZE_4.id,
            label: '4',
            order: 'b'
        });
        menus.registerMenuAction(viewTabSize, {
            commandId: NotepadiaCommands.TAB_SIZE_8.id,
            label: '8',
            order: 'c'
        });
        menus.registerMenuAction(viewTabSize, {
            commandId: NotepadiaCommands.INSERT_SPACES.id,
            label: 'Insert Spaces',
            order: 'd'
        });
        menus.registerMenuAction(viewTabSize, {
            commandId: NotepadiaCommands.USE_TABS.id,
            label: 'Use Tabs',
            order: 'e'
        });
        menus.registerMenuAction([...CommonMenus.VIEW], {
            commandId: NotepadiaCommands.TOGGLE_WHITESPACE.id,
            label: 'Show All Characters',
            order: 'b'
        });
        menus.registerMenuAction([...CommonMenus.VIEW], {
            commandId: NotepadiaCommands.TOGGLE_DOCUMENT_MAP.id,
            label: 'Document Map',
            order: 'c'
        });
        menus.registerMenuAction([...CommonMenus.VIEW], {
            commandId: 'editor.action.toggleWordWrap',
            label: 'Toggle Word Wrap',
            order: 'z'
        });

        // View > Tab Bar. Notepad++ offers Multi-line, Vertical and Lock here;
        // Theia has no native backing for any of them (the multi-line tab bar is
        // a core feature that cannot be toggled per-view), so only the genuinely
        // implementable "Draw Close Button" toggle ships; the rest return with
        // the A6/C3 milestones, which own tab-bar preferences.
        menus.registerMenuAction(viewTabBar, {
            commandId: NotepadiaShellCommands.TOGGLE_DRAW_CLOSE_BUTTON.id,
            label: 'Draw Close Button',
            order: 'a'
        });

        // Settings
        menus.registerMenuAction(settings, {
            commandId: CommonCommands.OPEN_PREFERENCES.id,
            label: 'Preferences',
            order: 'a'
        });
        // D2: The shortcut editor is the user's escape hatch for every chord
        // this app or the browser has taken. Hiding it would leave a Notepad++
        // user who arrives on Ctrl+N and finds the browser answered with no way
        // to fix it.
        menus.registerMenuAction(settings, {
            commandId: 'keymaps:open',
            label: 'Shortcut Mapper',
            order: 'b'
        });
    }
}