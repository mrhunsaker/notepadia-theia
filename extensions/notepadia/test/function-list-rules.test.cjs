'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    parseFunctionList,
    functionListLanguage,
    FUNCTION_LIST_LANGUAGES,
    MAX_RULE_LINE_LENGTH,
    MAX_FUNCTION_ENTRIES
} = require('../lib/common/function-list-rules.js');

/**
 * One fixture per language, each written the way that language writes the
 * construct, plus the lines that must *not* be listed: a commented-out
 * declaration and a control statement. A rule that grows greedy enough to
 * swallow one of those shows up here rather than in the panel.
 */
const FIXTURES = [
    {
        languageId: 'javascript',
        source: [
            '// function commented() {}',
            'import { thing } from "./thing";',
            'function greet(name) {',
            '  return "hello " + name;',
            '}',
            'const add = (a, b) => a + b;',
            'export default class Widget {',
            '  render() {}',
            '}',
            'export async function* tick() {',
            '  yield 1;',
            '}'
        ].join('\n'),
        expected: [
            { name: 'greet', kind: 'function', line: 3 },
            { name: 'add', kind: 'function', line: 6 },
            { name: 'Widget', kind: 'class', line: 7 },
            { name: 'tick', kind: 'function', line: 10 }
        ]
    },
    {
        languageId: 'typescript',
        source: [
            'interface Props {',
            '  id: string;',
            '}',
            'export type Handler = (id: string) => void;',
            'export enum Direction {',
            '  Up,',
            '  Down',
            '}',
            'export async function load(url: string): Promise<void> {',
            '}',
            'export class Service {',
            '  run(): void {}',
            '}'
        ].join('\n'),
        expected: [
            { name: 'Props', kind: 'section', line: 1 },
            { name: 'Handler', kind: 'section', line: 4 },
            { name: 'Direction', kind: 'section', line: 5 },
            { name: 'load', kind: 'function', line: 9 },
            { name: 'Service', kind: 'class', line: 11 }
        ]
    },
    {
        languageId: 'python',
        source: [
            '# def commented():',
            'import os',
            'class Repository:',
            '    pass',
            'def load(path):',
            '    return open(path).read()',
            'async def fetch(url):',
            '    pass'
        ].join('\n'),
        expected: [
            { name: 'Repository', kind: 'class', line: 3 },
            { name: 'load', kind: 'function', line: 5 },
            { name: 'fetch', kind: 'function', line: 7 }
        ]
    },
    {
        languageId: 'c',
        source: [
            '#include <stdio.h>',
            'static int total;',
            'int add(int a, int b) {',
            '    return a + b;',
            '}',
            'void greet(void) {',
            '    if (total) {',
            '        return;',
            '    }',
            '}',
            'struct point {',
            '    int x;',
            '};'
        ].join('\n'),
        expected: [
            { name: 'add', kind: 'function', line: 3 },
            { name: 'greet', kind: 'function', line: 6 },
            { name: 'point', kind: 'class', line: 11 }
        ]
    },
    {
        languageId: 'cpp',
        source: [
            '#include <string>',
            'class Widget {',
            'public:',
            '    Widget() {}',
            '};',
            'Widget *make_widget(const std::string &name) {',
            '    return new Widget();',
            '}'
        ].join('\n'),
        expected: [
            // The constructor is listed, which is what Notepad++'s own C++
            // rule does: its return type is optional.
            { name: 'Widget', kind: 'class', line: 2 },
            { name: 'Widget', kind: 'function', line: 4 },
            { name: 'make_widget', kind: 'function', line: 6 }
        ]
    },
    {
        languageId: 'csharp',
        source: [
            'using System;',
            'namespace App',
            '{',
            '    public sealed class Service',
            '    {',
            '        public Service(string name)',
            '        {',
            '        }',
            '        public async Task<int> LoadAsync(string path)',
            '        {',
            '            foreach (var line in File.ReadLines(path))',
            '            {',
            '            }',
            '            return 0;',
            '        }',
            '    }',
            '}'
        ].join('\n'),
        expected: [
            { name: 'Service', kind: 'class', line: 4 },
            { name: 'Service', kind: 'function', line: 6 },
            { name: 'LoadAsync', kind: 'function', line: 9 }
        ]
    },
    {
        languageId: 'java',
        source: [
            'package app;',
            'public final class App {',
            '    public static void main(String[] args) throws Exception {',
            '        for (String arg : args) {',
            '            System.out.println(arg);',
            '        }',
            '    }',
            '    public App() {',
            '    }',
            '}'
        ].join('\n'),
        expected: [
            { name: 'App', kind: 'class', line: 2 },
            { name: 'main', kind: 'function', line: 3 },
            { name: 'App', kind: 'function', line: 8 }
        ]
    },
    {
        languageId: 'php',
        source: [
            '<?php',
            '// function commented() {}',
            'function greet(string $name): string {',
            '    return "hello";',
            '}',
            'final class Widget',
            '{',
            '}',
            'trait Loggable',
            '{',
            '}'
        ].join('\n'),
        expected: [
            { name: 'greet', kind: 'function', line: 3 },
            { name: 'Widget', kind: 'class', line: 6 },
            { name: 'Loggable', kind: 'class', line: 9 }
        ]
    },
    {
        languageId: 'ruby',
        source: [
            '# def commented',
            'class Repository',
            '  def load(path)',
            '    File.read(path)',
            '  end',
            '  def save?',
            '    true',
            '  end',
            'end'
        ].join('\n'),
        expected: [
            { name: 'Repository', kind: 'class', line: 2 },
            { name: 'load', kind: 'function', line: 3 },
            { name: 'save?', kind: 'function', line: 6 }
        ]
    },
    {
        languageId: 'powershell',
        source: [
            '# function Commented {',
            'function Get-Status {',
            '  # a comment',
            '  $items = Get-ChildItem',
            '}',
            'filter Where-Like {',
            '  $_',
            '}',
            'class Widget {',
            '}'
        ].join('\n'),
        expected: [
            { name: 'Get-Status', kind: 'function', line: 2 },
            { name: 'Where-Like', kind: 'function', line: 6 },
            { name: 'Widget', kind: 'class', line: 9 }
        ]
    },
    {
        languageId: 'shellscript',
        source: [
            '#!/bin/bash',
            '# function commented {',
            'greet() {',
            '  echo "hello"',
            '}',
            'function farewell {',
            '  echo "bye"',
            '}'
        ].join('\n'),
        expected: [
            { name: 'greet', kind: 'function', line: 3 },
            { name: 'farewell', kind: 'function', line: 6 }
        ]
    },
    {
        languageId: 'sql',
        source: [
            '-- create procedure commented',
            'CREATE TABLE dbo.orders (',
            '  id int',
            ');',
            'CREATE OR REPLACE PROCEDURE dbo.refresh_totals AS',
            'BEGIN',
            'END;',
            'CREATE VIEW dbo.active_orders AS',
            'SELECT 1;'
        ].join('\n'),
        expected: [
            { name: 'orders', kind: 'section', line: 2 },
            { name: 'refresh_totals', kind: 'function', line: 5 },
            { name: 'active_orders', kind: 'section', line: 8 }
        ]
    },
    {
        languageId: 'json',
        source: [
            '{',
            '  "name": "notepadia",',
            '  "scripts": {',
            '    "build": "tsc",',
            '    "test": "node --test"',
            '  },',
            '  "version": "1.0.0"',
            '}'
        ].join('\n'),
        expected: [
            { name: 'name', kind: 'section', line: 2 },
            { name: 'scripts', kind: 'section', line: 3 },
            { name: 'version', kind: 'section', line: 7 }
        ]
    },
    {
        languageId: 'xml',
        source: [
            '<?xml version="1.0"?>',
            '<!-- <div id="commented" /> -->',
            '<layout id="main-layout">',
            '  <panel id="sidebar" />',
            '  <div class="row" />',
            '</layout>'
        ].join('\n'),
        expected: [
            { name: 'main-layout', kind: 'section', line: 3 },
            { name: 'sidebar', kind: 'section', line: 4 }
        ]
    },
    {
        languageId: 'html',
        source: [
            '<!DOCTYPE html>',
            '<body>',
            '  <header id="top" class="bar">',
            '    <h1>Notepadia</h1>',
            '  </header>',
            '  <main id="content"></main>',
            '</body>'
        ].join('\n'),
        expected: [
            { name: 'top', kind: 'section', line: 3 },
            { name: 'content', kind: 'section', line: 6 }
        ]
    },
    {
        languageId: 'markdown',
        source: [
            '# Notepadia',
            '',
            'Some prose that is not a heading.',
            '',
            '## Usage',
            '',
            '### Keyboard shortcuts',
            '',
            '#### Detail',
            '',
            '## Accessibility'
        ].join('\n'),
        expected: [
            { name: 'Notepadia', kind: 'section', line: 1 },
            { name: 'Usage', kind: 'section', line: 5 },
            { name: 'Keyboard shortcuts', kind: 'section', line: 7 },
            { name: 'Detail', kind: 'section', line: 9 },
            { name: 'Accessibility', kind: 'section', line: 11 }
        ]
    },
    {
        languageId: 'ini',
        source: [
            '; a comment',
            '[general]',
            'theme = classic',
            '',
            '[editor]',
            'tab_size = 4'
        ].join('\n'),
        expected: [
            { name: 'general', kind: 'section', line: 2 },
            { name: 'editor', kind: 'section', line: 5 }
        ]
    },
    {
        languageId: 'go',
        source: [
            'package main',
            '',
            'type Server struct {',
            '\tport int',
            '}',
            '',
            'func (s *Server) Stop() {',
            '}',
            '',
            'func main() {',
            '}'
        ].join('\n'),
        expected: [
            { name: 'Server', kind: 'class', line: 3 },
            { name: 'Stop', kind: 'function', line: 7 },
            { name: 'main', kind: 'function', line: 10 }
        ]
    },
    {
        languageId: 'rust',
        source: [
            '// fn commented() {}',
            'pub struct Server {',
            '    port: u16,',
            '}',
            'enum Direction {',
            '    Up,',
            '}',
            'pub async fn run(addr: &str) -> Result<(), Error> {',
            '    Ok(())',
            '}'
        ].join('\n'),
        expected: [
            { name: 'Server', kind: 'class', line: 2 },
            { name: 'Direction', kind: 'class', line: 5 },
            { name: 'run', kind: 'function', line: 8 }
        ]
    }
];

describe('parseFunctionList - per language rules', () => {
    for (const fixture of FIXTURES) {
        it(`lists the ${fixture.languageId} fixture exactly`, () => {
            assert.deepEqual(parseFunctionList(fixture.source, fixture.languageId), fixture.expected);
        });
    }

    it('covers every language the brief named, and the curated set it makes likely', () => {
        const required = [
            'javascript', 'typescript', 'python', 'c', 'cpp', 'csharp', 'java', 'php', 'ruby',
            'powershell', 'shellscript', 'sql', 'json', 'xml', 'html', 'markdown', 'ini'
        ];
        for (const id of required) {
            assert.ok(FUNCTION_LIST_LANGUAGES[id], `no rules for ${id}`);
            assert.ok(FUNCTION_LIST_LANGUAGES[id].rules.length > 0, `${id} has an empty rule list`);
        }
    });

    it('finds bash under the id Notepad++ uses as well as the app\'s', () => {
        assert.equal(functionListLanguage('bash').rules, FUNCTION_LIST_LANGUAGES.shellscript.rules);
        assert.equal(functionListLanguage('BASH').rules, FUNCTION_LIST_LANGUAGES.shellscript.rules);
    });

    it('has a rule set for every language the app registers', () => {
        const registered = [
            'javascript', 'typescript', 'html', 'css', 'markdown', 'yaml', 'xml', 'python', 'c',
            'cpp', 'csharp', 'java', 'json', 'php', 'powershell', 'ruby', 'go', 'rust',
            'shellscript', 'sql'
        ];
        const without = registered.filter(id => !FUNCTION_LIST_LANGUAGES[id]);
        // css and yaml have no declaration syntax worth listing; they are the
        // documented exceptions rather than an oversight.
        assert.deepEqual(without, ['css', 'yaml']);
    });
});

describe('parseFunctionList - guards', () => {
    it('returns nothing for a language with no rules', () => {
        assert.deepEqual(parseFunctionList('function greet() {}', 'plaintext'), []);
        assert.deepEqual(parseFunctionList('', 'javascript'), []);
    });

    it('ignores a line longer than the cap rather than scanning it', () => {
        const padding = 'x'.repeat(MAX_RULE_LINE_LENGTH);
        const source = [`// function commented() {}`, `function greet() { ${padding}`].join('\n');
        // The declaration line is over the cap, so its own match is dropped,
        // and the comment line is dropped for being a comment.
        assert.deepEqual(parseFunctionList(source, 'javascript'), []);
    });

    it('still lists short declarations in a file that has one huge line', () => {
        const source = ['function greet() {', 'const x = "' + 'y'.repeat(MAX_RULE_LINE_LENGTH * 2) + '";'].join('\n');
        assert.deepEqual(parseFunctionList(source, 'javascript'), [
            { name: 'greet', kind: 'function', line: 1 }
        ]);
    });

    it('stops at the entry cap on a file that declares nothing but functions', () => {
        const lines = [];
        for (let i = 0; i < MAX_FUNCTION_ENTRIES + 50; i++) {
            lines.push(`function fn${i}() {}`);
        }
        assert.equal(parseFunctionList(lines.join('\n'), 'javascript').length, MAX_FUNCTION_ENTRIES);
    });

    it('handles CRLF documents without shifting a line number', () => {
        const source = ['// a comment', 'function greet() {', '  return 1;', '}'].join('\r\n');
        assert.deepEqual(parseFunctionList(source, 'javascript'), [
            { name: 'greet', kind: 'function', line: 2 }
        ]);
    });

    it('reports the first matching rule only, so a class is not also a function', () => {
        const source = ['export default class Widget {', '  render() {}', '}'].join('\n');
        assert.deepEqual(parseFunctionList(source, 'javascript'), [
            { name: 'Widget', kind: 'class', line: 1 }
        ]);
    });

    it('keeps no regex state between lines', () => {
        // A global flag would make the second line's exec() start at the end of
        // the first match; parsing the same text twice must give the same answer.
        const source = 'function a() {}\nfunction b() {}\nfunction c() {}';
        const first = parseFunctionList(source, 'javascript');
        assert.deepEqual(parseFunctionList(source, 'javascript'), first);
        assert.equal(first.length, 3);
    });

    it('is not quadratic on a line of pathological text', () => {
        // Nested quantifiers are what makes a regex hang; the anchors and
        // bounded classes above keep this to a scan. The wall-clock budget is
        // generous because CI machines are slow, and the assertion is really
        // "this returns at all".
        const source = ['function greet() {', 'const s = "' + '('.repeat(4000) + '".repeat(10);', '}'].join('\n');
        const started = process.hrtime.bigint();
        const entries = parseFunctionList(source, 'javascript');
        const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
        assert.equal(entries.length, 1);
        assert.ok(elapsedMs < 500, `parse took ${elapsedMs.toFixed(0)}ms`);
    });
});
