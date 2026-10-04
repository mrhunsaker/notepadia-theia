import { injectable } from '@theia/core/shared/inversify';
import { spawn } from 'child_process';
import { NotepadiaRunResult, NotepadiaRunService } from '../common/notepadia-run-protocol';

const MAX_OUTPUT = 64 * 1024;
const TIMEOUT_MS = 30000;

/**
 * Electron-main half of the Run menu. It is the only place a Run command can
 * actually start a program; the renderer reaches it over the existing
 * Electron IPC channel. The frontend won't call this unless the user has turned
 * on `notepadia.run.allowProcessLaunch`, because running arbitrary commands is
 * a real security surface.
 */
@injectable()
export class NotepadiaRunServer implements NotepadiaRunService {

    run(command: string, cwd?: string): Promise<NotepadiaRunResult> {
        return new Promise<NotepadiaRunResult>(resolve => {
            let settled = false;
            let output = '';
            const finish = (result: NotepadiaRunResult): void => {
                if (!settled) {
                    settled = true;
                    resolve(result);
                }
            };
            // The timeout is about reporting back to the renderer, not about the
            // process: a command like `npm start` is meant to keep running after
            // the dialog is gone, so the child is deliberately left alone.
            const timer = setTimeout(
                () => finish({ launched: true, message: output.trim() || 'The command is still running.' }),
                TIMEOUT_MS);
            try {
                const child = spawn(command, { shell: true, cwd: cwd || undefined, windowsHide: true });
                const collect = (chunk: unknown): void => {
                    if (output.length < MAX_OUTPUT) {
                        output += String(chunk);
                    }
                };
                child.stdout?.on('data', collect);
                child.stderr?.on('data', collect);
                child.on('error', error => {
                    clearTimeout(timer);
                    finish({ launched: false, message: error.message });
                });
                child.on('close', code => {
                    clearTimeout(timer);
                    finish({ launched: true, code: code ?? undefined, message: output.trim() || undefined });
                });
            } catch (error) {
                clearTimeout(timer);
                finish({ launched: false, message: error instanceof Error ? error.message : String(error) });
            }
        });
    }
}
