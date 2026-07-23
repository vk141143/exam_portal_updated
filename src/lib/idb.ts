// ─── IndexedDB layer ──────────────────────────────────────────────────────────
// Stores: session | questions | answers | pendingSync
// Every public function falls back gracefully — the exam never breaks.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Question } from "./supabase-types";

const DB_NAME = "exam_portal_db";
const DB_VERSION = 1;

let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("session"))
        db.createObjectStore("session", { keyPath: "key" });
      if (!db.objectStoreNames.contains("questions"))
        db.createObjectStore("questions", { keyPath: "examId" });
      if (!db.objectStoreNames.contains("answers"))
        db.createObjectStore("answers", { keyPath: "examId" });
      if (!db.objectStoreNames.contains("pendingSync"))
        db.createObjectStore("pendingSync", { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function idbGet<T>(store: string, key: IDBValidKey): Promise<T | null> {
  return openDB().then(
    (db) =>
      new Promise((res, rej) => {
        const req = db.transaction(store).objectStore(store).get(key);
        req.onsuccess = () => res((req.result as T) ?? null);
        req.onerror = () => rej(req.error);
      }),
  );
}

function idbPut(store: string, value: object): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise((res, rej) => {
        const req = db.transaction(store, "readwrite").objectStore(store).put(value);
        req.onsuccess = () => res();
        req.onerror = () => rej(req.error);
      }),
  );
}

function idbDelete(store: string, key: IDBValidKey): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise((res, rej) => {
        const req = db.transaction(store, "readwrite").objectStore(store).delete(key);
        req.onsuccess = () => res();
        req.onerror = () => rej(req.error);
      }),
  );
}

function idbGetAll<T>(store: string): Promise<T[]> {
  return openDB().then(
    (db) =>
      new Promise((res, rej) => {
        const req = db.transaction(store).objectStore(store).getAll();
        req.onsuccess = () => res((req.result as T[]) ?? []);
        req.onerror = () => rej(req.error);
      }),
  );
}

function idbAdd(store: string, value: object): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise((res, rej) => {
        const req = db.transaction(store, "readwrite").objectStore(store).add(value);
        req.onsuccess = () => res();
        req.onerror = () => rej(req.error);
      }),
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CandidateSession {
  id: string;
  name: string;
  examId: string;
  examName: string;
}

export interface CachedQuestions {
  examId: string;
  questions: Question[];
  durationMinutes: number;
  cachedAt: number;
}

export interface SavedAnswers {
  examId: string;
  answers: Record<number, number>;
  flags: Record<number, string>;
  savedAt: number;
}

export type SyncRecord =
  | { type: "result"; payload: Record<string, unknown> }
  | { type: "audit"; payload: Record<string, unknown> }
  | { type: "exam_session"; payload: Record<string, unknown> }
  | { type: "feedback"; payload: Record<string, unknown> };

// ── Session ───────────────────────────────────────────────────────────────────

export async function saveSession(session: CandidateSession): Promise<void> {
  // Always write localStorage first so VideoSDK / other consumers never break
  localStorage.setItem("candidate_session", JSON.stringify(session));
  try {
    await idbPut("session", { key: "current", ...session });
  } catch { /* localStorage already saved — safe to continue */ }
}

export async function getSession(): Promise<CandidateSession | null> {
  try {
    const row = await idbGet<{ key: string } & CandidateSession>("session", "current");
    if (row) {
      const { key: _k, ...session } = row;
      return session as CandidateSession;
    }
  } catch { /* fall through */ }
  // Fallback: localStorage
  try {
    const raw = localStorage.getItem("candidate_session");
    return raw ? (JSON.parse(raw) as CandidateSession) : null;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  localStorage.removeItem("candidate_session");
  try { await idbDelete("session", "current"); } catch { /* ignore */ }
}

// ── Questions ─────────────────────────────────────────────────────────────────

export async function saveQuestions(data: CachedQuestions): Promise<void> {
  try { await idbPut("questions", data); } catch { /* ignore */ }
}

export async function getQuestions(examId: string): Promise<CachedQuestions | null> {
  try { return await idbGet<CachedQuestions>("questions", examId); } catch { return null; }
}

// ── Answers ───────────────────────────────────────────────────────────────────

export async function saveAnswers(data: SavedAnswers): Promise<void> {
  try { await idbPut("answers", data); } catch { /* ignore */ }
}

export async function getAnswers(examId: string): Promise<SavedAnswers | null> {
  try { return await idbGet<SavedAnswers>("answers", examId); } catch { return null; }
}

export async function clearAnswers(examId: string): Promise<void> {
  try { await idbDelete("answers", examId); } catch { /* ignore */ }
}

// ── Pending sync queue ────────────────────────────────────────────────────────

export async function enqueueSyncRecord(record: SyncRecord): Promise<void> {
  try { await idbAdd("pendingSync", record); } catch { /* ignore */ }
}

export async function flushPendingSync(supabase: SupabaseClient): Promise<void> {
  let pending: (SyncRecord & { id: number })[] = [];
  try {
    pending = await idbGetAll<SyncRecord & { id: number }>("pendingSync");
  } catch { return; }

  for (const record of pending) {
    try {
      if (record.type === "result")
        await supabase.from("results").insert(record.payload);
      else if (record.type === "audit")
        await supabase.from("audit_logs").insert(record.payload);
      else if (record.type === "exam_session")
        await supabase.from("exam_sessions").upsert(record.payload);
      else if (record.type === "feedback")
        await supabase.from("feedback").insert(record.payload);
      await idbDelete("pendingSync", record.id);
    } catch { /* leave in queue — retry on next login */ }
  }
}
