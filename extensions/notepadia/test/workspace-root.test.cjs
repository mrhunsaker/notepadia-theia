'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    isWorkspaceFilePath,
    isRestorableWorkspaceRoot
} = require('../lib/common/workspace-root.js');

const directory = { isDirectory: () => true, isFile: () => false };
const file = { isDirectory: () => false, isFile: () => true };

describe('workspace root classification', () => {
    it('recognizes Theia and VS Code workspace files regardless of case', () => {
        assert.equal(isWorkspaceFilePath('/tmp/project.theia-workspace'), true);
        assert.equal(isWorkspaceFilePath('/tmp/project.CODE-WORKSPACE'), true);
    });

    it('does not mistake ordinary documents for workspace files', () => {
        assert.equal(isWorkspaceFilePath('/tmp/enclosure.scad'), false);
        assert.equal(isWorkspaceFilePath('/tmp/workspace.json'), false);
        assert.equal(isWorkspaceFilePath('/tmp/notes.theia-workspace.txt'), false);
    });

    it('restores directories and workspace files, but not ordinary files', () => {
        assert.equal(isRestorableWorkspaceRoot(directory, '/tmp/project'), true);
        assert.equal(isRestorableWorkspaceRoot(file, '/tmp/project.code-workspace'), true);
        assert.equal(isRestorableWorkspaceRoot(file, '/tmp/enclosure.scad'), false);
    });

    it('does not restore roots that no longer exist', () => {
        assert.equal(isRestorableWorkspaceRoot(undefined, '/tmp/project'), false);
    });
});
