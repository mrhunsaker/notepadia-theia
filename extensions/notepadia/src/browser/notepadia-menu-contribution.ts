import { injectable } from '@theia/core/shared/inversify';
import {
    MenuContribution,
    MenuModelRegistry
} from '@theia/core/lib/common';
import { CommonCommands, CommonMenus } from '@theia/core/lib/browser';
import { NotepadiaCommands } from './notepadia-contribution';

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

        const search = [...menubar, '3_search'];
        const settings = [...menubar, '7_settings'];

        menus.registerSubmenu(editLineOperations, 'Line Operations');
        menus.registerSubmenu(editConvertCase, 'Convert Case');

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
        unregister('workspace:open', fileOpen);
        unregister('workspace:openWorkspace', fileOpen);
        unregister('workspace:openRecent', fileOpen);
        unregister('workspace:addFolder', fileWorkspace);
        unregister('workspace:saveAs', fileWorkspace);
        unregister(CommonCommands.SAVE.id, fileSave);
        unregister(CommonCommands.SAVE_ALL.id, fileSave);
        unregister(CommonCommands.SAVE_AS.id, fileSave);
        unregister(CommonCommands.AUTO_SAVE.id, fileAutoSave);
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
            commandId: NotepadiaCommands.GO_TO_LINE.id,
            label: 'Go To Line...',
            order: 'g'
        });
        menus.registerMenuAction(search, {
            commandId: NotepadiaCommands.MATCHING_BRACKET.id,
            label: 'Matching Bracket',
            order: 'h'
        });

        // View
        const viewZoom = [...CommonMenus.VIEW, '1_notepadia-zoom'];
        const viewTabSize = [...CommonMenus.VIEW, '2_notepadia-tab-size'];
        menus.registerSubmenu(viewZoom, 'Zoom');
        menus.registerSubmenu(viewTabSize, 'Tab Size');
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

        // Settings
        menus.registerMenuAction(settings, {
            commandId: CommonCommands.OPEN_PREFERENCES.id,
            label: 'Preferences',
            order: 'a'
        });
    }
}