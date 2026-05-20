import { TFile, Vault } from "obsidian";

export async function hashText(text: string): Promise<string> {
  try {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    const cryptoModule = require("crypto");
    return cryptoModule.createHash("sha256").update(text).digest("hex");
  }
}

export function getPositionFromIndex(text: string, index: number) {
  const bounded = Math.max(0, Math.min(index, text.length));
  const lines = text.slice(0, bounded).split("\n");
  return { line: lines.length - 1, ch: lines[lines.length - 1].length };
}

export function getIndexFromPosition(text: string, line: number, ch: number): number {
  const lines = text.split("\n");
  let index = 0;
  for (let i = 0; i < Math.min(line, lines.length); i++) {
    index += lines[i].length + 1;
  }
  return Math.max(0, Math.min(index + ch, text.length));
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|#^[\]]/g, "-").replace(/\s+/g, " ").trim();
}

export async function ensureFolder(vault: Vault, folderPath: string): Promise<void> {
  const normalized = folderPath.replace(/^\/+|\/+$/g, "");
  if (!normalized || vault.getAbstractFileByPath(normalized)) return;

  const parts = normalized.split("/");
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (!vault.getAbstractFileByPath(current)) {
      await vault.createFolder(current);
    }
  }
}

export function getFileBasename(file: TFile | null | undefined): string {
  return file?.basename || "Untitled";
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
  const value = Number.parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

