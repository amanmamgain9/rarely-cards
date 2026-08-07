const DATABASE_NAME = "rarely-pending";
const STORE_NAME = "photos";
const RECORD_KEY = "current";
const DATABASE_VERSION = 1;
const MAX_PENDING_BYTES = 10 * 1024 * 1024;

export type CardStyle = "pet";

type PendingPhotoRecord = {
  key: typeof RECORD_KEY;
  blob: Blob;
  name: string;
  type: string;
  lastModified: number;
  cardStyle: CardStyle;
  savedAt: number;
};

export type PendingPhoto = {
  file: File;
  cardStyle: CardStyle;
  savedAt: number;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function completeTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function savePendingPhoto(
  file: File,
  cardStyle: CardStyle,
): Promise<void> {
  if (file.size > MAX_PENDING_BYTES) {
    throw new Error("Choose a photo smaller than 10 MB.");
  }

  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, "readwrite");
  transaction.objectStore(STORE_NAME).put({
    key: RECORD_KEY,
    blob: file,
    name: file.name,
    type: file.type,
    lastModified: file.lastModified,
    cardStyle,
    savedAt: Date.now(),
  } satisfies PendingPhotoRecord);
  await completeTransaction(transaction);
  database.close();
}

export async function loadPendingPhoto(): Promise<PendingPhoto | null> {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, "readonly");
  const request = transaction.objectStore(STORE_NAME).get(RECORD_KEY);
  const record = await new Promise<PendingPhotoRecord | undefined>(
    (resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    },
  );
  await completeTransaction(transaction);
  database.close();

  if (!record) return null;
  if (
    Date.now() - record.savedAt > 24 * 60 * 60 * 1000 ||
    record.cardStyle !== "pet"
  ) {
    await clearPendingPhoto();
    return null;
  }

  return {
    file: new File([record.blob], record.name, {
      type: record.type,
      lastModified: record.lastModified,
    }),
    cardStyle: record.cardStyle,
    savedAt: record.savedAt,
  };
}

export async function clearPendingPhoto(): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, "readwrite");
  transaction.objectStore(STORE_NAME).delete(RECORD_KEY);
  await completeTransaction(transaction);
  database.close();
}

