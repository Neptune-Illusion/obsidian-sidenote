import { ItemView, MarkdownRenderer, Notice, TFile, WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_SIDENOTE } from "./defaults";
import type { SideNoteComment } from "./types";
import type SideNotePlugin from "../main";

export class SideNoteView extends ItemView {
  private file: TFile | null = null;
  private searchQuery = "";
  private listEl!: HTMLElement;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: SideNotePlugin) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_SIDENOTE;
  }

  getDisplayText(): string {
    return "Side Comments";
  }

  getIcon(): string {
    return "message-square-text";
  }

  async onOpen(): Promise<void> {
    this.file = this.app.workspace.getActiveFile();
    this.render();
  }

  setFile(file: TFile | null): void {
    this.file = file;
    this.render();
  }

  refresh(): void {
    this.render();
  }

  private render(): void {
    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.addClass("sidenote-view-container");

    const toolbar = root.createDiv("sidenote-toolbar");
    const search = toolbar.createEl("input", { type: "search", placeholder: "Search comments..." });
    search.value = this.searchQuery;
    search.addEventListener("input", () => {
      this.searchQuery = search.value.toLowerCase();
      this.renderList();
    });

    const sortButton = toolbar.createEl("button", {
      text: this.plugin.settings.commentSortOrder === "position" ? "Position" : "Time",
    });
    sortButton.onClickEvent(async () => {
      this.plugin.settings.commentSortOrder =
        this.plugin.settings.commentSortOrder === "position" ? "timestamp" : "position";
      await this.plugin.savePluginData();
      this.render();
    });

    const exportButton = toolbar.createEl("button", { text: "Export" });
    exportButton.onClickEvent(() => this.exportCurrentFile());

    this.listEl = root.createDiv("sidenote-comments-list-wrapper");
    this.renderList();
  }

  private renderList(): void {
    this.listEl.empty();
    const file = this.file || this.app.workspace.getActiveFile();
    if (!file) {
      this.listEl.createDiv("sidenote-empty-state").createEl("p", { text: "Open a note to view comments." });
      return;
    }
    this.file = file;

    let comments = this.plugin.commentManager.getForFile(file.path);
    if (this.searchQuery) {
      comments = comments.filter((comment) => {
        return (
          comment.selectedText.toLowerCase().includes(this.searchQuery) ||
          comment.comment.toLowerCase().includes(this.searchQuery)
        );
      });
    }

    comments = [...comments].sort((a, b) => {
      if (this.plugin.settings.commentSortOrder === "timestamp") return b.timestamp - a.timestamp;
      return a.startLine - b.startLine || a.startChar - b.startChar || a.timestamp - b.timestamp;
    });

    if (!comments.length) {
      this.listEl
        .createDiv("sidenote-empty-state")
        .createEl("p", { text: this.searchQuery ? "No comments match your search." : "No comments for this file yet." });
      return;
    }

    const container = this.listEl.createDiv("sidenote-comments-container");
    for (const comment of comments) {
      this.renderComment(container, comment, file);
    }
  }

  private renderComment(container: HTMLElement, comment: SideNoteComment, file: TFile): void {
    const item = container.createDiv("sidenote-comment-item");
    item.setAttribute("data-comment-timestamp", String(comment.timestamp));
    if (comment.isOrphaned) item.addClass("orphaned");
    if (comment.color) item.style.setProperty("--sidenote-highlight-border", comment.color);

    const header = item.createDiv("sidenote-comment-header");
    const textInfo = header.createDiv("sidenote-comment-text-info");
    textInfo.createDiv("sidenote-selected-text").setText(comment.selectedText);
    textInfo.createDiv("sidenote-timestamp").setText(new Date(comment.timestamp).toLocaleString());

    const actions = header.createDiv("sidenote-comment-actions");
    const editButton = actions.createEl("button", { text: "Edit" });
    editButton.onClickEvent((event) => {
      event.stopPropagation();
      this.plugin.openEditModal(comment);
    });

    const deleteButton = actions.createEl("button", { text: "Delete" });
    deleteButton.addClass("sidenote-menu-delete");
    deleteButton.onClickEvent(async (event) => {
      event.stopPropagation();
      this.plugin.deleteComment(comment.timestamp);
    });

    const content = item.createDiv("sidenote-comment-content markdown-rendered");
    MarkdownRenderer.renderMarkdown(comment.comment || "", content, file.path, this.plugin);

    item.onClickEvent(() => this.plugin.revealComment(comment));
  }

  private async exportCurrentFile(): Promise<void> {
    const file = this.file || this.app.workspace.getActiveFile();
    if (!file) return;
    const comments = this.plugin.commentManager.getForFile(file.path);
    if (!comments.length) {
      new Notice("No comments to export.");
      return;
    }
    const path = await this.plugin.exportCommentsForFile(file, comments);
    new Notice(`Exported comments to ${path}`);
  }
}

