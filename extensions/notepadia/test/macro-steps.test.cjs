'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { changeToSteps } = require('../lib/common/macro-steps.js');

describe('changeToSteps', () => {
    it('turns pure typing into a single type step', () => {
        assert.deepEqual(changeToSteps(0, 'ab'), [{ kind: 'type', text: 'ab' }]);
    });
    it('turns a deletion into a delete step of that length', () => {
        assert.deepEqual(changeToSteps(3, ''), [{ kind: 'delete', count: 3 }]);
    });
    it('emits delete before type for a replacement', () => {
        assert.deepEqual(changeToSteps(2, 'x'), [
            { kind: 'delete', count: 2 },
            { kind: 'type', text: 'x' }
        ]);
    });
    it('emits nothing for an empty change', () => {
        assert.deepEqual(changeToSteps(0, ''), []);
    });
    it('keeps the exact text so Enter and pastes replay as-is', () => {
        assert.deepEqual(changeToSteps(0, 'a\nb'), [{ kind: 'type', text: 'a\nb' }]);
    });
});