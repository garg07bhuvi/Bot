import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { MongoClient, type Db } from "mongodb";
import type { Business, SettingsForm } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const BUSINESSES_FILE = path.join(DATA_DIR, "businesses.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, "utf-8"));
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, data: unknown): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2));
}

export function businessesFilePath(): string {
  return BUSINESSES_FILE;
}

async function fileGetBusinesses(): Promise<Business[]> {
  return readJson<Business[]>(BUSINESSES_FILE, []);
}

async function fileSaveBusiness(business: Business): Promise<void> {
  const businesses = await fileGetBusinesses();
  if (businesses.some((b) => b.place_id === business.place_id)) return;
  await writeJson(BUSINESSES_FILE, [business, ...businesses]);
}

// Cached across requests (and hot reloads) so we don't open a new connection per call.
let cachedClient: MongoClient | null = null;
let cachedUri: string | null = null;

async function getDb(uri: string): Promise<Db> {
  if (cachedClient && cachedUri === uri) return cachedClient.db();
  if (cachedClient) await cachedClient.close();
  cachedClient = new MongoClient(uri);
  await cachedClient.connect();
  cachedUri = uri;
  return cachedClient.db();
}

export async function getDatabaseStatus(): Promise<{
  connected_to_mongodb: boolean;
  storage_type: "mongodb" | "file";
  file_path: string | null;
}> {
  const settings = await getSettings();
  if (settings.mongodb_uri) {
    try {
      const db = await getDb(settings.mongodb_uri);
      await db.command({ ping: 1 });
      return { connected_to_mongodb: true, storage_type: "mongodb", file_path: null };
    } catch (err) {
      console.error("MongoDB unreachable, using file storage:", err);
    }
  }
  return { connected_to_mongodb: false, storage_type: "file", file_path: BUSINESSES_FILE };
}

export async function getBusinesses(): Promise<Business[]> {
  const settings = await getSettings();
  if (settings.mongodb_uri) {
    try {
      const db = await getDb(settings.mongodb_uri);
      const docs = await db
        .collection<Business>("businesses")
        .find()
        .project({ _id: 0 })
        .sort({ queried_at: -1 })
        .toArray();
      return docs as unknown as Business[];
    } catch (err) {
      console.error("MongoDB unreachable, using file storage:", err);
    }
  }
  return fileGetBusinesses();
}

/** Upserts by place_id — no-op if that business is already saved. */
export async function saveBusiness(business: Business): Promise<void> {
  const settings = await getSettings();
  if (settings.mongodb_uri) {
    try {
      const db = await getDb(settings.mongodb_uri);
      await db
        .collection("businesses")
        .updateOne({ place_id: business.place_id }, { $setOnInsert: business }, { upsert: true });
      return;
    } catch (err) {
      console.error("MongoDB unreachable, using file storage:", err);
    }
  }
  await fileSaveBusiness(business);
}

const DEFAULT_SETTINGS: SettingsForm = {
  openrouter_api_key: "",
  mongodb_uri: "",
  search_provider: "google",
  google_places_api_key: "",
  serper_api_key: "",
};

export async function getSettings(): Promise<SettingsForm> {
  const stored = await readJson<SettingsForm>(SETTINGS_FILE, DEFAULT_SETTINGS);
  // .env.local seeds these until the user saves overrides via Settings.
  return {
    ...stored,
    openrouter_api_key: stored.openrouter_api_key || process.env.OPENROUTER_API_KEY || "",
    mongodb_uri: stored.mongodb_uri || process.env.MONGODB_URI || "",
    google_places_api_key: stored.google_places_api_key || process.env.GOOGLE_PLACES_API_KEY || "",
  };
}

/** Merges only non-blank fields, so blanks keep the current stored value. */
export async function saveSettings(patch: Partial<SettingsForm>): Promise<SettingsForm> {
  const current = await getSettings();
  const next = { ...current };
  for (const [key, value] of Object.entries(patch) as [keyof SettingsForm, string][]) {
    if (value !== "") next[key] = value;
  }
  await writeJson(SETTINGS_FILE, next);
  return next;
}
