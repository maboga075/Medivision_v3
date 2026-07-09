
import type { TrainingCase } from "./types";

/**
 * Stockage local du jeu d'entraînement (IndexedDB) — 100 % sur la machine,
 * aucune donnée patient ne sort. Sans dépendance (wrapper IndexedDB minimal).
 */
const DB_NAME = "retinasketch-ai";
const DB_VERSION = 1;
const STORE = "cases";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: "id" });
        os.createIndex("createdAt", "createdAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

export async function recordCase(c: TrainingCase): Promise<void> {
  await tx("readwrite", (s) => s.put(c));
}

export async function countCases(): Promise<number> {
  return tx<number>("readonly", (s) => s.count());
}

export async function listCases(): Promise<TrainingCase[]> {
  const all = await tx<TrainingCase[]>("readonly", (s) => s.getAll());
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteCase(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id));
}

export async function clearAllCases(): Promise<void> {
  await tx("readwrite", (s) => s.clear());
}

/**
 * Exporte le jeu de données en JSON (images en base64). Pour l'entraînement
 * hors-ligne (PyTorch/MLX) ou la sauvegarde. Les blobs sont sérialisés.
 */
export async function exportDatasetJSON(): Promise<Blob> {
  const cases = await listCases();
  const serialised = await Promise.all(
    cases.map(async (c) => ({
      ...c,
      imageBlob: undefined,
      imageBase64: c.imageBlob ? await blobToBase64(c.imageBlob) : null,
    })),
  );
  return new Blob([JSON.stringify({ version: 1, cases: serialised }, null, 2)], {
    type: "application/json",
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
