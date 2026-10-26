'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { NOTEPADIA_LANGUAGES, createMonarchTokens } = require('../lib/browser/notepadia-language-tokens.js');

const byId = id => NOTEPADIA_LANGUAGES.find(entry => entry.id === id);
const tokensFor = id => createMonarchTokens(byId(id));

function actionTokens(rule) {
    const action = rule[1];
    if (typeof action === 'string') {
        return [action];
    }
    if (Array.isArray(action)) {
        return action.filter(item => typeof item === 'string');
    }
    return [];
}

function hasToken(language, state, token, sourceFragment) {
    return (language.tokenizer[state] ?? []).some(rule => {
        const regex = rule[0];
        if (!(regex instanceof RegExp)) {
            return false;
        }
        if (sourceFragment && !regex.source.includes(sourceFragment)) {
            return false;
        }
        return actionTokens(rule).includes(token);
    });
}

function ruleIndex(language, state, token) {
    return (language.tokenizer[state] ?? []).findIndex(rule => actionTokens(rule).includes(token));
}

describe('language tokenizers', () => {
    it('gives every curated language a non-empty root state', () => {
        assert.equal(NOTEPADIA_LANGUAGES.length, 21);
        for (const entry of NOTEPADIA_LANGUAGES) {
            const language = createMonarchTokens(entry);
            assert.ok(Array.isArray(language.tokenizer.root) && language.tokenizer.root.length > 0,
                `${entry.id} has no root rules`);
        }
    });

    it('never emits a Monarch regex that can match an empty string', () => {
        const zeroLength = [];
        for (const entry of NOTEPADIA_LANGUAGES) {
            const language = createMonarchTokens(entry);
            for (const [state, rules] of Object.entries(language.tokenizer)) {
                for (const rule of rules) {
                    const regex = rule[0];
                    if (!(regex instanceof RegExp)) {
                        continue;
                    }
                    const probe = new RegExp(regex.source, regex.flags.replace('g', ''));
                    if (probe.test('')) {
                        zeroLength.push(`${entry.id}/${state}: /${regex.source}/`);
                    }
                }
            }
        }
        assert.deepEqual(zeroLength, [], `zero-length Monarch rules:\n  ${zeroLength.join('\n  ')}`);
    });

    it('emits Alabaster function and type definition roles', () => {
        const javascript = tokensFor('javascript');
        assert.ok(hasToken(javascript, 'root', 'entity.name.function', 'function'));
        assert.ok(hasToken(javascript, 'root', 'entity.name.type', 'class'));
        assert.ok(hasToken(tokensFor('python'), 'root', 'entity.name.function', 'def'));
        assert.ok(hasToken(tokensFor('rust'), 'root', 'entity.name.function', 'fn'));
        assert.ok(hasToken(tokensFor('go'), 'root', 'entity.name.type', 'type'));
    });

    it('emits constants instead of keywords for statically known literals', () => {
        assert.ok(hasToken(tokensFor('javascript'), 'root', 'constant', 'true|false|null'));
        assert.ok(hasToken(tokensFor('python'), 'root', 'constant', 'True|False|None'));
        assert.ok(hasToken(tokensFor('sql'), 'root', 'constant', 'null|true|false'));
        assert.equal(tokensFor('sql').ignoreCase, true);
    });

    it('distinguishes JSON keys from values', () => {
        const json = tokensFor('json');
        assert.ok(hasToken(json, 'root', 'string.key.json', '(?='));
        assert.ok(hasToken(json, 'root', 'string.value.json'));
        assert.ok(hasToken(json, 'root', 'constant', 'true|false|null'));
        assert.ok(ruleIndex(json, 'root', 'string.key.json') < ruleIndex(json, 'root', 'string.value.json'));
    });

    it('tokenizes markup tags, attributes and values', () => {
        const html = tokensFor('html');
        const xml = tokensFor('xml');
        assert.equal(html.ignoreCase, true);
        assert.equal(xml.ignoreCase, undefined);
        assert.ok(hasToken(html, 'root', 'tag', '<'));
        assert.ok(hasToken(html, 'tag', 'attribute.name'));
        assert.ok(hasToken(html, 'tag', 'string', '='));
        assert.ok(hasToken(html, 'root', 'comment', '<!--'));
        assert.ok(hasToken(html, 'cdata', 'string'));
        assert.ok(hasToken(html, 'processing', 'metatag'));
        assert.ok(hasToken(xml, 'root', 'tag'));
    });

    it('tokenizes CSS selectors, properties and values', () => {
        const css = tokensFor('css');
        assert.equal(css.ignoreCase, true);
        for (const token of [
            'comment',
            'string',
            'constant.other.color',
            'keyword',
            'number',
            'entity.other.attribute-name.class.css',
            'entity.other.attribute-name.pseudo-class',
            'support.type.property-name',
            'support.constant.property-value',
            'delimiter'
        ]) {
            assert.ok(hasToken(css, 'root', token), `CSS is missing ${token}`);
        }
    });

    it('tokenizes Markdown blocks and inline spans', () => {
        const markdown = tokensFor('markdown');
        for (const token of [
            'markup.heading',
            'markup.quote',
            'markup.inline.raw',
            'markup.bold',
            'markup.italic',
            'punctuation.definition.list.begin.markdown',
            'string.other.link.title.markdown',
            'string.other.link'
        ]) {
            assert.ok(hasToken(markdown, 'root', token), `Markdown is missing ${token}`);
        }
        assert.ok(hasToken(markdown, 'fenced', 'markup.raw.block.fenced.markdown'));
        assert.ok(hasToken(markdown, 'fencedTilde', 'markup.raw.block.fenced.markdown'));
        assert.ok(hasToken(markdown, 'comment', 'comment'));
    });

    it('tokenizes YAML keys, values and constants', () => {
        const yaml = tokensFor('yaml');
        assert.equal(yaml.ignoreCase, true);
        assert.ok(hasToken(yaml, 'root', 'key'));
        assert.ok(hasToken(yaml, 'root', 'constant', 'true|false|null'));
        assert.ok(hasToken(yaml, 'root', 'number'));
        assert.ok(hasToken(yaml, 'root', 'string'));
        assert.ok(hasToken(yaml, 'root', 'comment'));
        assert.ok(hasToken(yaml, 'root', 'punctuation.definition'));
    });

    it('tokenizes PowerShell constants, variables and definitions', () => {
        const powershell = tokensFor('powershell');
        assert.equal(powershell.ignoreCase, true);
        assert.ok(hasToken(powershell, 'root', 'constant', '\\$(?:true|false|null)'));
        assert.ok(hasToken(powershell, 'root', 'variable', '\\$[\\w:]+'));
        assert.ok(hasToken(powershell, 'root', 'function'));
        assert.ok(hasToken(powershell, 'root', 'entity.name.function', 'function'));
        assert.ok(hasToken(powershell, 'root', 'entity.name.type', 'class'));
        assert.ok(hasToken(powershell, 'comment.block', 'comment'));
    });
});
