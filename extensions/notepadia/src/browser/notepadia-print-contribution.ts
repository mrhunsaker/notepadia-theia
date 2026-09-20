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

function printWindowHtml(fileName: string, documentText: string): string {
    const lines = documentText.split(/\r?\n/);
    const rows = lines.map((line, index) => {
        const lineNumber = index + 1;
        return `<tr><td class="ln">${lineNumber}</td><td class="code">${escapeHtml(line) || '&nbsp;'}</td></tr>`;
    }).join('\n');
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
<table>${rows}</table>
</body>
</html>`;
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