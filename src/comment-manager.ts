import type { SideNoteComment } from "./types";
import { escapeRegExp, getIndexFromPosition, getPositionFromIndex, hashText } from "./utils";

export class CommentManager {
  private readonly minTextLength = 3;

  constructor(private comments: SideNoteComment[]) {}

  getAll(): SideNoteComment[] {
    return this.comments;
  }

  replaceAll(comments: SideNoteComment[]): void {
    this.comments = comments;
  }

  getForFile(path: string): SideNoteComment[] {
    return this.comments.filter((comment) => comment.filePath === path);
  }

  async add(comment: SideNoteComment): Promise<void> {
    if (!comment.selectedTextHash) {
      comment.selectedTextHash = await hashText(comment.selectedText);
    }
    this.comments.push(comment);
  }

  edit(timestamp: number, comment: string, color?: string): void {
    const found = this.comments.find((item) => item.timestamp === timestamp);
    if (!found) return;
    found.comment = comment;
    if (color) found.color = color;
  }

  delete(timestamp: number): void {
    const index = this.comments.findIndex((item) => item.timestamp === timestamp);
    if (index >= 0) this.comments.splice(index, 1);
  }

  renameFile(oldPath: string, newPath: string): void {
    for (const comment of this.comments) {
      if (comment.filePath === oldPath) comment.filePath = newPath;
    }
  }

  getOrphanedCount(): number {
    return this.comments.filter((comment) => comment.isOrphaned).length;
  }

  deleteOrphaned(): number {
    const before = this.comments.length;
    this.comments = this.comments.filter((comment) => !comment.isOrphaned);
    return before - this.comments.length;
  }

  async updateCoordinatesForFile(content: string, filePath: string): Promise<void> {
    const comments = this.getForFile(filePath);

    for (const comment of comments) {
      if (!comment.selectedText || comment.selectedText.length < this.minTextLength) {
        comment.isOrphaned = true;
        continue;
      }

      const approximateIndex = getIndexFromPosition(content, comment.startLine, comment.startChar);
      const located = await this.locateComment(content, comment, approximateIndex);

      if (located.index < 0) {
        comment.isOrphaned = true;
        continue;
      }

      const start = getPositionFromIndex(content, located.index);
      const end = getPositionFromIndex(content, located.index + located.text.length);
      comment.startLine = start.line;
      comment.startChar = start.ch;
      comment.endLine = end.line;
      comment.endChar = end.ch;
      comment.selectedText = located.text;
      comment.selectedTextHash = await hashText(located.text);
      comment.isOrphaned = false;
    }
  }

  private async locateComment(
    content: string,
    comment: SideNoteComment,
    approximateIndex: number,
  ): Promise<{ index: number; text: string }> {
    const byContext = this.locateByContext(content, comment, approximateIndex);
    if (byContext.index >= 0) return byContext;

    const matches: number[] = [];
    let searchFrom = 0;
    while (searchFrom < content.length) {
      const index = content.indexOf(comment.selectedText, searchFrom);
      if (index < 0) break;
      matches.push(index);
      searchFrom = index + 1;
    }

    if (!matches.length) return { index: -1, text: comment.selectedText };

    matches.sort((a, b) => Math.abs(a - approximateIndex) - Math.abs(b - approximateIndex));
    return { index: matches[0], text: comment.selectedText };
  }

  private locateByContext(
    content: string,
    comment: SideNoteComment,
    approximateIndex: number,
  ): { index: number; text: string } {
    const before = comment.contextBefore?.slice(-30);
    const after = comment.contextAfter?.slice(0, 30);
    if (!before || !after) return { index: -1, text: comment.selectedText };

    const regex = new RegExp(`${escapeRegExp(before)}([\\s\\S]*?)${escapeRegExp(after)}`, "g");
    const matches = Array.from(content.matchAll(regex));
    if (!matches.length) return { index: -1, text: comment.selectedText };

    matches.sort((a, b) => Math.abs((a.index || 0) - approximateIndex) - Math.abs((b.index || 0) - approximateIndex));
    const match = matches[0];
    const text = match[1] || comment.selectedText;
    return { index: (match.index || 0) + match[0].indexOf(text), text };
  }
}

