/**
 * Pure transformation of a Monaco content change into macro steps. Kept free
 * of Theia/Monaco imports so it runs under the Node test runner as well as in
 * the recording contribution.
 */

export type MacroStep =
    | { kind: 'type'; text: string }
    | { kind: 'delete'; count: number };

/**
 * A macro step records the *text* that landed (typing, pastes, Enter,
 * command-generated text) and how many characters were deleted (Backspace is
 * one delete per rangeLength, mirrored by the per-character deleteLeft replay).
 * A single edit can do both (the deleted text is replaced by new text), so
 * deletes are emitted before types.
 */
export function changeToSteps(rangeLength: number, text: string): MacroStep[] {
    const steps: MacroStep[] = [];
    if (rangeLength > 0) {
        steps.push({ kind: 'delete', count: rangeLength });
    }
    if (text.length > 0) {
        steps.push({ kind: 'type', text });
    }
    return steps;
}