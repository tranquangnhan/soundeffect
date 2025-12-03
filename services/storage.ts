
import { SoundEffect } from '../types';

const DB_NAME = 'SonicFlowDB';
const STORE_NAME = 'library';
const DB_VERSION = 1;

// Initialize the Database
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

// Save a sound file and its metadata
export const saveSoundToDB = async (sound: SoundEffect, blob: Blob): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // We remove the 'url' because we cannot store blob URLs persistently.
    // We store the raw 'blob' instead.
    const { url, ...metadata } = sound;
    
    const record = { ...metadata, blob }; 
    const request = store.put(record);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Load all sounds and regenerate valid Blob URLs for the current session
export const loadLibraryFromDB = async (): Promise<SoundEffect[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => {
      const results = request.result;
      const sounds = results.map((item: any) => {
        const { blob, ...metadata } = item;
        // Generate a fresh, valid URL for this session
        const url = URL.createObjectURL(blob);
        return { ...metadata, url };
      });
      resolve(sounds);
    };
    request.onerror = () => reject(request.error);
  });
};

// Update metadata (e.g., toggling favorites) without overwriting the blob
export const updateSoundInDB = async (sound: SoundEffect): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // First get the existing record to retrieve the blob
    const getRequest = store.get(sound.id);
    
    getRequest.onsuccess = () => {
      const data = getRequest.result;
      if (data) {
        const { url, ...metadata } = sound;
        // Keep the existing blob
        const updatedRecord = { ...metadata, blob: data.blob };
        const putRequest = store.put(updatedRecord);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        // Record missing? Just resolve.
        resolve();
      }
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
};

export const deleteSoundFromDB = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};