/**
 * Pure logic behind the "Edit > Column Editor..." dialog. Dependency-free so
 * it runs both in the browser contribution and under the Node test runner.
 */

export type ColumnEditorMode = 'text' | 'number' | 'repeated';

export interface ColumnEditorConfig {
    mode: ColumnEditorMode;
    text: string;
    initialNumber: number;
    increment: number;
    leadingZeros: boolean;
}

/**
 * How many digits to pad sequential numbers to. Zero when leading zeros are
 * off, or when only negative numbers would need padding (a leading zero on a
 * minus sign is meaningless).
 */
export function computePadWidth(
    initialNumber: number,
    increment: number,
    count: number,
    leadingZeros: boolean
): number {
    if (!leadingZeros || count <= 0) {
        return 0;
    }
    const last = initialNumber + (increment * (count - 1));
    return Math.max(
        String(Math.max(0, initialNumber)).length,
        String(Math.max(0, last)).length
    );
}

/**
 * The text to insert on one row of the column editor. `number` is the value
 * with the running per-row increment already applied; `index` is the 0-based
 * row index used to cycle "repeated" text.
 */
export function textForIndex(
    config: ColumnEditorConfig,
    index: number,
    number: number,
    padWidth: number
): string {
    switch (config.mode) {
        case 'number': {
            const value = String(number);
            return padWidth > 0 ? value.padStart(padWidth, '0') : value;
        }
        case 'repeated': {
            if (!config.text) {
                return '';
            }
            return config.text[index % config.text.length];
        }
        default:
            return config.text;
    }
}

/** All the texts the column editor inserts for a block of `count` rows. */
export function columnTextsFor(config: ColumnEditorConfig, count: number): string[] {
    const padWidth = computePadWidth(config.initialNumber, config.increment, count, config.leadingZeros);
    const out: string[] = [];
    let number = config.initialNumber;
    for (let index = 0; index < count; index++) {
        out.push(textForIndex(config, index, number, padWidth));
        number += config.increment;
    }
    return out;
}