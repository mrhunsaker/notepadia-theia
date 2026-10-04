'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    fileNameOf,
    directoryOf,
    namePartOf,
    extensionOf,
    expandRunVariables
} = require('../lib/common/run-variables.js');

describe('fileNameOf', () => {
    it('returns the last path segment on both separators', () => {
        assert.equal(fileNameOf('/home/me/notes.txt'), 'notes.txt');
        assert.equal(fileNameOf('C:\\Users\\me\\notes.txt'), 'notes.txt');
    });
    it('returns the whole string when there is no separator', () => {
        assert.equal(fileNameOf('notes.txt'), 'notes.txt');
    });
    it('returns empty for an empty path', () => {
        assert.equal(fileNameOf(''), '');
    });
});

describe('directoryOf', () => {
    it('returns the directory without a trailing separator', () => {
        assert.equal(directoryOf('/home/me/notes.txt'), '/home/me');
        assert.equal(directoryOf('C:\\Users\\me\\notes.txt'), 'C:\\Users\\me');
    });
    it('keeps the root of a rooted file', () => {
        assert.equal(directoryOf('/notes.txt'), '/');
    });
    it('returns empty when there is no separator', () => {
        assert.equal(directoryOf('notes.txt'), '');
    });
});

describe('namePartOf and extensionOf', () => {
    it('splits on the last extension only', () => {
        assert.equal(namePartOf('archive.tar.gz'), 'archive.tar');
        assert.equal(extensionOf('archive.tar.gz'), 'gz');
    });
    it('treats a dotfile as all name', () => {
        assert.equal(namePartOf('.gitignore'), '.gitignore');
        assert.equal(extensionOf('.gitignore'), '');
    });
    it('treats a trailing dot as no extension', () => {
        assert.equal(namePartOf('weird.'), 'weird');
        assert.equal(extensionOf('weird.'), '');
    });
});

describe('expandRunVariables', () => {
    const context = {
        fullPath: '/home/me/project/app.py',
        currentWord: 'greet',
        currentLine: 12,
        currentLineString: '    greet("world")',
        currentColumn: 5
    };

    it('expands every Notepad++ variable', () => {
        assert.equal(
            expandRunVariables('$(FULL_CURRENT_PATH)', context),
            '/home/me/project/app.py');
        assert.equal(expandRunVariables('$(CURRENT_DIRECTORY)', context), '/home/me/project');
        assert.equal(expandRunVariables('$(FILE_NAME)', context), 'app.py');
        assert.equal(expandRunVariables('$(NAME_PART)', context), 'app');
        assert.equal(expandRunVariables('$(EXT_PART)', context), 'py');
        assert.equal(expandRunVariables('$(CURRENT_WORD)', context), 'greet');
        assert.equal(expandRunVariables('$(CURRENT_LINE)', context), '12');
        assert.equal(expandRunVariables('$(CURRENT_LINESTR)', context), '    greet("world")');
        assert.equal(expandRunVariables('$(CURRENT_COLUMN)', context), '5');
    });

    it('expands several variables in one command', () => {
        assert.equal(
            expandRunVariables('python "$(CURRENT_DIRECTORY)/$(FILE_NAME)" # $(CURRENT_LINE)', context),
            'python "/home/me/project/app.py" # 12');
    });

    it('leaves an unknown variable untouched rather than erasing it', () => {
        assert.equal(
            expandRunVariables('echo $(HOME) $(FULL_CURRENT_PATH)', context),
            'echo $(HOME) /home/me/project/app.py');
    });

    it('does not treat lower-case or malformed names as variables', () => {
        assert.equal(expandRunVariables('$(full_path) $(FULL-CURRENT-PATH)', context),
            '$(full_path) $(FULL-CURRENT-PATH)');
    });

    it('expands a variable with no value to the empty string', () => {
        assert.equal(expandRunVariables('[$(CURRENT_WORD)]', { fullPath: '' }), '[]');
    });

    it('derives file variables from the path for an unsaved document', () => {
        assert.equal(expandRunVariables('$(FULL_CURRENT_PATH)$(FILE_NAME)$(NAME_PART)$(EXT_PART)',
            { fullPath: '' }), '');
    });
});
