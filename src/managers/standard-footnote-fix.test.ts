/**
 * Verification tests for the standard-footnote placement fix.
 * Simulates the exact logic from main.ts addSidenoteCommentToSelection
 * (the !useInlineFootnotes branch) against the 3 reported scenarios:
 *   1. Normal text: footnote definition must land at the BOTTOM of the doc.
 *   2. Table: adding a comment must succeed (mark + ref + bottom definition).
 *   3. Table: definition must NOT appear below the table.
 */

export {};

// Faithful CodeMirror-style mock: offset<->pos and replaceSelection/replaceRange.
class MockEditor {
    private content: string;
    private cursor: { line: number; ch: number };
    private selFrom: { line: number; ch: number };
    private selTo: { line: number; ch: number };

    constructor(content: string, selFrom: { line: number; ch: number }, selTo: { line: number; ch: number }) {
        this.content = content;
        this.selFrom = selFrom;
        this.selTo = selTo;
        this.cursor = { ...selTo };
    }

    getValue(): string { return this.content; }

    getCursor(which?: 'from' | 'to'): { line: number; ch: number } {
        if (which === 'from') return { ...this.selFrom };
        if (which === 'to') return { ...this.selTo };
        return { ...this.cursor };
    }

    posToOffset(pos: { line: number; ch: number }): number {
        const lines = this.content.split('\n');
        let off = 0;
        for (let i = 0; i < pos.line; i++) off += lines[i].length + 1;
        return off + pos.ch;
    }

    offsetToPos(offset: number): { line: number; ch: number } {
        const lines = this.content.split('\n');
        let cur = 0;
        for (let line = 0; line < lines.length; line++) {
            if (cur + lines[line].length >= offset) return { line, ch: offset - cur };
            cur += lines[line].length + 1;
        }
        return { line: lines.length - 1, ch: lines[lines.length - 1].length };
    }

    // Replaces the current selection and moves cursor to end of inserted text.
    replaceSelection(text: string): void {
        const fromOff = this.posToOffset(this.selFrom);
        const toOff = this.posToOffset(this.selTo);
        this.content = this.content.slice(0, fromOff) + text + this.content.slice(toOff);
        this.cursor = this.offsetToPos(fromOff + text.length);
    }

    replaceRange(text: string, pos: { line: number; ch: number }): void {
        const off = this.posToOffset(pos);
        this.content = this.content.slice(0, off) + text + this.content.slice(off);
    }
}

// Mirrors the FIXED !useInlineFootnotes branch in main.ts addSidenoteCommentToSelection.
function addStandardFootnote(editor: MockEditor, selectedText: string, trimmedComment: string): { key: string } {
    const wrapped = `==${selectedText}==`;
    editor.replaceSelection(wrapped);

    const currentContent = editor.getValue();
    const usedKeys = new Set<string>();
    const footnoteKeyRegex = /\[\^([a-zA-Z0-9_]+)\]/g;
    let keyMatch: RegExpExecArray | null;
    while ((keyMatch = footnoteKeyRegex.exec(currentContent)) !== null) {
        usedKeys.add(keyMatch[1]);
    }
    let keyIndex = 1;
    while (usedKeys.has(`sn${keyIndex}`)) keyIndex++;
    const key = `sn${keyIndex}`;

    const cursorPos = editor.getCursor();
    editor.replaceRange(`[^${key}]`, cursorPos);

    const updatedContent = editor.getValue();
    const endPos = editor.offsetToPos(updatedContent.length);
    let prefix = '\n\n';
    if (/\n\s*\n$/.test(updatedContent)) prefix = '';
    else if (/\n$/.test(updatedContent)) prefix = '\n';
    const definitionContent = trimmedComment
        .replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').join('\n    ');
    editor.replaceRange(`${prefix}[^${key}]: ${definitionContent}`, endPos);
    return { key };
}

describe('Standard footnote placement fix', () => {
    it('Scenario 1: normal text — definition lands at the BOTTOM of the document', () => {
        const doc = [
            '# Title',
            '',
            'First paragraph with TARGET here.',
            '',
            'Second paragraph.',
            '',
            'Third paragraph.',
        ].join('\n');
        // Select "TARGET" in the first paragraph.
        const start = doc.indexOf('TARGET');
        const editor = new MockEditor(doc, posOf(doc, start), posOf(doc, start + 'TARGET'.length));

        addStandardFootnote(editor, 'TARGET', 'my comment');
        const out = editor.getValue();

        // Mark + reference inserted at the highlight, inline.
        expect(out).toContain('==TARGET==[^sn1] here.');
        // Definition is the LAST non-empty content, i.e. at the bottom — not after paragraph 1.
        const lines = out.split('\n').filter(l => l.trim().length > 0);
        expect(lines[lines.length - 1]).toBe('[^sn1]: my comment');
        // Definition must come AFTER the third paragraph in the document.
        expect(out.indexOf('[^sn1]: my comment')).toBeGreaterThan(out.indexOf('Third paragraph.'));
    });

    it('Scenario 2: table cell — comment is added successfully (mark + ref + bottom definition)', () => {
        const doc = [
            '| Col1 | Col2 |',
            '|------|------|',
            '| CELLTEXT | other |',
            '',
            'Text after the table.',
        ].join('\n');
        const start = doc.indexOf('CELLTEXT');
        const editor = new MockEditor(doc, posOf(doc, start), posOf(doc, start + 'CELLTEXT'.length));

        addStandardFootnote(editor, 'CELLTEXT', 'table comment');
        const out = editor.getValue();

        // Issue #3: the comment IS added — both the mark and the footnote reference exist in the cell.
        expect(out).toContain('| ==CELLTEXT==[^sn1] | other |');
        // The table structure is preserved (still a valid 3-pipe row).
        const cellRow = out.split('\n').find(l => l.includes('CELLTEXT'))!;
        expect((cellRow.match(/\|/g) || []).length).toBe(3);
        // The definition exists at the bottom.
        expect(out).toContain('[^sn1]: table comment');
    });

    it('Scenario 2b: table — definition does NOT appear directly below the table', () => {
        const doc = [
            '| Col1 | Col2 |',
            '|------|------|',
            '| CELLTEXT | other |',
            '',
            'Paragraph after table.',
        ].join('\n');
        const start = doc.indexOf('CELLTEXT');
        const editor = new MockEditor(doc, posOf(doc, start), posOf(doc, start + 'CELLTEXT'.length));

        addStandardFootnote(editor, 'CELLTEXT', 'c');
        const out = editor.getValue();

        // The definition must be AFTER the trailing paragraph, i.e. truly at document end,
        // not sandwiched between the table and the following paragraph.
        expect(out.indexOf('[^sn1]: c')).toBeGreaterThan(out.indexOf('Paragraph after table.'));
        expect(out.split('\n').filter(l => l.trim()).pop()).toBe('[^sn1]: c');
    });

    it('generates non-colliding keys when footnotes already exist', () => {
        const doc = 'Para with TARGET.\n\n[^sn1]: existing one';
        const start = doc.indexOf('TARGET');
        const editor = new MockEditor(doc, posOf(doc, start), posOf(doc, start + 'TARGET'.length));

        const { key } = addStandardFootnote(editor, 'TARGET', 'second');
        expect(key).toBe('sn2');
        expect(editor.getValue()).toContain('==TARGET==[^sn2]');
        expect(editor.getValue()).toContain('[^sn2]: second');
    });

    it('multiline comment is indented as a continuation in the definition', () => {
        const doc = 'Para with TARGET.';
        const start = doc.indexOf('TARGET');
        const editor = new MockEditor(doc, posOf(doc, start), posOf(doc, start + 'TARGET'.length));

        addStandardFootnote(editor, 'TARGET', 'line one\nline two');
        expect(editor.getValue()).toContain('[^sn1]: line one\n    line two');
    });
});

// Helper: convert a string offset into a {line, ch} position.
function posOf(content: string, offset: number): { line: number; ch: number } {
    const before = content.slice(0, offset);
    const line = (before.match(/\n/g) || []).length;
    const ch = offset - (before.lastIndexOf('\n') + 1);
    return { line, ch };
}
