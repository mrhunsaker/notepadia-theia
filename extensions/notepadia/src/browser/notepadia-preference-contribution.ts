import {
    PreferenceContribution,
    PreferenceSchema
} from '@theia/core/lib/common/preferences';
import {
    NOTEPADIA_TOOLBAR_VISIBLE_PREFERENCE,
    NOTEPADIA_DRAW_CLOSE_BUTTON_PREFERENCE,
    NOTEPADIA_STATUS_BAR_VISIBLE_PREFERENCE,
    NOTEPADIA_TAB_BAR_MULTI_LINE_PREFERENCE
} from './notepadia-shell-contribution';

import {
    NOTEPADIA_SHOW_SPACE_AND_TAB_PREFERENCE,
    NOTEPADIA_SHOW_END_OF_LINE_PREFERENCE,
    NOTEPADIA_SHOW_INDENT_GUIDE_PREFERENCE,
    NOTEPADIA_POSTIT_PREFERENCE
} from './notepadia-view-contribution';

import {
    NOTEPADIA_SYNC_VERTICAL_PREFERENCE,
    NOTEPADIA_SYNC_HORIZONTAL_PREFERENCE
} from './notepadia-sync-scroll';

import { NOTEPADIA_RUN_ALLOW_PROCESS_PREFERENCE } from './notepadia-run-contribution';

export const NOTEPADIA_DOCUMENT_MAP_VISIBLE_PREFERENCE = 'notepadia.documentMap.visible';
export const NOTEPADIA_SESSION_RESTORE_PREFERENCE = 'notepadia.session.restore';
export const NOTEPADIA_SEARCH_EXTENDED_MODE_PREFERENCE = 'notepadia.search.extendedMode';

const schema: PreferenceSchema = {
    properties: {
        [NOTEPADIA_TOOLBAR_VISIBLE_PREFERENCE]: {
            type: 'boolean',
            description: 'Whether to show the toolbar with the New, Open and Save buttons.',
            default: true
        },
        [NOTEPADIA_STATUS_BAR_VISIBLE_PREFERENCE]: {
            type: 'boolean',
            description: 'Whether to show the status bar at the bottom of the window with the cursor position and indentation settings.',
            default: true
        },
        [NOTEPADIA_TAB_BAR_MULTI_LINE_PREFERENCE]: {
            type: 'boolean',
            description: 'Whether open files are shown on a single row of tabs (like Notepad++ with one tab row) instead of allowing tabs to shrink and scroll.',
            default: false
        },
        [NOTEPADIA_DOCUMENT_MAP_VISIBLE_PREFERENCE]: {
            type: 'boolean',
            description: 'Whether to show the Document Map, the narrow overview of the whole file beside the editor.',
            default: false
        },
        [NOTEPADIA_SESSION_RESTORE_PREFERENCE]: {
            type: 'boolean',
            description: 'Whether the files that were open the last time Notepad was quit are reopened when it starts again.',
            default: false
        },
        [NOTEPADIA_SEARCH_EXTENDED_MODE_PREFERENCE]: {
            type: 'boolean',
            description: 'Whether the Find dialog uses Extended search mode, where \\n, \\r and \\t stand for newline, carriage return and tab.',
            default: false
        },
        [NOTEPADIA_DRAW_CLOSE_BUTTON_PREFERENCE]: {
            type: 'boolean',
            description: 'Whether every tab shows a close button, instead of only the active tab.',
            default: true
        },
        [NOTEPADIA_SHOW_SPACE_AND_TAB_PREFERENCE]: {
            type: 'boolean',
            description: 'Whether spaces and tabs are drawn as dots and arrows, as Notepad++\'s View > Show Symbol > Show Space and TAB does. Off by default, which is the Notepad++ default set on editor.renderWhitespace.',
            default: false
        },
        [NOTEPADIA_SHOW_END_OF_LINE_PREFERENCE]: {
            type: 'boolean',
            description: 'Whether the end-of-line marker is drawn at the end of each line, as Notepad++\'s View > Show Symbol > Show End of Line does.',
            default: false
        },
        [NOTEPADIA_SHOW_INDENT_GUIDE_PREFERENCE]: {
            type: 'boolean',
            description: 'Whether the vertical indent guide is drawn down each indentation level, as Notepad++\'s View > Show Symbol > Show Indent Guide does.',
            default: true
        },
        [NOTEPADIA_POSTIT_PREFERENCE]: {
            type: 'boolean',
            description: 'Whether Post-It mode hides everything but the editor, the same as Notepad++\'s View > Post-It (F12).',
            default: false
        },
        [NOTEPADIA_SYNC_VERTICAL_PREFERENCE]: {
            type: 'boolean',
            description: 'Whether the two split views keep the same vertical scroll position.',
            default: false
        },
        [NOTEPADIA_SYNC_HORIZONTAL_PREFERENCE]: {
            type: 'boolean',
            description: 'Whether the two split views keep the same horizontal scroll position.',
            default: false
        },
        [NOTEPADIA_RUN_ALLOW_PROCESS_PREFERENCE]: {
            type: 'boolean',
            description: 'Whether Run > Run... may launch programs on this computer. Running a saved command executes arbitrary text, so this is off by default and only ever has an effect in the packaged desktop app - a browser tab cannot start a process at all.',
            default: false
        }
    }
};

export const NotepadiaPreferenceContribution: PreferenceContribution = { schema };