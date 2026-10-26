'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const THEME_DIR = path.join(__dirname, '..', 'src', 'browser', 'theme');
const THEMES = ['notepadia-classic', 'notepadia-classic-dark', 'notepadia-high-contrast'];

const PALETTES = {
    'notepadia-classic': {
        text: '#4C4F69',
        comment: '#D20F39',
        string: '#40A02B',
        constant: '#8839EF',
        entity: '#1E66F5',
        punctuation: '#7C7F93',
        escape: '#8C8FA1',
        quote: '#6C6F85',
        backgrounds: ['#E9F0FE', '#ECF6EA', '#FBE7EB']
    },
    'notepadia-classic-dark': {
        text: '#CDD6F4',
        comment: '#F38BA8',
        string: '#A6E3A1',
        constant: '#CBA6F7',
        entity: '#89B4FA',
        punctuation: '#9399B2',
        escape: '#7F849C',
        quote: '#A6ADC8',
        backgrounds: ['#2B3038', '#2E362E', '#382B2F']
    },
    'notepadia-high-contrast': {
        text: '#CDD6F4',
        comment: '#F38BA8',
        string: '#A6E3A1',
        constant: '#CBA6F7',
        entity: '#89B4FA',
        punctuation: '#9399B2',
        escape: '#7F849C',
        quote: '#A6ADC8',
        backgrounds: ['#10161E', '#141B13', '#1D1114']
    }
};

const ROLES = [
    ['keyword', 'text'],
    ['variable', 'text'],
    ['function', 'text'],
    ['identifier', 'text'],
    ['entity.other.attribute-name', 'text'],
    ['support.constant.property-value', 'text'],
    ['string.key.json', 'text'],
    ['comment', 'comment'],
    ['string', 'string'],
    ['string.value.json', 'string'],
    ['constant', 'constant'],
    ['constant.numeric', 'constant'],
    ['constant.language', 'constant'],
    ['constant.character.escape', 'escape'],
    ['entity.name', 'entity'],
    ['entity.name.function', 'entity'],
    ['entity.name.type', 'entity'],
    ['tag', 'entity'],
    ['support.type.property-name', 'text'],
    ['punctuation', 'punctuation'],
    ['string.other.link', 'entity'],
    ['string.other.link.title.markdown', 'entity'],
    ['markup.heading', 'entity'],
    ['markup.underline.link', 'entity'],
    ['markup.quote', 'quote'],
    ['markup.inline.raw', 'constant'],
    ['markup.bold', 'text'],
    ['markup.italic', 'text']
];

const loadTheme = name => JSON.parse(fs.readFileSync(path.join(THEME_DIR, `${name}.color-theme.json`), 'utf8'));

function scopeSettings(theme) {
    const result = new Map();
    for (const rule of theme.tokenColors ?? []) {
        const scopes = Array.isArray(rule.scope) ? rule.scope : [rule.scope];
        for (const scope of scopes) {
            result.set(scope, rule.settings ?? {});
        }
    }
    return result;
}

describe('shipped theme token colours', () => {
    for (const name of THEMES) {
        const palette = PALETTES[name];

        it(`${name} maps Alabaster roles onto its palette`, () => {
            const settings = scopeSettings(loadTheme(name));
            const failures = [];
            for (const [scope, role] of ROLES) {
                const value = settings.get(scope);
                if (!value) {
                    failures.push(`${scope}: no rule`);
                    continue;
                }
                if ((value.foreground ?? '').toUpperCase() !== palette[role].toUpperCase()) {
                    failures.push(`${scope}: ${value.foreground} != ${palette[role]} (${role})`);
                }
            }
            assert.deepEqual(failures, [], `${name} role failures:\n  ${failures.join('\n  ')}`);
        });

        it(`${name} keeps keywords, comments and definitions free of Alabaster font styles`, () => {
            const settings = scopeSettings(loadTheme(name));
            for (const scope of ['keyword', 'variable', 'function', 'identifier', 'comment', 'entity.name.function', 'entity.name.type']) {
                const fontStyle = settings.get(scope)?.fontStyle;
                assert.ok(!fontStyle?.includes('italic'), `${name} ${scope} must not be italic`);
                assert.ok(!fontStyle?.includes('bold'), `${name} ${scope} must not be bold`);
            }
            assert.match(settings.get('markup.underline.link')?.fontStyle ?? '', /underline/);
            assert.match(settings.get('markup.bold')?.fontStyle ?? '', /bold/);
            assert.match(settings.get('markup.italic')?.fontStyle ?? '', /italic/);
        });

        it(`${name} uses only opaque palette colours in token rules`, () => {
            const theme = loadTheme(name);
            const allowed = new Set([
                ...Object.values(palette).filter(value => typeof value === 'string'),
                ...palette.backgrounds
            ].map(value => value.toUpperCase()));
            const failures = [];
            for (const rule of theme.tokenColors ?? []) {
                for (const key of ['foreground', 'background']) {
                    const value = rule.settings?.[key];
                    if (!value) {
                        continue;
                    }
                    if (!/^#[0-9A-Fa-f]{6}$/.test(value)) {
                        failures.push(`${key} ${value}: not a six-digit opaque colour`);
                    } else if (!allowed.has(value.toUpperCase())) {
                        failures.push(`${key} ${value}: outside the ${name} palette`);
                    }
                }
            }
            assert.deepEqual(failures, [], `${name} colour failures:\n  ${failures.join('\n  ')}`);
        });

        it(`${name} does not define the same scope twice with different settings`, () => {
            const theme = loadTheme(name);
            const seen = new Map();
            const conflicts = [];
            for (const rule of theme.tokenColors ?? []) {
                const scopes = Array.isArray(rule.scope) ? rule.scope : [rule.scope];
                const settings = JSON.stringify(rule.settings ?? {});
                for (const scope of scopes) {
                    if (seen.has(scope) && seen.get(scope) !== settings) {
                        conflicts.push(scope);
                    }
                    seen.set(scope, settings);
                }
            }
            assert.deepEqual(conflicts, [], `${name} conflicting scopes: ${conflicts.join(', ')}`);
        });
    }
});
