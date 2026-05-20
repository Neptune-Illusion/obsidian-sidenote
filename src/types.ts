export type MarkType = "highlight" | "underline" | "strikethrough" | "bold";

export interface SideNoteComment {
  timestamp: number;
  filePath: string;
  selectedText: string;
  selectedTextHash?: string;
  comment: string;
  color?: string;
  startLine: number;
  startChar: number;
  endLine: number;
  endChar: number;
  contextBefore?: string;
  contextAfter?: string;
  markType?: MarkType;
  isOrphaned?: boolean;
  commentPath?: string;
}

export interface SideNoteSettings {
  commentSortOrder: "position" | "timestamp";
  showHighlights: boolean;
  highlightColor: string;
  highlightOpacity: number;
  markdownFolder: string;
  attachmentFolder: string;
  enableSelectionToolbar: boolean;
}

export interface SideNoteData extends SideNoteSettings {
  comments?: SideNoteComment[];
  imageHashes?: Record<string, string>;
}

