/**
 * Named Sessions (Notepad++ File > Save Session / Load Session): the open
 * document list (and the active one) is stored as a small JSON file in the
 * workspace and restored later. Dependency-free so the serialization rules
 * are unit-testable.
 */

export interface SessionData {
    /** Absolute file URIs of the documents to reopen, in tab order. */
    files: string[];
    /** Optional URI of the document that should become active after load. */
    activeFile?: string;
}

export const SESSION_EXTENSION = '.json';
export const SESSION_VERSION = 1;

/** Serialize a session to the on-disk JSON text. */
export function serializeSession(files: string[], activeFile?: string): string {
    const data: SessionData = {
        files: dedupeUriList(files),
        ...(activeFile ? { activeFile } : {})
    };
    return JSON.stringify({ version: SESSION_VERSION, ...data }, null, 2);
}

/**
 * Parse session JSON text into a validated SessionData; returns null when the
 * content is not a usable session file. Non-string entries are dropped, the
 * list is deduplicated, and an activeFile absent from the list is ignored
 * (without removing it from the data).
 */
export function parseSessionJson(text: string): SessionData | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return null;
    }
    if (typeof parsed !== 'object' || parsed === null) {
        return null;
    }
    const record = parsed as Record<string, unknown>;
    if (record.version !== SESSION_VERSION) {
        return null;
    }
    if (!Array.isArray(record.files)) {
        return null;
    }
    const files = dedupeUriList(record.files.filter((entry): entry is string => typeof entry === 'string'));
    if (files.length === 0) {
        return null;
    }
    const activeFile = typeof record.activeFile === 'string' ? record.activeFile : undefined;
    return activeFile && isUri(activeFile) ? { files, activeFile } : { files };
}

/** Turn any list of URIs/paths into a caller-independent deduplicated list. */
export function dedupeUriList(uris: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const uri of uris) {
        if (typeof uri !== 'string' || uri.length === 0) {
            continue;
        }
        if (seen.has(uri)) {
            continue;
        }
        seen.add(uri);
        out.push(uri);
    }
    return out;
}

/** Validate that a string looks like a file URI (the only kind we persist). */
export function isUri(value: string): boolean {
    return /^file:\/\//.test(value);
}