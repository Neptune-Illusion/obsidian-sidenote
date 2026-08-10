export {};

interface TestHighlight {
    text: string;
    startOffset: number;
    endOffset: number;
    prefix: string;
    suffix: string;
}

function clearFromSource(content: string, highlights: TestHighlight[]): string {
    let result = content;
    // This models the production loop: remove from the greatest offset first.
    for (const highlight of [...highlights].sort((a, b) => b.startOffset - a.startOffset)) {
        const before = result.slice(0, highlight.startOffset);
        const marked = result.slice(highlight.startOffset, highlight.endOffset);
        const after = result.slice(highlight.endOffset);
        const footnotes = after.match(/^(?:\s*(?:\^\[[^\]]*\]|\[\^[\w-]+\](?!:)))+/)?.[0] || '';
        const names = [...footnotes.matchAll(/\[\^([\w-]+)\]/g)].map(match => match[1]);
        result = before + highlight.text + after.slice(footnotes.length);
        for (const name of names) {
            if (!new RegExp(`\\[\\^${name}\\](?!:)`).test(result)) {
                result = result.replace(new RegExp(`^\\[\\^${name}\\]:[^\\n]*(?:\\n|$)`, 'm'), '');
            }
        }
        expect(marked).toContain(highlight.text);
    }
    return result;
}

describe('clear selection behavior', () => {
    it('removes inline and standard footnotes with their mark syntax', () => {
        const content = 'A ==one==^[inline] B **two**[^2]\n\n[^2]: standard';
        const highlights = [
            { text: 'one', startOffset: content.indexOf('==one=='), endOffset: content.indexOf('==one==') + 7, prefix: '==', suffix: '==' },
            { text: 'two', startOffset: content.indexOf('**two**'), endOffset: content.indexOf('**two**') + 7, prefix: '**', suffix: '**' }
        ];

        expect(clearFromSource(content, highlights)).toBe('A one B two\n\n');
    });

    it('clears multiple marks from the end without damaging earlier content', () => {
        const content = '==first== and ~~second~~ and <u>third</u>';
        const highlights = [
            { text: 'first', startOffset: 0, endOffset: 9, prefix: '==', suffix: '==' },
            { text: 'second', startOffset: 14, endOffset: 24, prefix: '~~', suffix: '~~' },
            { text: 'third', startOffset: 29, endOffset: 41, prefix: '<u>', suffix: '</u>' }
        ];

        expect(clearFromSource(content, highlights)).toBe('first and second and third');
    });
});
