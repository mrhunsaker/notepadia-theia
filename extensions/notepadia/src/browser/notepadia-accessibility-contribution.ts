import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { injectable } from '@theia/core/shared/inversify';

/**
 * Repairs the parts of the workbench chrome that the shell leaves unusable by
 * keyboard and screen reader, and gives the editor a way out of the keyboard.
 *
 * Three defects are worked around here, all of them in the upstream shell
 * rather than in Notepadia code, and each was found by measuring the running
 * app rather than by reading the shell:
 *
 * 1. Lumino renders tab titles as bare <li> elements inside a <ul> that
 *    Theia marks `role="tablist"`, but only the title of the current tab gets
 *    `role="tab"`. The list role on the parent cancels the implicit list
 *    semantics of the <li>, so axe reports `aria-required-children`
 *    (critical) and `listitem` (serious), and no document tab is reachable by
 *    Tab except the single one Theia happens to mark. Marking every title as
 *    a tab, with the current one as the single tab stop, clears both
 *    violations and puts the open-document list in the tab order.
 *
 * 2. Theia's status bar puts an `aria-label` on roleless <div>s, which
 *    `aria-prohibited-attr` (serious) forbids. The editor language status item
 *    makes it worse: its label is assembled from the unrendered codicon token
 *    and a React node, so it is announced as the literal text
 *    "$(bracket), [object HTMLDivElement]". The container becomes one
 *    focusable group, so the document information can be reached and read from
 *    the keyboard, and labels carrying codicon or object noise are dropped
 *    rather than announced.
 *
 * 3. Monaco binds Tab to insert a tab, so the editor has no way out: every
 *    further Tab re-enters the editor and a keyboard user is trapped in it.
 *    Escape followed by Tab - the sequence VS Code uses - moves focus to the
 *    next stop instead, which keeps Tab-as-indent for typing while still
 *    letting a keyboard user leave.
 *
 * The repairs are attribute-level and idempotent, so the shell stays free to
 * re-render at any time; they can be deleted when the upstream shell stops
 * producing these shapes.
 */
@injectable()
export class NotepadiaAccessibilityContribution implements FrontendApplicationContribution {

    /**
     * How long after Escape a Tab still leaves the editor instead of inserting
     * a tab: long enough for the second key to be deliberate, short enough
     * that an unrelated Tab later is not swallowed.
     */
    protected static readonly ESCAPE_GRACE_MS = 1500;

    /**
     * Selector for the elements a Tab may land on. Elements with a negative
     * tabindex are excluded because the shell uses those for programmatic
     * focus and for the measuring copies Lumino keeps for tab overflow.
     */
    protected static readonly FOCUSABLE = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex^="-"])'
    ].join(', ');

    protected escapedAt = 0;
    protected repairTimer: number | undefined;

    onStart(): void {
        // Capture phase on the window: Monaco registers its own key handling on
        // the bubble phase of the same window, so a Tab that is meant to move
        // focus is still ours to cancel by the time it would be handled.
        window.addEventListener('keydown', event => this.onKeyDown(event), true);
        this.repairChrome();
        this.observeChrome();
    }

    protected onKeyDown(event: KeyboardEvent): void {
        const target = event.target as HTMLElement | null;
        const editor = target?.closest('.monaco-editor');
        if (!editor) {
            return;
        }
        if (event.key === 'Escape') {
            this.escapedAt = Date.now();
            return;
        }
        const grace = NotepadiaAccessibilityContribution.ESCAPE_GRACE_MS;
        if (event.key !== 'Tab' || Date.now() - this.escapedAt > grace) {
            return;
        }
        // One-shot: only the Tab that follows the Escape leaves the editor.
        this.escapedAt = 0;
        event.preventDefault();
        event.stopPropagation();
        this.findFocusableNeighbour(editor, event.shiftKey ? -1 : 1)?.focus();
    }

    /**
     * The next (or previous) element in document order that a Tab would reach,
     * searching from the editor that currently holds focus. With nothing after
     * the editor the walk wraps to the first stop, which is where a Tab from
     * the last stop would land anyway.
     */
    protected findFocusableNeighbour(from: Element, step: number): HTMLElement | undefined {
        const candidates = Array.from(document.querySelectorAll<HTMLElement>(NotepadiaAccessibilityContribution.FOCUSABLE))
            .filter(element => element.tabIndex >= 0 && (element.offsetWidth > 0 || element.offsetHeight > 0));
        if (candidates.length === 0) {
            return undefined;
        }
        let index = -1;
        for (let i = 0; i < candidates.length; i++) {
            if (candidates[i] === from || from.contains(candidates[i])) {
                index = i;
                break;
            }
        }
        const next = (index + step + candidates.length) % candidates.length;
        return candidates[next];
    }

    /**
     * The shell adds and re-renders tab titles and status bar entries as the
     * user works, and the repairs are attribute writes, so a child-list
     * observer re-applies them after each change rather than once at startup.
     */
    protected observeChrome(): void {
        const observer = new MutationObserver(() => this.scheduleRepair());
        observer.observe(document.body, { childList: true, subtree: true });
    }

    protected scheduleRepair(): void {
        if (this.repairTimer !== undefined) {
            return;
        }
        this.repairTimer = window.setTimeout(() => {
            this.repairTimer = undefined;
            this.repairChrome();
        }, 50);
    }

    protected repairChrome(): void {
        this.repairTabBars();
        this.repairMenus();
        this.repairStatusBar();
    }

    protected repairTabBars(): void {
        document.querySelectorAll('.lm-TabBar-content').forEach(content => {
            this.setAttribute(content, 'role', 'tablist');
        });
        document.querySelectorAll('.lm-TabBar-content > .lm-TabBar-tab').forEach(tab => {
            const current = tab.classList.contains('lm-mod-current');
            this.setAttribute(tab, 'role', 'tab');
            this.setAttribute(tab, 'aria-selected', String(current));
            this.setAttribute(tab, 'tabindex', current ? '0' : '-1');
        });
    }

    /**
     * Lumino marks the items of a submenu with `role="presentation"`, which
     * leaves `role="menu"` with no valid children at all: axe reports
     * `aria-required-children` (critical) plus `listitem` (serious) on each one.
     * The items become `menuitem`s, and the separators - which carry no role of
     * their own and cannot take one without demanding `aria-valuenow` - are
     * hidden from the tree instead, so the menu keeps only children its role
     * allows. Menus are the app's primary navigation, so this state matters as
     * much as the default layout.
     */
    protected repairMenus(): void {
        document.querySelectorAll('.lm-Menu-content > li').forEach(item => {
            if (item.getAttribute('data-type') === 'separator') {
                this.setAttribute(item, 'aria-hidden', 'true');
                return;
            }
            const role = item.getAttribute('role');
            if (role === null || role === 'presentation') {
                this.setAttribute(item, 'role', 'menuitem');
            }
        });
    }

    protected repairStatusBar(): void {
        const statusBar = document.querySelector('#theia-statusBar');
        if (!statusBar) {
            return;
        }
        this.setAttribute(statusBar, 'role', 'group');
        this.setAttribute(statusBar, 'aria-label', 'Status bar');
        this.setAttribute(statusBar, 'tabindex', '0');
        statusBar.querySelectorAll('[aria-label]').forEach(element => {
            const label = element.getAttribute('aria-label') ?? '';
            if (/\$\(|\[object/.test(label)) {
                element.removeAttribute('aria-label');
            }
        });
    }

    protected setAttribute(element: Element, name: string, value: string): void {
        if (element.getAttribute(name) !== value) {
            element.setAttribute(name, value);
        }
    }
}