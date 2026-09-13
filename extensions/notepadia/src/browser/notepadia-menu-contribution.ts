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
        const edit = [...CommonMenus.EDIT];
        const editLines = [...CommonMenus.EDIT, '3_notepadia-lines'];
        const editLineOperations = [...CommonMenus.EDIT, '4_notepadia-line-operations'];
        const editConvertCase = [...CommonMenus.EDIT, '5_notepadia-convert-case'];

        const search = [...menubar, '3_search'];
        const settings = [...menubar, '7_settings'];

        menus.registerSubmenu(editLineOperations, 'Line Operations');
        menus.registerSubmenu(editConvertCase, 'Convert Case');

        menus.registerSubmenu(search, 'Search');
        menus.registerSubmenu(settings, 'Settings');

        // File
        menus.registerMenuAction(file, {
            commandId: NotepadiaCommands.NEW_DOCUMENT.id,
            label: 'New',
            order: 'a'
        });
        menus.registerMenuAction(file, {
            commandId: CommonCommands.OPEN.id,
            label: 'Open...',
            order: 'b'
        });
        menus.registerMenuAction(file, {
            commandId: CommonCommands.SAVE.id,
            label: 'Save',
            order: 'c'
        });
        menus.registerMenuAction(file, {
            commandId: CommonCommands.SAVE_AS.id,
            label: 'Save As...',
            order: 'd'
        });
        menus.registerMenuAction(file, {
            commandId: CommonCommands.SAVE_ALL.id,
            label: 'Save All',
            order: 'e'
        });
        menus.registerMenuAction(file, {
            commandId: NotepadiaCommands.CLOSE.id,
            label: 'Close',
            order: 'f'
        });
        menus.registerMenuAction(file, {
            commandId: NotepadiaCommands.CLOSE_ALL.id,
            label: 'Close All',
            order: 'g'
        });
        menus.registerMenuAction(file, {
            commandId: CommonCommands.CLOSE_OTHER_TABS.id,
            label: 'Close All But Active',
            order: 'h'
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

        // View
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