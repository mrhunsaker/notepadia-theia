import { inject, injectable, named } from '@theia/core/shared/inversify';
import { Widget } from '@theia/core/shared/@lumino/widgets';
import { FrontendApplication } from '@theia/core/lib/browser/frontend-application';
import { WidgetManager } from '@theia/core/lib/browser/widget-manager';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { NavigatableWidget } from '@theia/core/lib/browser/navigatable-types';
import { LocalStorageService } from '@theia/core/lib/browser/storage-service';
import {
    ShellLayoutRestorer,
    ShellLayoutTransformer
} from '@theia/core/lib/browser/shell/shell-layout-restorer';
import { ILogger } from '@theia/core/lib/common/logger';
import { PreferenceService } from '@theia/core/lib/common/preferences';
import { NOTEPADIA_SESSION_RESTORE_PREFERENCE } from './notepadia-preference-contribution';

/** Layout entries rejected by a Don't Save choice, consumed on the next launch. */
export const NOTEPADIA_DISCARDED_LAYOUT_KEY = 'notepadia.session.discardedLayout';

/** Backups rejected by a Don't Save choice, consumed on the next launch. */
export const NOTEPADIA_DISCARDED_BACKUPS_KEY = 'notepadia.backup.discarded';

/** Stable identity used by both the layout and backup discard lists. */
export function notepadiaWidgetKey(widget: Widget): string {
    return NavigatableWidget.getUri(widget)?.toString() || widget.id;
}

/**
 * Removes tabs that the user explicitly discarded from an inflated layout.
 *
 * The layout is stored before the shutdown contributions run, so a dirty tab
 * that the user abandoned with Don't Save is still present in the stored
 * layout. `NotepadiaBackupContribution` records those keys synchronously while
 * stopping; this transformer applies them before the shell mounts the layout.
 */
@injectable()
export class NotepadiaSessionLayoutTransformer implements ShellLayoutTransformer {

    protected discarded = new Set<string>();

    setDiscarded(keys: Iterable<string>): void {
        this.discarded = new Set(keys);
    }

    transformLayoutOnRestore(layoutData: ApplicationShell.LayoutData): void {
        if (this.discarded.size === 0) {
            return;
        }
        const removedIds = new Set<string>();
        const visit = (node: unknown): void => {
            if (!node || typeof node !== 'object' || node instanceof Widget) {
                return;
            }
            if (Array.isArray(node)) {
                for (const item of node) {
                    visit(item);
                }
                return;
            }
            const record = node as Record<string, unknown>;
            if (Array.isArray(record.widgets)) {
                const kept: Widget[] = [];
                for (const value of record.widgets) {
                    if (value instanceof Widget && this.discarded.has(notepadiaWidgetKey(value))) {
                        removedIds.add(value.id);
                    } else {
                        kept.push(value as Widget);
                    }
                }
                record.widgets = kept;
                const currentIndex = record.currentIndex;
                if (typeof currentIndex === 'number') {
                    record.currentIndex = Math.max(0, Math.min(currentIndex, kept.length - 1));
                }
            }
            for (const [key, value] of Object.entries(record)) {
                if (key !== 'widgets') {
                    visit(value);
                }
            }
        };
        visit(layoutData);
        if (layoutData.activeWidgetId && removedIds.has(layoutData.activeWidgetId)) {
            layoutData.activeWidgetId = undefined;
        }
    }
}

/**
 * Makes the shell layout global instead of workspace-scoped and gates restore
 * on `notepadia.session.restore`.
 *
 * `LocalStorageService` is injected into the base restorer deliberately: the
 * default `WorkspaceStorageService` keys the layout by the workspace URI, so a
 * single opened file gets its own layout and that layout is then reopened on
 * the next launch. The global key stores only the tabs that were still open at
 * the last shutdown.
 */
@injectable()
export class NotepadiaShellLayoutRestorer extends ShellLayoutRestorer {

    constructor(
        @inject(WidgetManager) widgetManager: WidgetManager,
        @inject(ILogger) @named('core:ShellLayoutRestorer') logger: ILogger,
        @inject(LocalStorageService) storageService: LocalStorageService,
        @inject(PreferenceService) protected readonly preferences: PreferenceService,
        @inject(NotepadiaSessionLayoutTransformer) protected readonly transformer: NotepadiaSessionLayoutTransformer
    ) {
        super(widgetManager, logger, storageService);
    }

    override async restoreLayout(app: FrontendApplication): Promise<boolean> {
        await this.preferences.ready;
        if (!this.preferences.get<boolean>(NOTEPADIA_SESSION_RESTORE_PREFERENCE, true)) {
            return false;
        }
        const discarded = await this.storageService.getData<string[]>(NOTEPADIA_DISCARDED_LAYOUT_KEY);
        if (discarded?.length) {
            this.transformer.setDiscarded(discarded);
            void this.storageService.setData(NOTEPADIA_DISCARDED_LAYOUT_KEY, undefined);
        }
        return super.restoreLayout(app);
    }
}
