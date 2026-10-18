'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { startupPopupDecision } = require('../lib/common/updater-policy.js');

describe('startupPopupDecision', () => {
    it('offers the popup only when an update is available', () => {
        assert.deepEqual(startupPopupDecision('update-available', true), { open: true, pending: false });
    });

    it('stays quiet when the startup check finds no update', () => {
        assert.deepEqual(startupPopupDecision('update-not-available', true), { open: false, pending: false });
    });

    it('stays quiet when the startup check fails', () => {
        assert.deepEqual(startupPopupDecision('error', true), { open: false, pending: false });
    });

    it('stays quiet in an unpackaged build', () => {
        assert.deepEqual(startupPopupDecision('disabled', true), { open: false, pending: false });
    });

    it('keeps the pending window open through checking and download progress', () => {
        assert.deepEqual(startupPopupDecision('checking', true), { open: false, pending: true });
        assert.deepEqual(startupPopupDecision('download-progress', true), { open: false, pending: true });
    });

    it('never opens once the pending window has closed', () => {
        assert.deepEqual(startupPopupDecision('update-available', false), { open: false, pending: false });
        assert.deepEqual(startupPopupDecision('checking', false), { open: false, pending: false });
    });

    it('settles on update-downloaded so a stale push cannot reopen the dialog', () => {
        assert.deepEqual(startupPopupDecision('update-downloaded', true), { open: false, pending: false });
    });
});
