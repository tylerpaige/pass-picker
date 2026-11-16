import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";

export async function listEntries(): Promise<string[]> {
  return invoke<string[]>("list_entries");
}

export async function getEntry(name: string): Promise<string> {
  return invoke<string>("get_entry", { name });
}

export async function getOtp(name: string): Promise<string> {
  return invoke<string>("get_otp", { name });
}

export async function insertEntry(
  name: string,
  content: string
): Promise<void> {
  return invoke("insert_entry", { name, content });
}

export async function editEntry(
  name: string,
  content: string
): Promise<void> {
  return invoke("edit_entry", { name, content });
}

export async function deleteEntry(name: string): Promise<void> {
  return invoke("delete_entry", { name });
}

export async function renameEntry(oldName: string, newName: string): Promise<void> {
  return invoke("rename_entry", { oldName, newName });
}

export async function generatePassword(
  name: string,
  length: number
): Promise<string> {
  return invoke<string>("generate_password", { name, length });
}

export async function gitPull(): Promise<void> {
  return invoke("git_pull");
}

export async function gitPush(): Promise<void> {
  return invoke("git_push");
}

export async function copyToClipboard(text: string): Promise<void> {
  await writeText(text);
}

export interface EntryField {
  key: string;
  value: string;
  hidden: boolean;
}

export interface ParsedEntry {
  password: string;
  fields: EntryField[];
  raw: string;
}

// A trailing "!" on a key (e.g. "pin!: 1234") marks the field as secret:
// it's masked like the password and the "!" is dropped from its label.
export function parseEntry(raw: string): ParsedEntry {
  const lines = raw.split("\n");
  const password = lines[0] || "";
  const fields: EntryField[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      let key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      const hidden = key.length > 1 && key.endsWith("!");
      if (hidden) key = key.slice(0, -1).trimEnd();
      fields.push({ key, value, hidden });
    }
  }

  return { password, fields, raw };
}
