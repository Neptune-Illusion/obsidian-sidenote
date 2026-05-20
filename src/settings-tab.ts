import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type SideNotePlugin from "../main";

export class SideNoteSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: SideNotePlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Side Comments" });

    new Setting(containerEl)
      .setName("Comment sort order")
      .setDesc("Choose how comments are sorted in the sidebar.")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("position", "Position in file")
          .addOption("timestamp", "Created time")
          .setValue(this.plugin.settings.commentSortOrder)
          .onChange(async (value: "position" | "timestamp") => {
            this.plugin.settings.commentSortOrder = value;
            await this.plugin.savePluginData();
            this.plugin.refreshViews();
          });
      });

    new Setting(containerEl)
      .setName("Show highlights")
      .setDesc("Display highlights for commented text in editor and reading view.")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.showHighlights).onChange(async (value) => {
          this.plugin.settings.showHighlights = value;
          await this.plugin.savePluginData();
          this.plugin.refreshEditorDecorations();
        });
      });

    new Setting(containerEl)
      .setName("Selection toolbar")
      .setDesc("Show a floating toolbar when text is selected.")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.enableSelectionToolbar).onChange(async (value) => {
          this.plugin.settings.enableSelectionToolbar = value;
          await this.plugin.savePluginData();
        });
      });

    new Setting(containerEl)
      .setName("Highlight color")
      .addColorPicker((picker) => {
        picker.setValue(this.plugin.settings.highlightColor).onChange(async (value) => {
          this.plugin.settings.highlightColor = value;
          await this.plugin.savePluginData();
          this.plugin.updateDynamicStyles();
        });
      });

    new Setting(containerEl)
      .setName("Highlight opacity")
      .setDesc("Opacity used for editor highlight backgrounds.")
      .addSlider((slider) => {
        slider
          .setLimits(0.05, 0.8, 0.05)
          .setValue(this.plugin.settings.highlightOpacity)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.highlightOpacity = value;
            await this.plugin.savePluginData();
            this.plugin.updateDynamicStyles();
          });
      });

    new Setting(containerEl)
      .setName("Markdown comments folder")
      .addText((text) => {
        text
          .setPlaceholder("side-note-comments")
          .setValue(this.plugin.settings.markdownFolder)
          .onChange(async (value) => {
            this.plugin.settings.markdownFolder = value.trim() || "side-note-comments";
            await this.plugin.savePluginData();
          });
      });

    new Setting(containerEl)
      .setName("Attachments folder")
      .addText((text) => {
        text
          .setPlaceholder("side-note-attachments")
          .setValue(this.plugin.settings.attachmentFolder)
          .onChange(async (value) => {
            this.plugin.settings.attachmentFolder = value.trim() || "side-note-attachments";
            await this.plugin.savePluginData();
          });
      });

    const orphaned = this.plugin.commentManager.getOrphanedCount();
    new Setting(containerEl)
      .setName("Orphaned comments")
      .setDesc(`There are ${orphaned} orphaned comment(s).`)
      .addButton((button) => {
        button
          .setButtonText(`Delete ${orphaned}`)
          .setDisabled(orphaned === 0)
          .onClick(async () => {
            const deleted = this.plugin.commentManager.deleteOrphaned();
            this.plugin.comments = this.plugin.commentManager.getAll();
            await this.plugin.savePluginData();
            new Notice(`Deleted ${deleted} orphaned comment(s).`);
            this.display();
          });
      });
  }
}

