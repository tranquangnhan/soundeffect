
import { SoundEffect } from '../types';

// Browser Native File System Access API types
interface FileSystemDirectoryHandle {
  kind: 'directory';
  name: string;
  values(): AsyncIterableIterator<FileSystemHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
  removeEntry(name: string): Promise<void>;
  requestPermission(descriptor: { mode: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
  queryPermission(descriptor: { mode: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
}

interface FileSystemFileHandle {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritableFileStream>;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: any): Promise<void>;
  close(): Promise<void>;
}

interface FileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
}

const METADATA_FILE = 'sonicflow_data.json';
const DB_NAME = 'SonicFlowDB';
const STORE_NAME = 'handles';
const LOCAL_STORAGE_BACKUP_KEY = 'sonicflow_metadata_backup';

let rootHandle: FileSystemDirectoryHandle | null = null;
let fallbackFiles: Map<string, File> = new Map();
let isFallbackMode = false;

// --- IndexedDB Helpers ---
const getDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
};

const saveHandleToDB = async (handle: FileSystemDirectoryHandle) => {
  const db = await getDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(handle, 'rootDirectory');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const getHandleFromDB = async (): Promise<FileSystemDirectoryHandle | undefined> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get('rootDirectory');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const clearHandleFromDB = async () => {
  const db = await getDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete('rootDirectory');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

// --- Session Management ---

export const checkSavedSession = async (): Promise<string | null> => {
  try {
    const handle = await getHandleFromDB();
    return handle ? handle.name : null;
  } catch (e) {
    console.error("Error checking saved session", e);
    return null;
  }
};

export const restoreSession = async (): Promise<FileSystemDirectoryHandle> => {
  const handle = await getHandleFromDB();
  if (!handle) throw new Error("NO_SAVED_SESSION");

  // Check permission
  const permission = await handle.queryPermission({ mode: 'readwrite' });
  
  if (permission !== 'granted') {
    // Request permission (requires user gesture in UI)
    const newPermission = await handle.requestPermission({ mode: 'readwrite' });
    if (newPermission !== 'granted') {
      throw new Error("PERMISSION_DENIED");
    }
  }

  rootHandle = handle;
  isFallbackMode = false;
  return handle;
};

export const disconnectSession = async () => {
  rootHandle = null;
  await clearHandleFromDB();
};

// --- Native API ---
export const openDirectory = async (): Promise<FileSystemDirectoryHandle> => {
  // @ts-ignore
  if (!window.showDirectoryPicker) {
    throw new Error("API_NOT_SUPPORTED");
  }
  // @ts-ignore
  rootHandle = await window.showDirectoryPicker({
    mode: 'readwrite'
  });
  
  isFallbackMode = false;
  
  // Persist handle
  if (rootHandle) {
    await saveHandleToDB(rootHandle);
  }

  return rootHandle!;
};

// --- Fallback API (Input Element) ---
export const handleFallbackSelection = async (fileList: FileList): Promise<string> => {
  isFallbackMode = true;
  rootHandle = null;
  fallbackFiles.clear();

  let folderName = "Local Folder";
  if (fileList.length > 0) {
    const firstPath = fileList[0].webkitRelativePath;
    if (firstPath) {
      folderName = firstPath.split('/')[0];
    }
  }

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    fallbackFiles.set(file.webkitRelativePath || file.name, file);
  }
  return folderName;
};

export const getRootHandle = () => rootHandle;
export const isReadonlyMode = () => isFallbackMode;

/**
 * Creates a new directory in the root (Physical folder).
 */
export const createDirectory = async (name: string): Promise<boolean> => {
  if (isFallbackMode || !rootHandle) throw new Error("READ_ONLY_MODE");
  try {
    await rootHandle.getDirectoryHandle(name, { create: true });
    return true;
  } catch (e) {
    console.error("Create dir failed", e);
    return false;
  }
};

/**
 * Scans the directory for audio files and reconciles with metadata json.
 * Now returns customCategories as well.
 */
export const scanLibrary = async (): Promise<{ sounds: SoundEffect[], folders: string[], customCategories: string[] }> => {
  const audioFiles = new Map<string, File>();
  const folders = new Set<string>();
  
  // Initialize metadata with potential backup from LocalStorage
  let metadata: { sounds: SoundEffect[], customCategories?: string[] } = { sounds: [], customCategories: [] };
  
  try {
    const backup = localStorage.getItem(LOCAL_STORAGE_BACKUP_KEY);
    if (backup) {
      metadata = JSON.parse(backup);
    }
  } catch (e) {
    console.warn("Failed to load backup metadata");
  }

  // --- STRATEGY 1: NATIVE HANDLE ---
  if (rootHandle) {
    // 1. Read Metadata from Disk (Truth Source)
    try {
      const metaHandle = await rootHandle.getFileHandle(METADATA_FILE);
      const file = await metaHandle.getFile();
      const text = await file.text();
      // If we successfully read the file, it overwrites the backup
      metadata = JSON.parse(text);
    } catch (e) { 
        // File doesn't exist on disk yet, use backup or default
    }

    // 2. Scan Root & Subfolders (1 level deep)
    // @ts-ignore
    for await (const entry of rootHandle.values()) {
      if (entry.kind === 'file') {
        const name = entry.name.toLowerCase();
        if (isAudioFile(name)) {
           const fileHandle = entry as FileSystemFileHandle;
           audioFiles.set(entry.name, await fileHandle.getFile());
        }
      } else if (entry.kind === 'directory') {
        folders.add(entry.name);
        // Scan subfolder
        const dirHandle = entry as FileSystemDirectoryHandle;
        // @ts-ignore
        for await (const subEntry of dirHandle.values()) {
            if (subEntry.kind === 'file' && isAudioFile(subEntry.name)) {
                const subFileHandle = subEntry as FileSystemFileHandle;
                audioFiles.set(`${entry.name}/${subEntry.name}`, await subFileHandle.getFile());
            }
        }
      }
    }
  } 
  // --- STRATEGY 2: FALLBACK FILES ---
  else if (isFallbackMode) {
    // 1. Metadata from file (Only if LocalStorage is empty or we want to trust the file)
    // If we have metadata from LocalStorage, we prefer it over the stale file on disk (which we couldn't write to previously)
    if (metadata.sounds.length === 0) {
        for (const [path, file] of fallbackFiles.entries()) {
            if (path.endsWith(METADATA_FILE)) {
                try { metadata = JSON.parse(await file.text()); } catch(e) {}
            }
        }
    }

    // 2. Files
    for (const [path, file] of fallbackFiles.entries()) {
      if (isAudioFile(path)) {
        audioFiles.set(path, file); // path includes folder structure
      }
    }
  } else {
    throw new Error("No folder selected");
  }

  // 3. Reconcile
  const finalLibrary: SoundEffect[] = [];
  const existingMap = new Map(metadata.sounds.map(s => [s.filename, s]));

  for (const [filename, file] of audioFiles.entries()) {
    let sound = existingMap.get(filename);
    const url = URL.createObjectURL(file);
    
    if (sound) {
      sound.url = url;
    } else {
      sound = {
        id: Math.random().toString(36).substr(2, 9),
        name: filename.split('/').pop()?.replace(/\.[^/.]+$/, "") || "Untitled",
        filename: filename,
        category: 'Chưa phân loại',
        tags: ['newly-detected'],
        url: url,
        duration: 0,
        source: 'UPLOAD' as any,
        isFavorite: false,
        createdAt: Date.now()
      };
    }
    finalLibrary.push(sound);
  }

  // Always sync back to persistence layers immediately after scan
  await saveMetadata(finalLibrary, metadata.customCategories || []);

  return { 
    sounds: finalLibrary, 
    folders: Array.from(folders), 
    customCategories: metadata.customCategories || [] 
  };
};

export const saveMetadata = async (library: SoundEffect[], customCategories: string[]) => {
  const storageData = {
    sounds: library.map(({ url, ...rest }) => rest),
    customCategories: customCategories
  };

  // 1. Always save to LocalStorage (Backup)
  // This ensures data persistence even if file writing fails (ReadOnly/Fallback mode)
  try {
    localStorage.setItem(LOCAL_STORAGE_BACKUP_KEY, JSON.stringify(storageData));
  } catch (e) {
    console.warn("LocalStorage quota exceeded or unavailable");
  }

  // 2. Save to Disk (Primary)
  if (isFallbackMode || !rootHandle) return;
  
  try {
    const handle = await rootHandle.getFileHandle(METADATA_FILE, { create: true });
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(storageData, null, 2));
    await writable.close();
  } catch (e) {
    console.error("Failed to write metadata to disk", e);
  }
};

export const saveSoundToFolder = async (sound: SoundEffect, blob: Blob): Promise<SoundEffect> => {
  if (isFallbackMode || !rootHandle) throw new Error("READ_ONLY_MODE");

  // Check if sound implies a folder in filename
  let filename = sound.filename || `${sound.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp3`;
  
  // Clean extension to ensure it is supported
  if (!filename.match(/\.(mp3|wav|ogg|m4a|aac|wma|flac)$/i)) {
      if (blob.type.includes('wav')) filename += '.wav';
      else filename += '.mp3';
  }

  const parts = filename.split('/');
  const fileNameOnly = parts.pop()!;
  const folderName = parts.length > 0 ? parts.join('/') : null;

  let dirHandle = rootHandle;
  if (folderName) {
      dirHandle = await rootHandle.getDirectoryHandle(folderName, { create: true });
  }

  const fileHandle = await dirHandle.getFileHandle(fileNameOnly, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();

  return { ...sound, filename };
};

const isAudioFile = (name: string) => {
    const n = name.toLowerCase();
    return n.endsWith('.mp3') || 
           n.endsWith('.wav') || 
           n.endsWith('.ogg') || 
           n.endsWith('.m4a') || 
           n.endsWith('.aac') || 
           n.endsWith('.wma') ||
           n.endsWith('.flac');
};
