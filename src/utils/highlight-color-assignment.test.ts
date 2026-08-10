import { findInsertedHighlight, findRenderedHighlight, isNativeMarkColorTarget, HighlightColorCandidate } from './highlight-color-assignment';

const candidate = (text: string, startOffset: number, markType: HighlightColorCandidate['markType'], color: string): HighlightColorCandidate => ({
    text,
    startOffset,
    markType,
    color
});

describe('findInsertedHighlight', () => {
    it('assigns duplicate text only to the exact inserted offset', () => {
        const highlights = [
            candidate('same', 4, 'highlight', '#ff0000'),
            candidate('same', 24, 'highlight', '#00ff00')
        ];

        expect(findInsertedHighlight(highlights, 'same', 24, 'highlight')?.color).toBe('#00ff00');
    });

    it.each(['highlight', 'underline', 'strikethrough', 'bold'] as const)('matches %s color', markType => {
        const highlight = candidate('text', 12, markType, '#123456');

        expect(findInsertedHighlight([highlight], 'text', 12, markType)?.color).toBe('#123456');
    });

    it('does not assign a color across mark types', () => {
        const highlights = [candidate('text', 12, 'underline', '#123456')];

        expect(findInsertedHighlight(highlights, 'text', 12, 'highlight')).toBeUndefined();
    });

    it('uses the nearest same-type fallback when offset drifts', () => {
        const highlights = [
            candidate('same', 4, 'highlight', '#ff0000'),
            candidate('same', 30, 'highlight', '#00ff00')
        ];

        expect(findInsertedHighlight(highlights, 'same', 25, 'highlight')?.color).toBe('#00ff00');
    });

    it('keeps the mark offset when standard footnote reference is appended', () => {
        const replaceStart = 7;
        const replacement = '==text==';
        const content = `prefix ${replacement}[^1]`;

        expect(content.indexOf(replacement)).toBe(replaceStart);
        expect(findInsertedHighlight([candidate('text', replaceStart, 'highlight', '#abcdef')], 'text', replaceStart, 'highlight')?.color)
            .toBe('#abcdef');
    });

    it('matches rendered native marks by text and leaves duplicate entries for later marks', () => {
        const highlights = [
            { ...candidate('same', 4, 'highlight', '#ff0000'), id: 'first' },
            { ...candidate('same', 24, 'highlight', '#00ff00'), id: 'second' }
        ];
        const claimed = new Set<string>();

        expect(findRenderedHighlight(highlights, 'same', 'highlight', claimed, h => h.id)?.id).toBe('first');
        claimed.add('first');
        expect(findRenderedHighlight(highlights, 'same', 'highlight', claimed, h => h.id)?.id).toBe('second');
    });

    it('recognizes a CM6 cm-highlight span as an inline color target', () => {
        expect(isNativeMarkColorTarget('SPAN', 'cm-highlight')).toBe(true);
        expect(isNativeMarkColorTarget('SPAN', 'cm-line')).toBe(false);
    });
});
