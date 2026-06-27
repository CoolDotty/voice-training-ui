import type { Insight, Recording, RecordingDetail } from "../types";

const DB_NAME = "voice-garden-browser";
const DB_VERSION = 1;

const STORES = {
  recordings: "recordings",
  details: "details",
  audioBlobs: "audioBlobs",
  insights: "insights",
  settings: "settings",
} as const;

interface SavedBundle {
  recording: Recording;
  detail: RecordingDetail;
  audioBlob: Blob;
  insight: Insight;
}

let dbPromise: Promise<IDBDatabase> | null = null;

export function getVoiceGardenDb(): Promise<IDBDatabase> {
  if (!dbPromise) dbPromise = openDb();
  return dbPromise;
}

export async function getLocalRecordings(): Promise<Recording[]> {
  const db = await getVoiceGardenDb();
  const recordings = await getAll<Recording>(db, STORES.recordings);
  return recordings.map((recording) => ({ ...recording, isLocal: recording.isLocal ?? false }));
}

export async function getRecordingDetail(detailId: string): Promise<RecordingDetail | null> {
  const db = await getVoiceGardenDb();
  return (await getValue<RecordingDetail>(db, STORES.details, detailId)) ?? null;
}

export async function getAudioBlob(audioBlobId: string): Promise<Blob | null> {
  const db = await getVoiceGardenDb();
  return (await getValue<Blob>(db, STORES.audioBlobs, audioBlobId)) ?? null;
}

export async function getInsight(recordingId: number): Promise<Insight | null> {
  const db = await getVoiceGardenDb();
  return (await getValue<Insight>(db, STORES.insights, recordingId)) ?? null;
}

export async function saveRecordingBundle(bundle: SavedBundle): Promise<void> {
  const db = await getVoiceGardenDb();
  const tx = db.transaction(
    [STORES.recordings, STORES.details, STORES.audioBlobs, STORES.insights],
    "readwrite",
  );
  tx.objectStore(STORES.recordings).put({ ...bundle.recording });
  tx.objectStore(STORES.details).put(bundle.detail, bundle.recording.detailId);
  tx.objectStore(STORES.audioBlobs).put(bundle.audioBlob, bundle.recording.audioBlobId);
  tx.objectStore(STORES.insights).put(bundle.insight);
  await transactionDone(tx);
}

export async function deleteLocalRecording(recording: Recording): Promise<void> {
  const db = await getVoiceGardenDb();
  const tx = db.transaction(
    [STORES.recordings, STORES.details, STORES.audioBlobs, STORES.insights],
    "readwrite",
  );
  tx.objectStore(STORES.recordings).delete(recording.id);
  if (recording.detailId) tx.objectStore(STORES.details).delete(recording.detailId);
  if (recording.audioBlobId) tx.objectStore(STORES.audioBlobs).delete(recording.audioBlobId);
  tx.objectStore(STORES.insights).delete(recording.id);
  await transactionDone(tx);
}

export async function updateLocalRecordingMetadata(
  recordingId: number,
  metadata: Pick<Recording, "label" | "note">,
): Promise<Recording | null> {
  const db = await getVoiceGardenDb();
  const tx = db.transaction(STORES.recordings, "readwrite");
  const store = tx.objectStore(STORES.recordings);
  const recording = await requestToPromise<Recording | undefined>(store.get(recordingId));
  if (!recording) {
    return null;
  }

  const updated: Recording = {
    ...recording,
    label: metadata.label,
    note: metadata.note,
  };
  store.put(updated);
  await transactionDone(tx);
  return updated;
}

export async function getSetting<T>(key: string): Promise<T | null> {
  const db = await getVoiceGardenDb();
  return (await getValue<T>(db, STORES.settings, key)) ?? null;
}

export async function saveSetting<T>(key: string, value: T): Promise<void> {
  const db = await getVoiceGardenDb();
  const tx = db.transaction(STORES.settings, "readwrite");
  tx.objectStore(STORES.settings).put(value, key);
  await transactionDone(tx);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.recordings)) {
        db.createObjectStore(STORES.recordings, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.details)) db.createObjectStore(STORES.details);
      if (!db.objectStoreNames.contains(STORES.audioBlobs)) db.createObjectStore(STORES.audioBlobs);
      if (!db.objectStoreNames.contains(STORES.insights)) {
        db.createObjectStore(STORES.insights, { keyPath: "recordingId" });
      }
      if (!db.objectStoreNames.contains(STORES.settings)) db.createObjectStore(STORES.settings);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
  });
}

function getAll<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return requestToPromise<T[]>(db.transaction(storeName, "readonly").objectStore(storeName).getAll());
}

function getValue<T>(db: IDBDatabase, storeName: string, key: IDBValidKey): Promise<T | undefined> {
  return requestToPromise<T | undefined>(
    db.transaction(storeName, "readonly").objectStore(storeName).get(key),
  );
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}
