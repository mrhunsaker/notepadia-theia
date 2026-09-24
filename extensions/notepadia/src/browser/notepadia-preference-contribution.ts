import {
    PreferenceContribution,
    PreferenceSchema
} from '@theia/core/lib/common/preferences';
import {
    NOTEPADIA_TOOLBAR_VISIBLE_PREFERENCE,
    NOTEPADIA_DRAW_CLOSE_BUTTON_PREFERENCE
} from './notepadia-shell-contribution';

export const NOTEPADIA_STATUS_BAR_VISIBLE_PREFERENCE = 'notepadia.statusBar.visible';
export const NOTEPADIA_TAB_BAR_MULTI_LINE_PREFERENCE = 'notepadia.tabBar.multiLine';
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
        }
    }
};

export const NotepadiaPreferenceContribution: PreferenceContribution = { schema };