export interface HighlightColorCandidate {
    text: string;
    startOffset: number;
    markType?: 'highlight' | 'underline' | 'strikethrough' | 'bold';
    color?: string;
}

export function isNativeMarkColorTarget(tagName: string, className: string): boolean {
    return ['mark', 'strong', 'del', 's', 'u'].includes(tagName.toLowerCase()) ||
        className.split(/\s+/).includes('cm-highlight');
}

/** Find the inserted highlight without confusing duplicate text entries. */
export function findInsertedHighlight<T extends HighlightColorCandidate>(
    highlights: T[],
    text: string,
    offset: number,
    markType: NonNullable<T['markType']>
): T | undefined {
    const matchesType = (highlight: T) => (highlight.markType || 'highlight') === markType;
    const exact = highlights.find(highlight =>
        highlight.text === text &&
        highlight.startOffset === offset &&
        matchesType(highlight)
    );
    if (exact) return exact;

    const fallback = highlights
        .filter(highlight => highlight.text === text && matchesType(highlight))
        .sort((a, b) => Math.abs(a.startOffset - offset) - Math.abs(b.startOffset - offset))[0];
    if (fallback) {
        console.debug('[sidenote] Exact highlight offset did not match; using same-type fallback.');
    }
    return fallback;
}

export function findRenderedHighlight<T extends HighlightColorCandidate>(
    highlights: T[],
    text: string,
    markType: NonNullable<T['markType']>,
    claimedIds: Set<string>,
    getId: (highlight: T) => string
): T | undefined {
    return highlights.find(highlight =>
        !claimedIds.has(getId(highlight)) &&
        highlight.text.trim() === text.trim() &&
        (highlight.markType || 'highlight') === markType
    );
}
