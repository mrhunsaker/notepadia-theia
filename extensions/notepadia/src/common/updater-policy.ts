import { NotepadiaUpdateState } from './notepadia-updater-protocol';

export interface StartupPopupDecision {
    /** Open the Check for Updates dialog for this status. */
    readonly open: boolean;
    /** Whether the startup check is still awaiting a settling status. */
    readonly pending: boolean;
}

/**
 * Decides what the frontend does with a status pushed while no dialog is open.
 *
 * Policy: the automatic startup check only surfaces a popup when a newer
 * GitHub release actually exists. A launch that finds you up to date, or whose
 * check fails, records the result and stays quiet; a pending check survives
 * `checking` and in-flight download statuses, and any other settling status
 * (not-available, error, disabled, downloaded) ends the pending window so a
 * later push can never re-open a popup the user has already dismissed.
 */
export function startupPopupDecision(state: NotepadiaUpdateState, pending: boolean): StartupPopupDecision {
    if (!pending) {
        return { open: false, pending: false };
    }
    if (state === 'update-available') {
        return { open: true, pending: false };
    }
    if (state === 'checking' || state === 'download-progress') {
        return { open: false, pending: true };
    }
    return { open: false, pending: false };
}
