export const NotepadiaRunPath = '/services/notepadia/run';

export interface NotepadiaRunResult {
    /** True when the process was started, whether or not it later failed. */
    readonly launched: boolean;
    /** Exit code when the process finished; absent for a failed launch. */
    readonly code?: number;
    /** Combined stdout/stderr, or the launch error. */
    readonly message?: string;
}

export const NotepadiaRunService = Symbol('NotepadiaRunService');

/**
 * Launches a Run command on the user's own machine. Only bound in the Electron
 * (desktop) target; the browser target has no way to start a process and the
 * Run contribution degrades to URL opening plus an explanation.
 */
export interface NotepadiaRunService {
    run(command: string, cwd?: string): Promise<NotepadiaRunResult>;
}
