import { App, normalizePath, Notice, setIcon, TFile } from "obsidian";
import type SideNotePlugin from "../main";

export class CommentModal {
  private containerEl: HTMLElement | null = null;
  private textareaEl: HTMLTextAreaElement | null = null;
  private colorInput: HTMLInputElement | null = null;

  constructor(
    private readonly app: App,
    private readonly plugin: SideNotePlugin,
    private readonly onSubmit: (comment: string, color?: string) => Promise<void> | void,
    private readonly initialComment = "",
    private readonly filePath = "",
    private readonly initialColor = "",
  ) {}

  open(position?: DOMRect): void {
    this.containerEl?.remove();
    this.containerEl = document.body.createDiv("sidenote-floating-container");

    const header = this.containerEl.createDiv("sidenote-floating-header");
    header.createEl("span", {
      text: this.initialComment ? "Edit Comment" : "Add Comment",
      cls: "sidenote-floating-title",
    });

    const closeButton = header.createEl("button", {
      cls: "sidenote-floating-close clickable-icon",
    });
    setIcon(closeButton, "x");
    closeButton.onclick = () => this.close();
    this.enableDrag(header);

    const textarea = this.containerEl.createDiv("sidenote-floating-input-wrapper").createEl("textarea");
    textarea.placeholder = "Enter comment... (Paste images supported)";
    textarea.value = this.initialComment;
    textarea.classList.add("sidenote-textarea");
    textarea.addEventListener("paste", (event) => this.handlePaste(event));
    textarea.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        this.submitComment();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        this.close();
      }
    });
    this.textareaEl = textarea;

    const footer = this.containerEl.createDiv("sidenote-floating-footer");
    const colorPicker = footer.createDiv("sidenote-floating-color-picker");
    colorPicker.style.marginRight = "auto";
    colorPicker.style.display = "flex";
    colorPicker.style.alignItems = "center";
    colorPicker.style.gap = "8px";
    colorPicker.createEl("span", { text: "Color:", cls: "sidenote-color-label" });
    this.colorInput = colorPicker.createEl("input", {
      type: "color",
      cls: "sidenote-color-input",
    });
    this.colorInput.value = this.initialColor || this.plugin.settings.highlightColor || "#FFC800";

    const cancelButton = footer.createEl("button", {
      text: "Cancel",
      cls: "sidenote-floating-cancel-btn",
    });
    cancelButton.style.marginRight = "8px";
    cancelButton.onclick = () => this.close();

    const saveButton = footer.createEl("button", { text: "Save", cls: "mod-cta" });
    saveButton.onclick = () => this.submitComment();

    if (position) {
      this.setPosition(position);
    } else {
      this.containerEl.style.top = "40%";
      this.containerEl.style.left = "50%";
      this.containerEl.style.transform = "translate(-50%, -50%)";
    }

    window.setTimeout(() => textarea.focus(), 50);
  }

  close(): void {
    this.containerEl?.remove();
    this.containerEl = null;
  }

  private enableDrag(handle: HTMLElement): void {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    handle.onmousedown = (event) => {
      if (!this.containerEl) return;
      event.preventDefault();
      dragging = true;
      startX = event.clientX;
      startY = event.clientY;

      const rect = this.containerEl.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      if (this.containerEl.style.transform) {
        this.containerEl.style.transform = "none";
        this.containerEl.style.left = `${initialLeft}px`;
        this.containerEl.style.top = `${initialTop}px`;
      }

      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!dragging || !this.containerEl) return;
        this.containerEl.style.left = `${initialLeft + moveEvent.clientX - startX}px`;
        this.containerEl.style.top = `${initialTop + moveEvent.clientY - startY}px`;
      };

      const onMouseUp = () => {
        dragging = false;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    };
  }

  private setPosition(rect: DOMRect): void {
    if (!this.containerEl) return;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    let top = rect.bottom + 10;
    let left = rect.left;

    if (top + 250 > viewportHeight) top = rect.top - 260;
    if (left + 320 > viewportWidth) left = viewportWidth - 330;
    if (left < 10) left = 10;
    if (top < 10) top = 10;

    this.containerEl.style.top = `${top}px`;
    this.containerEl.style.left = `${left}px`;
    this.containerEl.style.transform = "none";
  }

  private async handlePaste(event: ClipboardEvent): Promise<void> {
    const files = event.clipboardData?.files;
    if (!files || files.length === 0) return;

    event.preventDefault();
    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      if (file.type.startsWith("image/")) {
        await this.saveImageAndInsertLink(file);
      }
    }
  }

  private async saveImageAndInsertLink(file: File): Promise<void> {
    if (!this.textareaEl) return;

    try {
      const buffer = await file.arrayBuffer();
      const hash = await this.hashBuffer(buffer);
      let imagePath = this.plugin.imageHashes[hash];

      if (imagePath && !(this.app.vault.getAbstractFileByPath(imagePath) instanceof TFile)) {
        imagePath = "";
      }

      if (imagePath) {
        new Notice("Reused existing image.");
      } else {
        imagePath = await this.createNewImage(buffer, file.name);
        this.plugin.imageHashes[hash] = imagePath;
        await this.plugin.savePluginData();
      }

      const imageFile = this.app.vault.getAbstractFileByPath(imagePath);
      if (!(imageFile instanceof TFile)) return;

      let markdownLink = this.app.fileManager.generateMarkdownLink(imageFile, this.filePath || "/");
      if (!markdownLink.startsWith("!")) markdownLink = `!${markdownLink}`;

      const start = this.textareaEl.selectionStart;
      const end = this.textareaEl.selectionEnd;
      const value = this.textareaEl.value;
      this.textareaEl.value = value.substring(0, start) + markdownLink + value.substring(end);
      const cursor = start + markdownLink.length;
      this.textareaEl.setSelectionRange(cursor, cursor);
      this.textareaEl.dispatchEvent(new Event("input"));
    } catch (error) {
      console.error(error);
      new Notice("Failed to save image.");
    }
  }

  private async createNewImage(buffer: ArrayBuffer, originalName: string): Promise<string> {
    const folder = normalizePath(this.plugin.settings.attachmentFolder.trim() || "side-note-attachments");
    if (!this.app.vault.getAbstractFileByPath(folder)) {
      await this.app.vault.createFolder(folder);
    }

    const timestamp = window.moment().format("YYYYMMDDHHmmss");
    const extension = originalName.split(".").pop() || "png";
    const filename = `Pasted image ${timestamp}.${extension}`;
    const path = `${folder}/${filename}`;

    const created = await this.app.vault.createBinary(path, buffer).catch(async () => {
      const availablePath = await this.app.fileManager.getAvailablePathForAttachment(filename, folder);
      return this.app.vault.createBinary(availablePath, buffer);
    });

    return created.path;
  }

  private async hashBuffer(buffer: ArrayBuffer): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  private async submitComment(): Promise<void> {
    if (!this.textareaEl) return;
    try {
      await this.onSubmit(this.textareaEl.value, this.colorInput?.value);
    } catch (error) {
      console.error(error);
    }
    this.close();
  }
}

