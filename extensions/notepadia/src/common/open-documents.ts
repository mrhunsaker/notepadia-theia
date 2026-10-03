/**
 * Pure helpers shared by the two places Notepadia lists the open documents:
 * the View ▸ Document List panel and the Window menu / Windows... dialog.
 * Keeping the naming and sorting rules here means the two surfaces cannot
 * drift apart, and the rules are unit testable without a browser.
 */

export type DocumentSortKey = 'name' | 'path' | 'type';

export interface SortableDocument {
    name: string;
    path: string;
    type: string;
}

/**
 * The `Type` column of Notepad++'s Windows... dialog: the file extension
 * without its dot in lower case, or `Text` when the name carries no usable
 * extension (an untitled `new 1` buffer, for instance). A leading dot
 * (`.gitignore`) counts as a name, not an extension, which matches how
 * Notepad++ shows dotfiles.
 */
export function documentType(path: string): string {
    const base = path.split(/[\\/]/).pop() ?? '';
    const dot = base.lastIndexOf('.');
    if (dot <= 0 || dot === base.length - 1) {
        return 'Text';
    }
    return base.slice(dot + 1).toLocaleLowerCase();
}

/**
 * `1 notes.txt` - Notepad++ numbers the Window menu's documents from one. The
 * index is zero-based.
 */
export function documentMenuLabel(index: number, name: string): string {
    return `${index + 1} ${name}`;
}

/**
 * Sort a copy of `documents` by one column. `ascending` picks the direction;
 * the comparison is case-insensitive and falls back to the other columns, so
 * documents that share a name or a type still come out in a stable order
 * instead of depending on the input arrangement.
 */
export function sortDocuments<T extends SortableDocument>(
    documents: readonly T[],
    key: DocumentSortKey,
    ascending: boolean
): T[] {
    const factor = ascending ? 1 : -1;
    const columns: DocumentSortKey[] = [key, 'name', 'path', 'type'];
    return [...documents].sort((a, b) => {
        for (const column of columns) {
            const result = a[column].toLocaleLowerCase().localeCompare(b[column].toLocaleLowerCase());
            if (result !== 0) {
                return factor * result;
            }
        }
        return 0;
    });
}
