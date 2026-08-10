/**
 * Verification tests for the hyphenated standard-footnote key fix.
 *
 * Bug (audit #2): keys containing a hyphen (e.g. `[^my-note]`) were not
 * recognized because `STANDARD_FOOTNOTE_REGEX` and `extractFootnotes` used
 * `\w+` (no hyphen), while `FOOTNOTE_VALIDATION_REGEX` and
 * `scanTrailingFootnotes` already allowed `[a-zA-Z0-9_-]`.
 *
 * Result: `[^my-note]` rendered with 0 comments/tags, yet `remove-comments`
 * would still delete it — silent comment loss, inline vs standard divergence.
 *
 * All three regexes are now unified on `[a-zA-Z0-9_-]+`.
 */

import { STANDARD_FOOTNOTE_REGEX, FOOTNOTE_VALIDATION_REGEX } from './regex-patterns';

export {};

// Faithful copy of the definition regex used in main.ts extractFootnotes().
const EXTRACT_FOOTNOTE_REGEX = /^\[\^([a-zA-Z0-9_-]+)\]:[ \t]*(.*(?:\r?\n[ \t]+.*)*)/gm;

function extractFootnotes(content: string): Map<string, string> {
    const map = new Map<string, string>();
    let match;
    const re = new RegExp(EXTRACT_FOOTNOTE_REGEX.source, EXTRACT_FOOTNOTE_REGEX.flags);
    while ((match = re.exec(content)) !== null) {
        const [, key, footnoteContent] = match;
        map.set(key, footnoteContent.replace(/\r?\n[ \t]+/g, '\n').trim());
    }
    return map;
}

// Faithful copy of main.ts scanTrailingFootnotes() standard-key detection.
function findStandardKey(content: string, startAt: number): string | null {
    const after = content.substring(startAt).replace(/^\s*/, '');
    const m = after.match(/^\[\^([a-zA-Z0-9_-]+)\](?!:)/);
    return m ? m[1] : null;
}

describe('STANDARD_FOOTNOTE_REGEX', () => {
    it('matches a hyphenated footnote key', () => {
        const re = new RegExp(STANDARD_FOOTNOTE_REGEX.source, STANDARD_FOOTNOTE_REGEX.flags);
        const m = re.exec('text [^my-note] tail');
        expect(m).not.toBeNull();
        expect(m![2]).toBe('my-note');
    });

    it('does not match the footnote definition line [^key]:', () => {
        const re = new RegExp(STANDARD_FOOTNOTE_REGEX.source, STANDARD_FOOTNOTE_REGEX.flags);
        expect(re.exec('[^my-note]: some content')).toBeNull();
    });

    it('matches underscore and digit keys as before', () => {
        const mk = () => new RegExp(STANDARD_FOOTNOTE_REGEX.source, STANDARD_FOOTNOTE_REGEX.flags);
        expect(mk().exec('a [^1] b')![2]).toBe('1');
        expect(mk().exec('a [^my_key] b')![2]).toBe('my_key');
    });
});

describe('FOOTNOTE_VALIDATION_REGEX', () => {
    it('accepts hyphenated keys in a reference sequence', () => {
        expect(FOOTNOTE_VALIDATION_REGEX.test(' [^my-note] ^[inline]')).toBe(true);
    });
});

describe('extractFootnotes (definition parsing)', () => {
    it('captures content for a hyphenated key', () => {
        const map = extractFootnotes('[^my-note]: hello world');
        expect(map.get('my-note')).toBe('hello world');
    });

    it('keeps the full key (does not split on the hyphen)', () => {
        const map = extractFootnotes('[^my-note]: a\n  b');
        expect(map.get('my-note')).toBe('a\nb');
        expect(map.has('my')).toBe(false);
    });
});

describe('detection + cleanup consistency (inline vs standard)', () => {
    const content = '==mark== [^my-note]\n\n[^my-note]: comment text';

    it('detects the hyphenated key during scan', () => {
        const refIndex = content.indexOf('[^my-note]');
        expect(findStandardKey(content, refIndex)).toBe('my-note');
    });

    it('matches the reference and its definition under the same key', () => {
        const map = extractFootnotes(content);
        const key = findStandardKey(content, content.indexOf('[^my-note]'));
        expect(key).toBe('my-note');
        expect(map.get(key!)).toBe('comment text');
    });
});
