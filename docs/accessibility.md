# Accessibility

Notepadia is a Notepad++ work-alike, and Notepad++ is a keyboard-first editor.
This page records what the app does today for people who drive it with a
keyboard or a screen reader, what it does **not** do yet, and how to report a
problem. It is written from measurements of the running app, not from the
source: every claim below is checked by `e2e/a11y.cjs` or
`theme-contrast.test.cjs`, so if the app regresses, this page goes with it.

## Keyboard

The workbench is reachable with Tab alone, in this order:

| Stop | How it behaves |
| --- | --- |
| Menu bar | One stop for the whole bar, as in Notepad++. Left and Right move between `File`, `Edit`, … and Enter or Down opens the menu. |
| Toolbar | One stop, with Left and Right moving between buttons. A button that cannot act right now keeps `aria-disabled` and stays in the ring, so focus never skips past it. |
| Document tabs | One stop for the open documents, with Left and Right moving between them. The current tab is the only stop in the ring; the others are reached with the arrow keys. |
| Editor | The text itself. Tab inserts a tab, exactly as Notepad++ does. |
| Status bar | One stop carrying the line, column, selection, length, encoding and line-ending information. |

### Escape, then Tab, leaves the editor

Monaco binds Tab to insert a tab, so by itself Tab never leaves the editor.
Press **Escape** and then **Tab** to move to the next stop instead, and
**Escape** then **Shift+Tab** to move back. This is the same escape hatch
VS Code uses, and it is implemented in
`notepadia-accessibility-contribution.ts`. Escape on its own keeps all of its
usual editor meanings, so the sequence costs nothing.

Every stop in the ring has a non-empty accessible name, checked through
Chromium's own accessibility tree with `page.accessibility.snapshot()`.

## Screen readers

Verified automatically against the accessibility tree:

- The editor is exposed as `role="code"` with a named text area
  (`aria-label="Editor content"`), so a screen reader announces the document
  rather than an anonymous edit box.
- Menu bar items, toolbar buttons, document tabs and the status bar all carry
  accessible names.
- Menus, tab bars and the status bar report their roles correctly.

**Not yet verified with a real screen reader.** NVDA on Windows and Orca on
Linux both need a human, a synthesised speech mode and a session that also
reads the packaged desktop app; none of that can be faked from a headless
browser run. Until someone records a session, treat screen reader support as
"structurally correct, unconfirmed in practice". If you run one, please open an
issue with what you found.

Monaco's own accessibility help, <kbd>Alt</kbd>+<kbd>F1</kbd>, is **not**
available. Theia 1.75 does not register the command, so pressing it does
nothing. This is an upstream gap, not a Notepadia choice, and the e2e suite
asserts the current behaviour so the gap stays visible instead of quietly
being assumed to work.

## Automated checks

`e2e/a11y.cjs` runs in CI and fails the build on:

- any serious or critical [axe-core](https://github.com/dequelabs/axe-core)
  violation in the default layout, with a menu open, with the Find dialog open,
  and with each of the four panels (Document Map, Document List, Character
  Panel, Clipboard History) open;
- a stop in the tab ring that has no accessible name;
- the editor becoming a keyboard trap;
- Tab failing to indent in the editor, which is the behaviour Escape+Tab must
  not have broken.

Moderate and minor axe findings are not gated. One is left in place
deliberately: `region` reports the Monaco text area and the current document
tab as content outside a landmark. Both are inside the editor's own container,
and the only way to satisfy the rule would be to mark Monaco's internals with
landmarks, which would fight the widget on its next update.

## Contrast and colour

`theme-contrast.test.cjs` checks every shipped theme against WCAG 2.1 for the
pairs the app actually relies on: editor text, active and inactive line
numbers, the status bar, the menu bar, tabs, menus, buttons, inputs, the focus
outline, and the shown whitespace and arrows. Body text asks for AA (4.5:1) and
meaningful graphics for non-text contrast (3:1).

### Where Notepad++'s colours were changed

The Notepad++ Classic palette fails WCAG AA in four places. Each was adjusted
to the nearest passing colour rather than dropped:

| Colour | Notepad++ | Notepadia | Ratio |
| --- | --- | --- | --- |
| Inactive line numbers | `#808080` (3.95:1) | `#767676` | 4.54:1 |
| Shown whitespace, light theme | `#A0A0A0` (2.62:1) | `#8A8A8A` | 3.45:1 |
| Shown whitespace, dark theme | `#5A5A5A` (2.42:1) | `#6A6A6A` | 3.08:1 |
| Button background | `#0078D7` (4.50:1, just under) | `#0072C6` | 4.97:1 |

The disabled toolbar icons are dimmed with `opacity: 0.5` rather than a dimmer
`0.4`. An icon is the button's only content, which makes it meaningful
non-text graphics under WCAG 1.4.11, and at 0.4 it lands at 2.80:1 in Classic
and 2.66:1 in Classic Dark. The dimmed state is still unmistakably dimmer than
an enabled button.

The Find dialog's field labels and fieldset legends used
`--theia-descriptionForeground`, which is a hint colour and lands under 4.5:1.
They now use the normal foreground, because a form label is primary text.

### High contrast

**Notepadadia High Contrast** ships alongside the Classic and Classic Dark
palettes and is listed in *Settings ▸ Preferences ▸ Color Theme*. It is a true
high-contrast theme: pure black editor and panel backgrounds, white body text,
and yellow, cyan and bright green reserved for the things that must stand out.
Editor text reaches AAA (7:1 or better) against the background.

## Known upstream problems worked around in Notepadia

Three defects are in the shell rather than in Notepadia code. They are repaired
at runtime by `notepadia-accessibility-contribution.ts`, which writes
attributes only and can be deleted when the shell stops producing these
shapes:

1. **Tab titles.** Lumino renders tab titles as `<li>` elements inside a `<ul>`
   that Theia marks `role="tablist"`, but only the current title gets
   `role="tab"`. The list role cancels the `<li>` semantics, which axe reports
   as `aria-required-children` (critical) and `listitem` (serious), and no
   document tab is reachable by Tab. Every title is marked as a tab, with the
   current one as the single stop in the ring.
2. **Menus.** Lumino marks submenu items `role="presentation"`, leaving
   `role="menu"` with no valid children at all. The items become `menuitem`s
   and the decorative separators are hidden from the tree.
3. **Status bar.** Theia puts `aria-label` on roleless `<div>`s, which
   `aria-prohibited-attr` forbids. Its editor language status item is worse:
   the label is built from an unrendered codicon token and a React node, so a
   screen reader announces the literal text `$(bracket), [object HTMLDivElement]`.
   The status bar becomes one focusable group, and labels carrying codicon or
   object noise are dropped rather than announced.

## Reporting a problem

Open an issue and say which of these it is, with the app version and your
platform:

- **Keyboard:** the chord or Tab sequence you pressed, and where focus went
  instead of where you expected. `e2e/a11y.cjs` fails on a trapped editor, so a
  new trap is a bug worth an issue even if you worked around it.
- **Screen reader:** the reader and version, what it announced, and what you
  expected. Please include NVDA, JAWS, Orca or Narrator by name.
- **Contrast:** the theme, the element, and the colours if you have them. A
  failing pair in a shipped theme fails `theme-contrast.test.cjs`, so a report
  with exact colours is usually enough to fix it.
- **Anything you had to work around** to finish a task without a mouse. That is
  the class of problem this page exists to remove, and it is worth reporting
  even when you found your own way past it.