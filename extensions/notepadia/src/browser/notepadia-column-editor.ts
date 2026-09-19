import { inject, injectable } from '@theia/core/shared/inversify';
import * as monaco from '@theia/monaco-editor-core';
import {
    Command,
    CommandContribution,
    CommandRegistry
} from '@theia/core/lib/common/command';
import {
    MenuContribution,
    MenuModelRegistry
} from '@theia/core/lib/common/menu';
import { CommonMenus } from '@theia/core/lib/browser/common-menus';
import { AbstractDialog } from '@theia/core/lib/browser/dialogs';
import { Message } from '@theia/core/lib/browser/widgets';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';
import {
    ColumnEditorConfig,
    ColumnEditorMode,
    columnTextsFor
} from '../common/column-editor';

/**
 * Notepad++ style "Edit > Column Editor...": inserts text, sequential
 * numbers or a repeated/cycling text down the lines of the current
 * selection (including rectangular Alt+drag block selections).
 */
export namespace NotepadiaColumnEditorCommands {
    export const COLUMN_EDITOR: Command = {
        id: 'notepadia.columnEditor',
        label: 'Column Editor...'
    };
}

export { ColumnEditorConfig, ColumnEditorMode } from '../common/column-editor';

const DEFAULT_CONFIG: ColumnEditorConfig = {
    mode: 'text',
    text: '',
    initialNumber: 1,
    increment: 1,
    leadingZeros: false
};

class NotepadiaColumnEditorDialog extends AbstractDialog<ColumnEditorConfig | undefined> {
    protected readonly modeSelect: HTMLSelectElement;
    protected readonly textInput: HTMLInputElement;
    protected readonly initialInput: HTMLInputElement;
    protected readonly incrementInput: HTMLInputElement;
    protected readonly zerosCheckbox: HTMLInputElement;

    get value(): ColumnEditorConfig | undefined {
        const mode = (this.modeSelect.value || 'text') as ColumnEditorMode;
        const initialNumber = Number(this.initialInput.value);
        const increment = Number(this.incrementInput.value);
        return {
            mode,
            text: this.textInput.value,
            initialNumber: Number.isFinite(initialNumber) ? initialNumber : DEFAULT_CONFIG.initialNumber,
            increment: Number.isFinite(increment) ? increment : DEFAULT_CONFIG.increment,
            leadingZeros: this.zerosCheckbox.checked
        };
    }

    constructor() {
        super({ title: 'Edit > Column Editor...' });
        this.appendAcceptButton('Insert');
        this.appendCloseButton('Cancel');

        this.modeSelect = document.createElement('select');
        const textOption = document.createElement('option');
        textOption.value = 'text';
        textOption.textContent = 'Text to Insert';
        const numberOption = document.createElement('option');
        numberOption.value = 'number';
        numberOption.textContent = 'Number to Insert';
        const repeatedOption = document.createElement('option');
        repeatedOption.value = 'repeated';
        repeatedOption.textContent = 'Repeated text';
        this.modeSelect.append(textOption, numberOption, repeatedOption);

        this.textInput = document.createElement('input');
        this.textInput.type = 'text';
        this.textInput.value = '';

        this.initialInput = document.createElement('input');
        this.initialInput.type = 'number';
        this.initialInput.value = '1';
        this.initialInput.step = '1';

        this.incrementInput = document.createElement('input');
        this.incrementInput.type = 'number';
        this.incrementInput.value = '1';
        this.incrementInput.step = '1';

        this.zerosCheckbox = document.createElement('input');
        this.zerosCheckbox.type = 'checkbox';
        this.zerosCheckbox.checked = false;

        const row = (label: string, element: HTMLElement): HTMLElement => {
            const labelNode = document.createElement('label');
            labelNode.textContent = label;
            labelNode.style.display = 'block';
            labelNode.style.minWidth = '130px';
            const wrapper = document.createElement('div');
            wrapper.style.display = 'flex';
            wrapper.style.alignItems = 'center';
            wrapper.style.marginBottom = '6px';
            wrapper.append(labelNode, element);
            return wrapper;
        };

        const control = document.createElement('div');
        control.style.marginBottom = '10px';
        control.append(row('Color/type', this.modeSelect));
        control.append(row('Text to insert', this.textInput));
        control.append(row('Initial number', this.initialInput));
        control.append(row('Increase by', this.incrementInput));
        control.append(row('Leading zeros', this.zerosCheckbox));

        const hint = document.createElement('div');
        hint.style.opacity = '0.7';
        hint.style.fontSize = 'var(--theia-ui-font-size0)';
        hint.textContent = 'Applies to every line spanned by the current selection (or the cursor line if there is no selection).';
        this.contentNode.append(control, hint);

        this.modeSelect.addEventListener('change', () => this.updateVisiblity());
        this.updateVisiblity();
    }

    protected updateVisiblity(): void {
        const mode = this.modeSelect.value as ColumnEditorMode;
        const text = this.textInput.closest('div') as HTMLElement;
        const number = this.initialInput.closest('div') as HTMLElement;
        const increment = this.incrementInput.closest('div') as HTMLElement;
        const zeros = this.zerosCheckbox.closest('div') as HTMLElement;
        if (text) { text.style.display = mode === 'number' ? 'none' : ''; }
        if (number) { number.style.display = mode === 'number' ? '' : 'none'; }
        if (increment) { increment.style.display = mode === 'number' ? '' : 'none'; }
        if (zeros) { zeros.style.display = mode === 'number' ? '' : 'none'; }
    }

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        this.textInput.focus();
    }
}

@injectable()
export class NotepadiaColumnEditorContribution implements CommandContribution, MenuContribution {

    constructor(
        @inject(EditorManager) protected readonly editorManager: EditorManager
    ) { }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(NotepadiaColumnEditorCommands.COLUMN_EDITOR, {
            isEnabled: () => this.currentEditor() !== undefined,
            execute: () => this.openColumnEditor()
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        const editLineOperations = [...CommonMenus.EDIT, '4_notepadia-line-operations'];
        menus.registerMenuAction(editLineOperations, {
            commandId: NotepadiaColumnEditorCommands.COLUMN_EDITOR.id,
            label: 'Column Editor...',
            order: 'z'
        });
    }

    protected currentEditor(): MonacoEditor | undefined {
        const widget = this.editorManager.currentEditor;
        return widget ? MonacoEditor.get(widget) : undefined;
    }

    protected async openColumnEditor(): Promise<void> {
        const editor = this.currentEditor();
        const control = editor?.getControl();
        const model = control?.getModel();
        if (!editor || !control || !model) {
            return;
        }
        const dialog = new NotepadiaColumnEditorDialog();
        const config = await dialog.open();
        if (!config) {
            return;
        }
        this.insert(config);
    }

    protected insert(config: ColumnEditorConfig): void {
        const editor = this.currentEditor();
        const control = editor?.getControl();
        const model = control?.getModel();
        if (!editor || !control || !model) {
            return;
        }

        const selections = control.getSelections();
        if (!selections || selections.length === 0) {
            return;
        }

        // A rectangular (Alt+drag) block selection surfaces as multiple
        // single-line selections (one per row); anything else is handled as a
        // plain selection spanning from its start to its end line.
        const rows = new Map<number, number>();
        if (selections.length > 1) {
            for (const selection of selections) {
                const start = Math.min(selection.startColumn, selection.endColumn);
                rows.set(selection.startLineNumber, start);
            }
        } else {
            const selection = selections[0];
            const start = Math.min(selection.startColumn, selection.endColumn);
            for (let line = selection.startLineNumber; line <= selection.endLineNumber; line++) {
                // A final newline surfaces as an extra empty line; inserting
                // there would 'create' a line the user never selected.
                if (line === model.getLineCount() && model.getLineMaxColumn(line) === 1) {
                    continue;
                }
                rows.set(line, start);
            }
        }
        if (rows.size === 0) {
            return;
        }

        const operations: monaco.editor.IIdentifiedSingleEditOperation[] = [];
        const texts = columnTextsFor(config, rows.size);

        let index = 0;
        for (const [line, column] of Array.from(rows).sort((a, b) => a[0] - b[0])) {
            operations.push({
                range: new monaco.Range(line, column, line, column),
                text: texts[index++]
            });
        }

        control.pushUndoStop();
        control.executeEdits('notepadia.column-editor', operations);
        control.pushUndoStop();
        control.revealLineInCenter(rows.keys().next().value ?? 1);
    }
}