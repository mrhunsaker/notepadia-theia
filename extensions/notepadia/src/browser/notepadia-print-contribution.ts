import { inject, injectable } from '@theia/core/shared/inversify';
import { Command, CommandContribution, CommandRegistry, MenuContribution, MenuModelRegistry } from '@theia/core/lib/common';
import { CommonMenus } from '@theia/core/lib/browser';
import { MessageService } from '@theia/core/lib/common/message-service';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';

/**
 * Notepad++ style printing, entirely in the browser: the document is rendered
 * into a dedicated print window (with line numbers and the file name header)
 * and handed to the OS print dialog via window.print(). A plain-text version
 * is also offered from the View menu.
 */
export namespace NotepadiaPrintCommands {
    export const PRINT: Command = { id: 'notepadia.print', label: 'Print' };
    export const PRINT_PREVIEW: Command = { id: 'notepadia.print.preview', label: 'Print Preview...' };
}

function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function printRows(documentText: string): string {
    return documentText.split(/\r?\n/).map((line, index) => {
        const lineNumber = index + 1;
        return `<tr><td class="ln">${lineNumber}</td><td class="code">${escapeHtml(line) || '&nbsp;'}</td></tr>`;
    }).join('\n');
}

function printWindowHtml(fileName: string, documentText: string): string {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(fileName)}</title>
<style>
  body { font-family: 'SF Mono', Consolas, 'Liberation Mono', monospace; color: #000; margin: 24px; }
  h1 { font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; margin: 0 0 12px; }
  table { border-collapse: collapse; width: 100%; }
  td { vertical-align: top; padding: 0; }
  td.ln { width: 1%; color: #999; padding-right: 12px; text-align: right; user-select: none; -webkit-user-select: none; }
  td.code { white-space: pre-wrap; word-break: break-all; }
  .noprint { font-family: Arial, sans-serif; text-align: right; margin-bottom: 8px; }
  button { padding: 6px 16px; font-size: 13px; }
  @media print { .noprint { display: none; } }
</style>
</head>
<body>
<div class="noprint"><button onclick="window.print()">Print</button></div>
<h1>${escapeHtml(fileName)}</h1>
<table>${printRows(documentText)}</table>
</body>
</html>`;
}

const PRINT_CONTAINER_ID = 'notepadia-print';
const PRINT_STYLE_ID = 'notepadia-print-style';

/**
 * The stylesheet for the Electron in-place print, scoped under
 * `#notepadia-print` so it cannot restyle the workbench and hidden on screen
 * so nothing flashes before the dialog opens.
 */
function scopedPrintStyle(): string {
    return `<style id="${PRINT_STYLE_ID}">
  #${PRINT_CONTAINER_ID} { display: none; }
  @media print {
    body.notepadia-printing > *:not(#${PRINT_CONTAINER_ID}) { display: none !important; }
    body.notepadia-printing { background: #fff !important; }
    #${PRINT_CONTAINER_ID} { display: block !important; font-family: 'SF Mono', Consolas, 'Liberation Mono', monospace; color: #000; margin: 24px; }
    #${PRINT_CONTAINER_ID} h1 { font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; margin: 0 0 12px; }
    #${PRINT_CONTAINER_ID} table { border-collapse: collapse; width: 100%; }
    #${PRINT_CONTAINER_ID} td { vertical-align: top; padding: 0; }
    #${PRINT_CONTAINER_ID} td.ln { width: 1%; color: #999; padding-right: 12px; text-align: right; }
    #${PRINT_CONTAINER_ID} td.code { white-space: pre-wrap; word-break: break-all; }
  }
</style>`;
}

function scopedPrintBody(fileName: string, documentText: string): string {
    return `<div id="${PRINT_CONTAINER_ID}">
<h1>${escapeHtml(fileName)}</h1>
<table>${printRows(documentText)}</table>
</div>`;
}

/**
 * True in the Electron app, where `window.open` is intercepted by the core
 * `setWindowOpenHandler` (it only allows Theia secondary windows and http(s)
 * links, and otherwise pops an "Open link in the system handler?" box), so the
 * separate-print-window route is unusable and the page prints itself through
 * `window.print()` - the renderer's handle on `webContents.print`.
 */
function printsInPlace(): boolean {
    return (window as unknown as { electronTheiaCore?: { useNativeElements?: boolean } }).electronTheiaCore?.useNativeElements === true;
}

@injectable()
export class NotepadiaPrintContribution implements CommandContribution, MenuContribution {

    constructor(
        @inject(EditorManager) protected readonly editorManager: EditorManager,
        @inject(MessageService) protected readonly messageService: MessageService
    ) { }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(NotepadiaPrintCommands.PRINT, {
            isEnabled: () => this.currentDocument() !== undefined,
            execute: () => this.openPrintWindow(false)
        });
        commands.registerCommand(NotepadiaPrintCommands.PRINT_PREVIEW, {
            isEnabled: () => this.currentDocument() !== undefined,
            execute: () => this.openPrintWindow(true)
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction([...CommonMenus.FILE], {
            commandId: NotepadiaPrintCommands.PRINT.id,
            label: 'Print',
            order: '0l'
        });
        menus.registerMenuAction([...CommonMenus.FILE], {
            commandId: NotepadiaPrintCommands.PRINT_PREVIEW.id,
            label: 'Print Preview...',
            order: '0m'
        });
    }

    protected async openPrintWindow(preview: boolean): Promise<void> {
        const doc = this.currentDocument();
        if (!doc) {
            return;
        }
        if (printsInPlace()) {
            this.printInPlace(doc);
            return;
        }
        const windowRef = window.open('', '_blank', 'width=820,height=1000');
        if (!windowRef) {
            void this.messageService.warn('Print popup was blocked - allow popups for this site and try again.');
            return;
        }
        const html = printWindowHtml(doc.fileName, doc.documentText);
        windowRef.document.open();
        windowRef.document.write(html);
        windowRef.document.close();
        windowRef.focus();
        if (!preview) {
            windowRef.print();
        }
    }

    /**
     * Electron route: the print body is injected into this page and the window
     * prints itself, which is the renderer's path to the native print dialog
     * (`webContents.print`). The generated content is exactly the browser
     * route's, scoped so it cannot restyle the workbench, and removed once the
     * dialog closes. `Print Preview...` maps here too: the system print dialog
     * is itself the preview, and cancelling prints nothing.
     */
    protected printInPlace(doc: { fileName: string; documentText: string }): void {
        const existing = document.getElementById(PRINT_CONTAINER_ID);
        if (existing) {
            existing.remove();
        }
        const existingStyle = document.getElementById(PRINT_STYLE_ID);
        if (existingStyle) {
            existingStyle.remove();
        }
        document.head.insertAdjacentHTML('beforeend', scopedPrintStyle());
        document.body.insertAdjacentHTML('beforeend', scopedPrintBody(doc.fileName, doc.documentText));
        document.body.classList.add('notepadia-printing');

        const cleanup = (): void => {
            window.removeEventListener('afterprint', cleanup);
            document.body.classList.remove('notepadia-printing');
            document.getElementById(PRINT_CONTAINER_ID)?.remove();
            document.getElementById(PRINT_STYLE_ID)?.remove();
        };
        window.addEventListener('afterprint', cleanup);

        // Let the injected layout settle before handing the page to the OS.
        window.requestAnimationFrame(() => {
            window.print();
            // Some platforms do not fire `afterprint`; keep the DOM from being
            // left in print state for the rest of the session.
            window.setTimeout(cleanup, 60000);
        });
    }

    protected currentDocument(): { fileName: string; documentText: string } | undefined {
        const editor = this.editorManager.currentEditor;
        const monaco = editor ? MonacoEditor.get(editor) : undefined;
        const model = monaco?.getControl()?.getModel();
        if (!model) {
            return undefined;
        }
        const path = model.uri.path || '';
        return {
            fileName: path.split('/').pop() || 'Untitled',
            documentText: model.getValue()
        };
    }
}