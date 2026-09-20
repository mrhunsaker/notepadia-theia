import { inject, injectable } from '@theia/core/shared/inversify';
import { Message } from '@theia/core/shared/@lumino/messaging';
import { BaseWidget } from '@theia/core/lib/browser';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';

export const NOTEPADIA_CHARACTER_PANEL_ID = 'notepadia.characterPanel';

interface CharacterCategory {
    title: string;
    characters: string[];
}

const CATEGORIES: CharacterCategory[] = [
    {
        title: 'Arrows',
        characters: '← ↑ → ↓ ↔ ↕ ↖ ↗ ↘ ↙ ↚ ↛ ↜ ↝ ↞ ↟ ↠ ↡ ↢ ↣ ↤ ↥ ↦ ↧ ↨ ↩ ↪ ↫ ↬ ↭ ↮ ↯ ↰ ↱ ↲ ↳ ↴ ↵ ↶ ↷ ↸ ↹ ↺ ↻ ↼ ↽ ↾ ↿ ⇀ ⇁ ⇂ ⇃ ⇄ ⇅ ⇆ ⇇ ⇈ ⇉ ⇊ ⇋ ⇌ ⇍ ⇎ ⇏ ⇐ ⇑ ⇒ ⇓ ⇔ ⇕ ⇖ ⇗ ⇘ ⇙ ⇚ ⇛'.split(/\s+/)
    },
    {
        title: 'Box Drawing',
        characters: '│ ┃ ┆ ┊ ╎ ╏ ┌ ┍ ┎ ┏ ┐ ┑ ┒ ┓ └ ┕ ┖ ┗ ┘ ┙ ┚ ┛ ├ ┝ ┞ ┟ ┠ ┡ ┢ ┣ ┤ ┥ ┦ ┧ ┨ ┩ ┪ ┫ ┬ ┭ ┮ ┯ ┰ ┱ ┲ ┳ ┴ ┵ ┶ ┷ ┸ ┹ ┺ ┻ ┼ ┽ ┾ ┿ ╀ ╁ ╂ ╃ ╄ ╅ ╆ ╇ ╈ ╉ ╊ ╋ ═ ║ ╒ ╓ ╔ ╕ ╖ ╗ ╘ ╙ ╚ ╛ ╜ ╝ ╞ ╟ ╠ ╡ ╢ ╣ ╤ ╥ ╦ ╧ ╨ ╩ ╪ ╫ ╬'.split(/\s+/)
    },
    {
        title: 'Mathematical',
        characters: '× ÷ ± − ∓ ≤ ≥ ≠ ≈ ≡ ∞ √ ∛ ∜ ∑ ∏ ∫ ∬ ∂ ∇ ∆ ∝ ∴ ∵ ⊕ ⊗ ⊖ ⊘ ⊙ ⊚ ⊛ ⊞ ⊟ ⊠ ⊢ ⊣ ⊤ ⊥ ⋅ ⋮ ⋯ ⋱ ∧ ∨ ¬ → ⇒ ∀ ∃ ∈ ∉ ∅'.split(/\s+/)
    },
    {
        title: 'Greek',
        characters: 'Α Β Γ Δ Ε Ζ Η Θ Ι Κ Λ Μ Ν Ξ Ο Π Ρ Σ Τ Υ Φ Χ Ψ Ω α β γ δ ε ζ η θ ι κ λ μ ν ξ ο π ρ σ τ υ φ χ ψ ω'.split(/\s+/)
    },
    {
        title: 'Currency',
        characters: '€ £ ¥ ¢ ₽ ₹ ₩ ₪ ₫ ₭ ₮ ₦ ₧ ₨ ₰ ₱ ₲ ₳ ₴ ₵'.split(/\s+/)
    },
    {
        title: 'Typography',
        characters: '" " \' \' „ " \' \' … ‹ › « » – — • · © ® ™ ° ± ℅ ¶ § † ‡'.split(/\s+/)
    },
    {
        title: 'Misc',
        characters: '☀ ☁ ☂ ☃ ★ ☆ ☎ ☏ ☚ ☛ ☜ ☝ ☞ ☟ ☠ ☢ ☣ ♠ ♣ ♥ ♦ ♪ ♫ ✓ ✔ ✗ ✘ ✕ ✖ ✡ ⚡ ✨ ❗ ❓'.split(/\s+/)
    }
];

@injectable()
export class NotepadiaCharacterPanelWidget extends BaseWidget {

    static readonly ID = NOTEPADIA_CHARACTER_PANEL_ID;
    static readonly LABEL = 'Character Panel';

    protected static readonly STYLE_ID = 'notepadia-character-panel-style';
    protected static readonly STYLE_TEXT = `
.notepadia-character-panel { display: flex; flex-direction: column; min-width: 0; min-height: 0; padding: 4px 8px 8px; overflow-y: auto; }
.notepadia-character-panel-details { padding: 2px 0 6px; }
.notepadia-character-panel-summary { cursor: pointer; color: var(--theia-foreground); font-weight: 600; padding: 2px 0; user-select: none; }
.notepadia-character-panel-grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 2px; padding: 2px 0 6px; }
.notepadia-character-panel-button { display: flex; align-items: center; justify-content: center; min-width: 0; padding: 3px 0; background: var(--theia-button-secondaryBackground, transparent); color: var(--theia-button-secondaryForeground, var(--theia-foreground)); border: 1px solid var(--theia-contrastBorder, transparent); border-radius: 2px; cursor: pointer; font-size: var(--theia-ui-font-size1, 12px); }
.notepadia-character-panel-button:hover { background: var(--theia-button-secondaryHoverBackground, var(--theia-list-hoverBackground)); }
`;

    constructor(@inject(EditorManager) protected readonly editorManager: EditorManager) {
        super();
        this.id = NotepadiaCharacterPanelWidget.ID;
        this.title.label = NotepadiaCharacterPanelWidget.LABEL;
        this.title.caption = 'Insert special characters at the cursor';
        this.title.closable = true;
        this.title.iconClass = 'codicon codicon-symbol-misc';
        this.addClass('notepadia-character-panel');
        this.injectStyle();

        for (const category of CATEGORIES) {
            const details = document.createElement('details');
            details.className = 'notepadia-character-panel-details';
            details.open = true;

            const summary = document.createElement('summary');
            summary.className = 'notepadia-character-panel-summary';
            summary.textContent = category.title;
            details.appendChild(summary);

            const grid = document.createElement('div');
            grid.className = 'notepadia-character-panel-grid';
            for (const character of category.characters) {
                const button = document.createElement('button');
                button.className = 'notepadia-character-panel-button';
                button.textContent = character;
                button.title = `Insert ${character}`;
                button.addEventListener('click', () => this.insert(character));
                grid.appendChild(button);
            }
            details.appendChild(grid);
            this.node.appendChild(details);
        }
    }

    protected onAfterShow(msg: Message): void {
        super.onAfterShow(msg);
        const first = this.node.querySelector('button');
        if (first) {
            first.focus();
        }
    }

    protected insert(character: string): void {
        const editor = this.editorManager.currentEditor;
        const monaco = editor ? MonacoEditor.get(editor) : undefined;
        const control = monaco?.getControl();
        if (!control) {
            return;
        }
        const selections = control.getSelections() || [];
        const edits = selections.map(selection => ({ range: selection, text: character }));
        control.pushUndoStop();
        control.executeEdits('notepadia.characterPanel', edits);
        control.pushUndoStop();
        control.focus();
    }

    protected injectStyle(): void {
        if (document.getElementById(NotepadiaCharacterPanelWidget.STYLE_ID)) {
            return;
        }
        const style = document.createElement('style');
        style.id = NotepadiaCharacterPanelWidget.STYLE_ID;
        style.textContent = NotepadiaCharacterPanelWidget.STYLE_TEXT;
        document.head.appendChild(style);
    }
}