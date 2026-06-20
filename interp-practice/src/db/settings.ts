import { getDB } from "./schema";
import type { UserSettings } from "../types";
import { DEFAULT_SETTINGS } from "../types";

export async function getSetting<K extends keyof UserSettings>(key: K): Promise<UserSettings[K]> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM user_settings WHERE key = ?",
    [key]
  );
  if (!row) return DEFAULT_SETTINGS[key];
  return JSON.parse(row.value);
}

export async function setSetting<K extends keyof UserSettings>(
  key: K,
  value: UserSettings[K]
): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    "INSERT OR REPLACE INTO user_settings (key, value) VALUES (?, ?)",
    [key, JSON.stringify(value)]
  );
}

export async function getStringSetting(key: string): Promise<string | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM user_settings WHERE key = ?",
    [key]
  );
  return row ? row.value : null;
}

export async function setStringSetting(key: string, value: string): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    "INSERT OR REPLACE INTO user_settings (key, value) VALUES (?, ?)",
    [key, value]
  );
}

export async function getAllSettings(): Promise<UserSettings> {
  const db = await getDB();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    "SELECT key, value FROM user_settings"
  );
  const settings = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (row.key in settings) {
      (settings as any)[row.key] = JSON.parse(row.value);
    }
  }
  return settings;
}
