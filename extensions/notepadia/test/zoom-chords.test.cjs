'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { editorZoomAction } = require('../lib/common/zoom-chords.js');

const chord = (key, modifiers = {}) => ({
    ctrlKey: 'ctrl' in modifiers ? modifiers.ctrl : true,
    metaKey: 'meta' in modifiers ? modifiers.meta : false,
    altKey: 'alt' in modifiers ? modifiers.alt : false,
    key
});

describe('editorZoomAction', () => {
    it('maps the three Notepad++ zoom chords', () => {
        assert.equal(editorZoomAction(chord('=')), 'zoom-in');
        assert.equal(editorZoomAction(chord('-')), 'zoom-out');
        assert.equal(editorZoomAction(chord('0')), 'reset');
    });

    it('treats + as the same chord as =', () => {
        assert.equal(editorZoomAction(chord('+', { ctrl: true, shift: true })), 'zoom-in');
    });

    it('accepts Meta so macOS behaves like the other platforms', () => {
        assert.equal(editorZoomAction(chord('=', { ctrl: false, meta: true })), 'zoom-in');
        assert.equal(editorZoomAction(chord('-', { ctrl: false, meta: true })), 'zoom-out');
        assert.equal(editorZoomAction(chord('0', { ctrl: false, meta: true })), 'reset');
    });

    it('leaves the key to the browser without a modifier', () => {
        assert.equal(editorZoomAction(chord('=', { ctrl: false })), undefined);
        assert.equal(editorZoomAction(chord('-', { ctrl: false })), undefined);
        assert.equal(editorZoomAction(chord('0', { ctrl: false })), undefined);
    });

    it('ignores Alt because Ctrl+Alt is AltGr on Windows layouts', () => {
        assert.equal(editorZoomAction(chord('=', { alt: true })), undefined);
        assert.equal(editorZoomAction(chord('-', { alt: true })), undefined);
        assert.equal(editorZoomAction(chord('0', { alt: true })), undefined);
    });

    it('ignores keys that are not zoom chords', () => {
        assert.equal(editorZoomAction(chord('w')), undefined);
        assert.equal(editorZoomAction(chord('F5')), undefined);
        assert.equal(editorZoomAction(chord('9')), undefined);
        assert.equal(editorZoomAction(chord('Insert')), undefined);
    });

    it('does not claim the Notepad++ Close-All alternates on their shift form', () => {
        // Ctrl+Shift+W closes every document, not anything to do with zoom.
        assert.equal(editorZoomAction(chord('W')), undefined);
    });
});
