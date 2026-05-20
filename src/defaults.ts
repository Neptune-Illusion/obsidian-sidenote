import type { SideNoteSettings } from "./types";

export const VIEW_TYPE_SIDENOTE = "sidenote-view";

export const DEFAULT_SETTINGS: SideNoteSettings = {
  commentSortOrder: "position",
  showHighlights: true,
  highlightColor: "#FFC800",
  highlightOpacity: 0.2,
  markdownFolder: "side-note-comments",
  attachmentFolder: "side-note-attachments",
  enableSelectionToolbar: true,
};

