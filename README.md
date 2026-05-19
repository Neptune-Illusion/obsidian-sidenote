# Obsidian Side Comments

A plugin for [Obsidian](https://obsidian.md) that allows you to add side comments/annotations to any selected text in your notes.

## Features

- **Select & Comment**: Select any text in a note and add a comment to it
- **Inline Highlights**: Commented text is highlighted in the editor
- **Selection Toolbar**: Quick-action toolbar appears when text is selected, with support for highlight, underline, strikethrough, and bold mark types
- **Sidebar View**: Dedicated sidebar to browse, search, and manage all comments in the current file
- **Hover Preview**: Hover over highlighted text to preview the comment
- **Multiple Mark Types**: Highlight, Underline, Strikethrough, and Bold mark styles
- **Custom Colors**: Set per-comment highlight colors
- **Image Support**: Paste images directly into comments (auto-stored in vault)
- **Export**: Export comments to Markdown files for review and archiving
- **Markdown Backup**: Migrate inline comments to standalone Markdown files

## Usage

### Adding a Comment
1. Select text in a Markdown file
2. Click the comment button in the floating toolbar (or use the command palette)
3. Enter your comment in the popup
4. Press `Ctrl+Enter` (or `Cmd+Enter`) to save

### Sidebar View
Run **"Open SideNote View"** from the command palette. The sidebar displays all comments for the current file as cards. Click a card to jump to the commented text.

### Context Menu
Right-click selected text to add comments with different mark types.

## Installation

### From Obsidian Community Plugins
*Not yet available in community store.*

### Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css`
2. Copy them to your vault's `.obsidian/plugins/obsidian-sidenote/` folder
3. Enable the plugin in Obsidian settings

## Settings

| Setting | Description |
|---------|-------------|
| Comment sort order | Sort by timestamp or by position in file |
| Show highlights | Toggle editor highlights |
| Selection toolbar | Enable/disable the floating toolbar |
| Highlight color | Default highlight color |
| Highlight opacity | Highlight background opacity |
| Comments folder | Folder for Markdown backup files |
| Attachments folder | Folder for pasted images |

## Credits

Originally developed by [peyote](https://github.com/peyote).
