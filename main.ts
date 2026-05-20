import {
  Editor,
  MarkdownPostProcessorContext,
  MarkdownView,
  Menu,
  Notice,
  Plugin,
  setIcon,
  TAbstractFile,
  TFile,
  WorkspaceLeaf,
} from "obsidian";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import { Extension, RangeSetBuilder } from "@codemirror/state";
import { CommentManager } from "./src/comment-manager";
import { CommentModal } from "./src/comment-modal";
import { DEFAULT_SETTINGS, VIEW_TYPE_SIDENOTE } from "./src/defaults";
import { SideNoteSettingTab } from "./src/settings-tab";
import { SideNoteView } from "./src/sidenote-view";
import type { MarkType, SideNoteComment, SideNoteData, SideNoteSettings } from "./src/types";
import { ensureFolder, getIndexFromPosition, hashText, hexToRgb, sanitizeFileName } from "./src/utils";

class SideNoteMarkerWidget extends WidgetType {
  constructor(private readonly comment: SideNoteComment) {
    super();
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "sidenote-inline-marker";
    span.dataset.commentTimestamp = String(this.comment.timestamp);
    return span;
  }
}

export default class SideNotePlugin extends Plugin {
  settings: SideNoteSettings = { ...DEFAULT_SETTINGS };
  comments: SideNoteComment[] = [];
  imageHashes: Record<string, string> = {};
  commentManager = new CommentManager(this.comments);

  private selectionToolbarEl: HTMLElement | null = null;
  private editorExtension: Extension | undefined;

  async onload(): Promise<void> {
    await this.loadPluginData();
    this.commentManager = new CommentManager(this.comments);

    this.registerView(VIEW_TYPE_SIDENOTE, (leaf) => new SideNoteView(leaf, this));
    this.addRibbonIcon("message-square-text", "Open SideNote View", () => this.activateView());

    this.addCommand({
      id: "open-comment-view",
      name: "Open SideNote View",
      callback: () => this.activateView(),
    });
    this.addCommand({
      id: "add-comment-to-selection",
      name: "Add comment to selection (Highlight)",
      editorCallback: (editor, view) => this.addCommentFromSelection(editor, view, "highlight"),
    });
    this.addCommand({
      id: "add-underline-comment-to-selection",
      name: "Add comment to selection (Underline)",
      editorCallback: (editor, view) => this.addCommentFromSelection(editor, view, "underline"),
    });
    this.addCommand({
      id: "add-strikethrough-comment-to-selection",
      name: "Add comment to selection (Strikethrough)",
      editorCallback: (editor, view) => this.addCommentFromSelection(editor, view, "strikethrough"),
    });
    this.addCommand({
      id: "add-bold-comment-to-selection",
      name: "Add comment to selection (Bold)",
      editorCallback: (editor, view) => this.addCommentFromSelection(editor, view, "bold"),
    });

    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu: Menu, editor: Editor, view: MarkdownView) => {
        if (!editor.getSelection()) return;
        this.addMenuItem(menu, "Add comment (Highlight)", "highlighter", () =>
          this.addCommentFromSelection(editor, view, "highlight"),
        );
        this.addMenuItem(menu, "Add comment (Underline)", "underline", () =>
          this.addCommentFromSelection(editor, view, "underline"),
        );
        this.addMenuItem(menu, "Add comment (Strikethrough)", "strikethrough", () =>
          this.addCommentFromSelection(editor, view, "strikethrough"),
        );
        this.addMenuItem(menu, "Add comment (Bold)", "bold", () => this.addCommentFromSelection(editor, view, "bold"));
      }),
    );

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        const file = this.app.workspace.getActiveFile();
        for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_SIDENOTE)) {
          (leaf.view as SideNoteView).setFile(file);
        }
      }),
    );
    this.registerEvent(
      this.app.vault.on("rename", (file: TAbstractFile, oldPath: string) => {
        if (file instanceof TFile) {
          this.commentManager.renameFile(oldPath, file.path);
          this.comments = this.commentManager.getAll();
          this.savePluginData();
        }
      }),
    );
    this.registerEvent(
      this.app.vault.on("modify", async (file) => {
        if (file instanceof TFile && file.extension === "md") {
          await this.updateCommentCoordinates(file);
        }
      }),
    );

    this.registerMarkdownPostProcessor((el, ctx) => this.renderReadingMode(el, ctx));
    this.registerEditorExtension([this.createEditorExtension(), this.createSelectionToolbarExtension()]);

    this.addSettingTab(new SideNoteSettingTab(this.app, this));
    this.updateDynamicStyles();
  }

  onunload(): void {
    this.selectionToolbarEl?.remove();
    this.selectionToolbarEl = null;
  }

  async loadPluginData(): Promise<void> {
    const data = ((await this.loadData()) || {}) as Partial<SideNoteData>;
    this.settings = { ...DEFAULT_SETTINGS };
    for (const key of Object.keys(DEFAULT_SETTINGS) as Array<keyof SideNoteSettings>) {
      const value = data[key];
      if (value !== undefined) {
        (this.settings as unknown as Record<string, unknown>)[key] = value;
      }
    }
    this.comments = Array.isArray(data.comments) ? data.comments : [];
    this.imageHashes = data.imageHashes || {};

    let changed = false;
    for (const comment of this.comments) {
      if (!comment.selectedTextHash) {
        comment.selectedTextHash = await hashText(comment.selectedText);
        changed = true;
      }
    }
    if (changed) await this.savePluginData();
  }

  async savePluginData(): Promise<void> {
    this.comments = this.commentManager.getAll();
    await this.saveData({
      ...this.settings,
      comments: this.comments,
      imageHashes: this.imageHashes,
    });
    this.refreshViews();
    this.refreshEditorDecorations();
  }

  async activateView(): Promise<void> {
    let leaf: WorkspaceLeaf | null = this.app.workspace.getLeavesOfType(VIEW_TYPE_SIDENOTE)[0] || null;
    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false);
      await leaf?.setViewState({ type: VIEW_TYPE_SIDENOTE, active: true });
    }
    if (leaf) this.app.workspace.revealLeaf(leaf);
  }

  async addCommentFromSelection(
    editor: Editor,
    view: { file: TFile | null } | null,
    markType: MarkType,
    colorOverride?: string,
  ): Promise<void> {
    const file = view?.file || this.app.workspace.getActiveFile();
    const selectedText = editor.getSelection();
    if (!file || !selectedText) {
      new Notice("Please select some text to add a comment.");
      return;
    }

    const from = editor.getCursor("from");
    const to = editor.getCursor("to");
    const content = editor.getValue();
    const startIndex = getIndexFromPosition(content, from.line, from.ch);
    const endIndex = getIndexFromPosition(content, to.line, to.ch);
    const contextBefore = content.slice(Math.max(0, startIndex - 100), startIndex);
    const contextAfter = content.slice(endIndex, Math.min(content.length, endIndex + 100));

    new CommentModal(
      this.app,
      this,
      async (comment, color) => {
        await this.commentManager.add({
          timestamp: Date.now(),
          filePath: file.path,
          selectedText,
          selectedTextHash: await hashText(selectedText),
          comment,
          color,
          startLine: from.line,
          startChar: from.ch,
          endLine: to.line,
          endChar: to.ch,
          contextBefore,
          contextAfter,
          markType,
          isOrphaned: false,
        });
        await this.savePluginData();
      },
      "",
      file.path,
      colorOverride || this.settings.highlightColor,
    ).open(this.getSelectionRect());
  }

  openEditModal(comment: SideNoteComment): void {
    new CommentModal(
      this.app,
      this,
      async (text, color) => {
        this.commentManager.edit(comment.timestamp, text, color);
        await this.savePluginData();
      },
      comment.comment,
      comment.filePath,
      comment.color || this.settings.highlightColor,
    ).open();
  }

  async deleteComment(timestamp: number): Promise<void> {
    this.commentManager.delete(timestamp);
    await this.savePluginData();
  }

  async revealComment(comment: SideNoteComment): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(comment.filePath);
    if (!(file instanceof TFile)) return;
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file);
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) return;
    view.editor.setSelection(
      { line: comment.startLine, ch: comment.startChar },
      { line: comment.endLine, ch: comment.endChar },
    );
    view.editor.scrollIntoView(
      {
        from: { line: comment.startLine, ch: comment.startChar },
        to: { line: comment.endLine, ch: comment.endChar },
      },
      true,
    );
  }

  async exportCommentsForFile(file: TFile, comments: SideNoteComment[]): Promise<string> {
    const folder = this.settings.markdownFolder.trim() || DEFAULT_SETTINGS.markdownFolder;
    await ensureFolder(this.app.vault, folder);
    const date = new Date().toISOString().slice(0, 10);
    const path = `${folder}/${sanitizeFileName(file.basename)}-${date}-sidenote.md`;
    const body = comments
      .map((comment) => {
        return [
          `> [!quote] sidenote`,
          `> ${comment.selectedText.replace(/\n/g, "\n> ")}`,
          "",
          comment.comment,
          "",
          `Source: [[${file.basename}]]`,
          `Created: ${new Date(comment.timestamp).toLocaleString()}`,
        ].join("\n");
      })
      .join("\n\n---\n\n");

    if (this.app.vault.getAbstractFileByPath(path)) {
      await this.app.vault.modify(this.app.vault.getAbstractFileByPath(path) as TFile, body);
    } else {
      await this.app.vault.create(path, body);
    }
    return path;
  }

  refreshViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_SIDENOTE)) {
      (leaf.view as SideNoteView).refresh();
    }
  }

  refreshEditorDecorations(): void {
    this.app.workspace.updateOptions();
  }

  updateDynamicStyles(): void {
    const id = "sidenote-dynamic-styles";
    document.getElementById(id)?.remove();
    const rgb = hexToRgb(this.settings.highlightColor) || { r: 255, g: 200, b: 0 };
    const opacity = this.settings.highlightOpacity;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      body {
        --sidenote-highlight-color: rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity});
        --sidenote-highlight-hover: rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.min(opacity + 0.15, 1)});
        --sidenote-highlight-border: rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.min(opacity + 0.4, 1)});
        --sidenote-orphaned-color: rgba(255, 80, 80, 0.2);
        --sidenote-orphaned-hover: rgba(255, 80, 80, 0.3);
        --sidenote-orphaned-border: rgba(255, 80, 80, 0.6);
      }
    `;
    document.head.appendChild(style);
    this.refreshEditorDecorations();
  }

  private addMenuItem(menu: Menu, title: string, icon: string, onClick: () => void): void {
    menu.addItem((item) => item.setTitle(title).setIcon(icon).onClick(onClick));
  }

  private getSelectionRect(): DOMRect | undefined {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return undefined;
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (!rect.width && !rect.height) return undefined;
    return rect;
  }

  private createEditorExtension() {
    const plugin = this;
    this.editorExtension = ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
          this.decorations = this.buildDecorations(view);
        }

        update(update: ViewUpdate): void {
          if (update.docChanged || update.viewportChanged || update.selectionSet) {
            this.decorations = this.buildDecorations(update.view);
          }
        }

        buildDecorations(view: EditorView): DecorationSet {
          const builder = new RangeSetBuilder<Decoration>();
          if (!plugin.settings.showHighlights) return builder.finish();
          const activeFile = plugin.app.workspace.getActiveFile();
          if (!activeFile) return builder.finish();

          const content = view.state.doc.toString();
          const comments = plugin.commentManager
            .getForFile(activeFile.path)
            .filter((comment) => !comment.isOrphaned)
            .sort((a, b) => a.startLine - b.startLine || a.startChar - b.startChar);

          for (const comment of comments) {
            const from = getIndexFromPosition(content, comment.startLine, comment.startChar);
            const to = getIndexFromPosition(content, comment.endLine, comment.endChar);
            if (from >= to || to > content.length) continue;
            const cls = `sidenote-highlight sidenote-mark-${comment.markType || "highlight"}`;
            const attrs: Record<string, string> = { "data-comment-timestamp": String(comment.timestamp) };
            if (comment.color) {
              const rgb = hexToRgb(comment.color);
              if (rgb) {
                attrs.style = `--sidenote-highlight-color: rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${plugin.settings.highlightOpacity}); --sidenote-highlight-border: ${comment.color};`;
              }
            }
            builder.add(from, to, Decoration.mark({ class: cls, attributes: attrs }));
            builder.add(to, to, Decoration.widget({ widget: new SideNoteMarkerWidget(comment), side: 1 }));
          }
          return builder.finish();
        }
      },
      { decorations: (value) => value.decorations },
    );
    return this.editorExtension;
  }

  private createSelectionToolbarExtension(): Extension {
    const plugin = this;
    return ViewPlugin.fromClass(
      class {
        private toolbar: HTMLElement | null = null;

        constructor(private readonly view: EditorView) {}

        update(update: ViewUpdate): void {
          if (update.selectionSet || update.viewportChanged || update.docChanged) {
            window.setTimeout(() => this.checkSelection(), 10);
          }
        }

        destroy(): void {
          this.hideToolbar();
        }

        private checkSelection(): void {
          if (!plugin.settings.enableSelectionToolbar) {
            this.hideToolbar();
            return;
          }

          const selection = this.view.state.selection.main;
          const selectedText = selection.empty ? "" : this.view.state.sliceDoc(selection.from, selection.to);
          if (selection.empty || !selectedText.trim()) {
            this.hideToolbar();
            return;
          }

          this.showToolbar(selection.from, selection.to);
        }

        private showToolbar(from: number, to: number): void {
          if (!this.toolbar) {
            this.toolbar = document.createElement("div");
            this.toolbar.className = "sidenote-selection-toolbar";
            document.body.appendChild(this.toolbar);
            this.buildToolbarUI();
            this.toolbar.addEventListener("mousedown", (event) => event.preventDefault());
          }

          const endCoords = this.view.coordsAtPos(to);
          const startCoords = this.view.coordsAtPos(from);
          if (!endCoords || !startCoords) return;

          const top = Math.min(endCoords.top, startCoords.top);
          const left = (endCoords.left + startCoords.left) / 2;
          this.toolbar.style.left = `${left}px`;
          this.toolbar.style.top = `${top}px`;
        }

        private hideToolbar(): void {
          this.toolbar?.remove();
          this.toolbar = null;
        }

        private buildToolbarUI(): void {
          if (!this.toolbar) return;

          const colorInput = document.createElement("input");
          colorInput.type = "color";
          colorInput.className = "sidenote-toolbar-color-picker";
          colorInput.value = plugin.settings.highlightColor || "#FFC800";

          const createButton = (title: string, markType: MarkType, icon: string): HTMLButtonElement => {
            const button = document.createElement("button");
            button.className = "sidenote-toolbar-btn";
            button.title = title;
            setIcon(button, icon);
            button.onclick = () => {
              const active = plugin.app.workspace.activeEditor;
              const editor = active?.editor;
              if (editor && active) {
                plugin.addCommentFromSelection(editor, active, markType, colorInput.value);
              }
              this.hideToolbar();
            };
            return button;
          };

          this.toolbar.appendChild(createButton("Highlight", "highlight", "highlight-glyph"));
          this.toolbar.appendChild(createButton("Underline", "underline", "underline-glyph"));
          this.toolbar.appendChild(createButton("Strikethrough", "strikethrough", "strikethrough-glyph"));
          this.toolbar.appendChild(createButton("Bold", "bold", "bold-glyph"));
          this.toolbar.createDiv("sidenote-toolbar-divider");
          this.toolbar.appendChild(colorInput);
        }
      },
    );
  }

  private async renderReadingMode(el: HTMLElement, ctx: MarkdownPostProcessorContext): Promise<void> {
    if (!this.settings.showHighlights) return;
    const sourcePath = ctx.sourcePath;
    const comments = this.commentManager.getForFile(sourcePath).filter((comment) => !comment.isOrphaned);
    if (!comments.length) return;
    el.addClass("sidenote-reading-root");
    const layer = el.createDiv("sidenote-reading-layer");
    for (const comment of comments) {
      const note = layer.createDiv("sidenote-reading-note");
      note.dataset.commentTimestamp = String(comment.timestamp);
      if (comment.color) note.style.setProperty("--sidenote-reading-accent", comment.color);
      note.createDiv("sidenote-reading-note-line");
      note.createDiv("sidenote-reading-note-body markdown-rendered").setText(comment.comment);
    }
  }

  private updateSelectionToolbar(): void {
    this.selectionToolbarEl?.remove();
    this.selectionToolbarEl = null;
    if (!this.settings.enableSelectionToolbar) return;

    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || !view.editor.getSelection()) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (!rect.width && !rect.height) return;

    const toolbar = document.body.createDiv("sidenote-selection-toolbar");
    toolbar.style.left = `${rect.left + rect.width / 2}px`;
    toolbar.style.top = `${Math.max(8, rect.top - 44)}px`;
    toolbar.addEventListener("mousedown", (event) => event.preventDefault());

    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.className = "sidenote-toolbar-color-picker";
    colorInput.value = this.settings.highlightColor || "#FFC800";

    const buttons: Array<[string, string, MarkType]> = [
      ["highlighter", "Highlight", "highlight"],
      ["underline", "Underline", "underline"],
      ["strikethrough", "Strikethrough", "strikethrough"],
      ["bold", "Bold", "bold"],
    ];
    for (const [icon, title, mark] of buttons) {
      const button = toolbar.createEl("button");
      button.className = "sidenote-toolbar-btn";
      button.title = title;
      setIcon(button, icon);
      button.onClickEvent((event) => {
        event.preventDefault();
        event.stopPropagation();
        this.addCommentFromSelection(view.editor, view, mark, colorInput.value);
        toolbar.remove();
      });
    }
    toolbar.createDiv("sidenote-toolbar-divider");
    toolbar.appendChild(colorInput);
    this.selectionToolbarEl = toolbar;
  }

  private async updateCommentCoordinates(file: TFile): Promise<void> {
    const content = await this.app.vault.read(file);
    await this.commentManager.updateCoordinatesForFile(content, file.path);
    this.comments = this.commentManager.getAll();
    await this.savePluginData();
  }

  private async savePastedImage(file: File, sourceFile: TFile): Promise<string | null> {
    const arrayBuffer = await file.arrayBuffer();
    const hash = await hashText(`${file.name}:${file.size}:${file.lastModified}:${Array.from(new Uint8Array(arrayBuffer.slice(0, 64))).join(",")}`);
    if (this.imageHashes[hash]) return `![[${this.imageHashes[hash]}]]`;

    const folder = this.settings.attachmentFolder.trim() || DEFAULT_SETTINGS.attachmentFolder;
    await ensureFolder(this.app.vault, folder);
    const extension = file.name.split(".").pop() || file.type.split("/").pop() || "png";
    const basename = sanitizeFileName(`${sourceFile.basename}-${Date.now()}.${extension}`);
    const path = `${folder}/${basename}`;
    await this.app.vault.createBinary(path, arrayBuffer);
    this.imageHashes[hash] = path;
    await this.savePluginData();
    return `![[${path}]]`;
  }
}
