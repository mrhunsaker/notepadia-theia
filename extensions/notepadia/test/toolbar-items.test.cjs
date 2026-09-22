'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
    NOTEPADIA_TOOLBAR_ITEMS,
    isToolbarButton,
    toolbarButtons,
    nextFocusIndex
} = require('../lib/browser/notepadia-toolbar-items.js');

const BROWSER_LIB = path.join(__dirname, '..', 'lib', 'browser');

/**
 * Command ids the toolbar borrows from @theia rather than registering itself.
 * Anything outside this list must be a `notepadia.*` id that we can prove is
 * registered in our own compiled output.
 */
const EXTERNAL_COMMAND_IDS = new Set([
    'core.open',
    'core.save',
    'core.saveAll',
    'core.cut',
    'core.copy',
    'core.paste',
    'core.undo',
    'core.redo',
    'core.find',
    'core.replace',
    'editor.action.toggleWordWrap'
]);

function compiledBrowserSources() {
    return fs.readdirSync(BROWSER_LIB)
        .filter(f => f.endsWith('.js'))
        .map(f => fs.readFileSync(path.join(BROWSER_LIB, f), 'utf8'))
        .join('\n');
}

describe('toolbar item model', () => {
    it('exposes buttons and separators only', () => {
        for (const item of NOTEPADIA_TOOLBAR_ITEMS) {
            assert.ok(item.kind === 'button' || item.kind === 'separator', `bad kind: ${item.kind}`);
        }
    });

    it('gives every item a unique id', () => {
        const ids = NOTEPADIA_TOOLBAR_ITEMS.map(i => i.id);
        assert.equal(new Set(ids).size, ids.length, 'duplicate toolbar item id');
    });

    it('gives every button a command, a label and an icon', () => {
        for (const button of toolbarButtons(NOTEPADIA_TOOLBAR_ITEMS)) {
            assert.ok(button.commandId && button.commandId.length > 0, `${button.id} has no commandId`);
            assert.ok(button.label && button.label.length > 0, `${button.id} has no label`);
            assert.ok(button.icon && button.icon.length > 0, `${button.id} has no icon`);
        }
    });

    it('never points two buttons at the same command', () => {
        const commands = toolbarButtons(NOTEPADIA_TOOLBAR_ITEMS).map(b => b.commandId);
        assert.equal(new Set(commands).size, commands.length, 'duplicate toolbar command');
    });

    it('never starts or ends with a separator, and never doubles one up', () => {
        const items = NOTEPADIA_TOOLBAR_ITEMS;
        assert.ok(isToolbarButton(items[0]), 'toolbar starts with a separator');
        assert.ok(isToolbarButton(items[items.length - 1]), 'toolbar ends with a separator');
        for (let i = 1; i < items.length; i++) {
            const doubled = items[i].kind === 'separator' && items[i - 1].kind === 'separator';
            assert.ok(!doubled, `two separators in a row at index ${i}`);
        }
    });

    it('only marks buttons as toggles when they are genuinely stateful', () => {
        const toggles = toolbarButtons(NOTEPADIA_TOOLBAR_ITEMS).filter(b => b.toggle).map(b => b.id);
        assert.deepEqual(toggles.sort(), [
            'document-map',
            'folder-as-workspace',
            'macro-record',
            'whitespace',
            'word-wrap'
        ]);
    });

    /**
     * The guard that matters: a toolbar button wired to a command nobody
     * registers is a dead button, and it would only show up at runtime.
     */
    it('points every notepadia.* button at a command registered in this extension', () => {
        const sources = compiledBrowserSources();
        for (const button of toolbarButtons(NOTEPADIA_TOOLBAR_ITEMS)) {
            if (EXTERNAL_COMMAND_IDS.has(button.commandId)) {
                continue;
            }
            assert.ok(
                button.commandId.startsWith('notepadia.'),
                `${button.id} uses foreign command ${button.commandId} without declaring it external`
            );
            assert.ok(
                sources.includes(`'${button.commandId}'`) || sources.includes(`"${button.commandId}"`),
                `${button.id} points at unregistered command ${button.commandId}`
            );
        }
    });
});

describe('nextFocusIndex', () => {
    it('steps forward and backward', () => {
        assert.equal(nextFocusIndex(0, 1, 5), 1);
        assert.equal(nextFocusIndex(3, -1, 5), 2);
    });
    it('wraps at both ends', () => {
        assert.equal(nextFocusIndex(4, 1, 5), 0);
        assert.equal(nextFocusIndex(0, -1, 5), 4);
    });
    it('is safe on an empty toolbar', () => {
        assert.equal(nextFocusIndex(0, 1, 0), 0);
        assert.equal(nextFocusIndex(0, -1, 0), 0);
    });
});
