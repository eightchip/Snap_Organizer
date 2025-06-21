import { openDB, IDBPDatabase } from 'idb';
import { PhotoMetadata } from '../types';

const DB_NAME = 'postal_snap_db';
const DB_VERSION = 2;
const STORE_NAME = 'images';
const META_STORE = 'metadata';

export let db: IDBPDatabase | null = null;

const initDB = async () => {
  if (db) return db;
  
  db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion) {
      console.log(`Upgrading DB from version ${oldVersion} to ${newVersion}`);
      // The initial version (1) setup
      if (oldVersion < 1) {
        // 画像バイナリ用のストア
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
        // メタデータ用のストア
        if (!db.objectStoreNames.contains(META_STORE)) {
          const metaStore = db.createObjectStore(META_STORE, { keyPath: 'filename' });
          metaStore.createIndex('dateTaken', 'date_taken');
          metaStore.createIndex('location', ['location.lat', 'location.lon']);
          metaStore.createIndex('tags', 'tags', { multiEntry: true });
        }
      }
      // Example for future upgrade
      // if (oldVersion < 2) {
      //   const store = transaction.objectStore(META_STORE);
      //   store.createIndex('new_index', 'new_field');
      // }
    },
  });
  
  return db;
};

export const saveImageBlob = async (id: string, blob: Blob): Promise<void> => {
  const database = await initDB();
  await database.put(STORE_NAME, blob, id);
};

export const loadImageBlob = async (id: string): Promise<Blob | null> => {
  const database = await initDB();
  return database.get(STORE_NAME, id);
};

export const saveMetadata = async (metadata: PhotoMetadata): Promise<void> => {
  const database = await initDB();
  await database.put(META_STORE, metadata);
};

export const loadMetadata = async (filename: string): Promise<PhotoMetadata | null> => {
  const database = await initDB();
  return database.get(META_STORE, filename);
};

export const searchByLocation = async (lat: number, lon: number, radius: number = 0.01): Promise<PhotoMetadata[]> => {
  const database = await initDB();
  const tx = database.transaction(META_STORE, 'readonly');
  const store = tx.objectStore(META_STORE);
  const items = await store.getAll();
  
  return items.filter(item => {
    if (!item.location) return false;
    const distance = Math.sqrt(
      Math.pow(item.location.lat - lat, 2) + 
      Math.pow(item.location.lon - lon, 2)
    );
    return distance <= radius;
  });
};

export const searchByDateRange = async (start: Date, end: Date): Promise<PhotoMetadata[]> => {
  const database = await initDB();
  const tx = database.transaction(META_STORE, 'readonly');
  const store = tx.objectStore(META_STORE);
  const index = store.index('dateTaken');
  
  return index.getAll(IDBKeyRange.bound(
    start.toISOString().split('T')[0],
    end.toISOString().split('T')[0]
  ));
};

export const searchByTags = async (tags: string[]): Promise<PhotoMetadata[]> => {
  const database = await initDB();
  const tx = database.transaction(META_STORE, 'readonly');
  const store = tx.objectStore(META_STORE);
  const items = await store.getAll();
  
  return items.filter(item => 
    tags.every(tag => item.tags.includes(tag))
  );
};

export const deleteImageBlob = async (id: string): Promise<void> => {
  const database = await initDB();
  await database.delete(STORE_NAME, id);
}; 