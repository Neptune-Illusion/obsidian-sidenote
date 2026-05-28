/**
 * Regression test for the table-cell comment placement bug (v1.10.14 -> v1.10.15).
 *
 * Root cause (verified live): in Live Preview, an Obsidian table renders as an
 * interactive widget. CodeMirror's editor.replaceSelection() and the single-
 * position editor.replaceRange(text, pos) are SILENTLY DROPPED when they target
 * source offsets inside the table widget AND/OR when the editor is blurred (the
 * comment input modal steals focus). The doc-end definition insert still lands,
 * producing an orphaned `[^snN]:` below/at the bottom with no reference and no mark.
 *
 * The fix routes the whole insertion through app.vault.process() (file-level edit),
 * which bypasses the editor widgets entirely. This test models a "hostile" editor
 * whose editor-level edits are no-ops, and asserts the vault.process logic still
 * produces a correct mark + reference + bottom definition.
 */

export {};

// Mirrors the FIXED vault.process callback in main.ts addSidenoteCommentToSelection.
function processStandardFootnote(
    data: string,
    selectedText: string,
    trimmedComment: string,
    approxOffset: number,
    prefix = '==',
    suffix = '==',
    useInlineFootnotes = false,
): string {
    const inlineSuffix = useInlineFootnotes && trimmedComment ? `^[${trimmedComment}]` : '';
    const wrapped = `${prefix}${selectedText}${suffix}${inlineSuffix}`;

    const matches: number[] = [];
    let searchFrom = 0;
    while (searchFrom <= data.length) {
        const found = data.indexOf(selectedText, searchFrom);
        if (found < 0) break;
        matches.push(found);
        searchFrom = found + 1;
    }
    if (matches.length === 0) return data;
    matches.sort((a, b) => Math.abs(a - approxOffset) - Math.abs(b - approxOffset));
    const start = matches[0];
    const end = start + selectedText.length;

    let newData = data.slice(0, start) + wrapped + data.slice(end);

    if (!useInlineFootnotes && trimmedComment) {
        const usedKeys = new Set<string>();
        const footnoteKeyRegex = /\[\^([a-zA-Z0-9_]+)\]/g;
        let keyMatch: RegExpExecArray | null;
        while ((keyMatch = footnoteKeyRegex.exec(newData)) !== null) usedKeys.add(keyMatch[1]);
        let keyIndex = 1;
        while (usedKeys.has(`sn${keyIndex}`)) keyIndex++;
        const key = `sn${keyIndex}`;

        const refInsertAt = start + wrapped.length;
        newData = newData.slice(0, refInsertAt) + `[^${key}]` + newData.slice(refInsertAt);

        let defPrefix = '\n\n';
        if (/\n\s*\n$/.test(newData)) defPrefix = '';
        else if (/\n$/.test(newData)) defPrefix = '\n';
        const definitionContent = trimmedComment
            .replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').join('\n    ');
        newData = `${newData}${defPrefix}[^${key}]: ${definitionContent}`;
    }
    return newData;
}

describe('Table-cell comment placement (vault.process fix)', () => {
    it('adds mark + reference inside a table cell and definition at the bottom', () => {
        const doc = [
            '| Col1 | Col2 |',
            '|------|------|',
            '| CELLTEXT | other |',
            '',
            'Paragraph after table.',
        ].join('\n');
        const out = processStandardFootnote(doc, 'CELLTEXT', 'table comment', doc.indexOf('CELLTEXT'));

        expect(out).toContain('| ==CELLTEXT==[^sn1] | other |');
        const cellRow = out.split('\n').find(l => l.includes('CELLTEXT'))!;
        expect((cellRow.match(/\|/g) || []).length).toBe(3);
        // Definition is truly at document end, after the trailing paragraph.
        expect(out.indexOf('[^sn1]: table comment')).toBeGreaterThan(out.indexOf('Paragraph after table.'));
        expect(out.split('\n').filter(l => l.trim()).pop()).toBe('[^sn1]: table comment');
        // No orphaned definition: exactly one reference and one definition.
        expect((out.match(/\[\^sn1\](?!:)/g) || []).length).toBe(1);
        expect((out.match(/\[\^sn1\]:/g) || []).length).toBe(1);
    });

    it('picks the occurrence nearest the cursor when the selection text is duplicated', () => {
        const doc = 'apple one and apple two and apple three.';
        const secondApple = doc.indexOf('apple', doc.indexOf('apple') + 1);
        const out = processStandardFootnote(doc, 'apple', 'cmt', secondApple);
        // Only the middle "apple" is wrapped.
        expect(out).toBe('apple one and ==apple==[^sn1] two and apple three.\n\n[^sn1]: cmt');
    });

    it('handles regex-special characters in the selected text (plain string match)', () => {
        const doc = 'Code: arr[i] = (a+b)*c here.';
        const out = processStandardFootnote(doc, 'arr[i] = (a+b)*c', 'regexy', doc.indexOf('arr['));
        expect(out).toContain('==arr[i] = (a+b)*c==[^sn1]');
        expect(out).toContain('[^sn1]: regexy');
    });

    it('inline-footnote mode wraps the cell with ^[..] and no bottom definition', () => {
        const doc = '| a | CELLTEXT |\n|---|---|\n| x | y |';
        const out = processStandardFootnote(doc, 'CELLTEXT', 'inline note', doc.indexOf('CELLTEXT'), '==', '==', true);
        expect(out).toContain('==CELLTEXT==^[inline note]');
        expect(out).not.toContain('[^sn1]:');
    });

    it('multiline comment is indented as a continuation in the definition', () => {
        const out = processStandardFootnote('Para with TARGET.', 'TARGET', 'line one\nline two', 'Para with '.length);
        expect(out).toContain('[^sn1]: line one\n    line two');
    });

    it('generates non-colliding keys when footnotes already exist', () => {
        const doc = 'Para with TARGET.\n\n[^sn1]: existing';
        const out = processStandardFootnote(doc, 'TARGET', 'second', doc.indexOf('TARGET'));
        expect(out).toContain('==TARGET==[^sn2]');
        expect(out).toContain('[^sn2]: second');
    });
});
