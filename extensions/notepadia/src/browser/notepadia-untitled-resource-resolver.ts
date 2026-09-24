import { injectable } from '@theia/core/shared/inversify';
import { URI } from '@theia/core/lib/common/uri';
import { UNTITLED_SCHEME, UntitledResourceResolver } from '@theia/core/lib/common/resource';

/**
 * Names new unsaved documents `new 1`, `new 2`, ... like Notepad++ instead of
 * Theia's default `Untitled-1`, `Untitled-2`, ... The files carry no extension,
 * so the editor opens them as plain text.
 */
@injectable()
export class NotepadiaUntitledResourceResolver extends UntitledResourceResolver {
    override createUntitledURI(extension?: string, parent?: URI): URI {
        let counter = 1;
        let untitledUri: URI;
        do {
            untitledUri = parent
                ? parent.resolve(`new ${counter}`).withScheme(UNTITLED_SCHEME)
                : new URI().resolve(`new ${counter}`).withScheme(UNTITLED_SCHEME);
            counter++;
        } while (this.has(untitledUri));
        return untitledUri;
    }
}