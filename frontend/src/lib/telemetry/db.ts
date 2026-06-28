// frontend/src/lib/telemetry/db.ts
import type { TelemetryEvent } from "./types";

const DB_NAME = "vibe_telemetry";
const DB_VERSION = 1;

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("events")) {
        const store = db.createObjectStore("events", { keyPath: "id", autoIncrement: true });
        store.createIndex("date", "date", { unique: false });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface StoredEvent extends TelemetryEvent { date: string; id?: number; }

export async function putEvent(e: Omit<StoredEvent, "id">): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("events", "readwrite");
    tx.objectStore("events").add(e);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getBucketsBefore(date: string): Promise<Record<string, TelemetryEvent[]>> {
  const db = await openDB();
  const out: Record<string, TelemetryEvent[]> = {};
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("events", "readonly");
    const idx = tx.objectStore("events").index("date");
    const range = IDBKeyRange.upperBound(date, true); // date < date (exclusive)
    const cur = idx.openCursor(range);
    cur.onsuccess = () => {
      const c = cur.result;
      if (!c) return resolve();
      const v = c.value as StoredEvent;
      (out[v.date] ??= []).push({ ts: v.ts, type: v.type, name: v.name, props: v.props } as TelemetryEvent);
      c.continue();
    };
    cur.onerror = () => reject(cur.error);
  });
  db.close();
  return out;
}

export async function deleteBucket(date: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("events", "readwrite");
    const idx = tx.objectStore("events").index("date");
    const cur = idx.openCursor(IDBKeyRange.only(date));
    cur.onsuccess = () => { const c = cur.result; if (!c) return; c.delete(); c.continue(); };
    cur.onerror = () => reject(cur.error);
    tx.oncomplete = () => resolve();
  });
  db.close();
}

/** ponytail: todayFn 注入便于测试；默认本地时区 YYYY-MM-DD。 */
export async function purgeOld(days: number, todayFn: () => string = localToday): Promise<number> {
  const cutoff = shiftDays(todayFn(), -days);
  const db = await openDB();
  let deleted = 0;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("events", "readwrite");
    const idx = tx.objectStore("events").index("date");
    const cur = idx.openCursor(IDBKeyRange.upperBound(cutoff, true));
    cur.onsuccess = () => { const c = cur.result; if (!c) return; deleted++; c.delete(); c.continue(); };
    cur.onerror = () => reject(cur.error);
    tx.oncomplete = () => resolve();
  });
  db.close();
  return deleted;
}

export async function metaGet<T>(key: string): Promise<T | undefined> {
  const db = await openDB();
  const v = await new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction("meta", "readonly");
    const r = tx.objectStore("meta").get(key);
    r.onsuccess = () => resolve(r.result?.value as T | undefined);
    r.onerror = () => reject(r.error);
  });
  db.close();
  return v;
}

export async function metaSet<T>(key: string, value: T): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("meta", "readwrite");
    tx.objectStore("meta").put({ key, value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export function localToday(): string {
  return new Date().toLocaleDateString("en-CA");
}

function shiftDays(yyyymmdd: string, delta: number): string {
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return dt.toLocaleDateString("en-CA");
}
