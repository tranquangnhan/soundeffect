
import { SoundEffect } from '../types';

// Browser Native File System Access API types
interface FileSystemDirectoryHandle {
  kind: 'directory';
  name: string;
  values(): AsyncIterableIterator<FileSystemHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
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
let rootHandle: FileSystemDirectoryHandle | null = null;
let memoryCache: Map<string, File> = new Map();

export const openDirectory = async (): Promise<FileSystemDirectoryHandle> => {
  // @ts-ignore
  rootHandle = await window.showDirectoryPicker({
    mode: 'readwrite'
  });
  return rootHandle!;
};

export const getRootHandle = () => rootHandle;

/**
 * Scans the directory for audio files and reconciles with metadata json.
 */
export const scanLibrary = async (): Promise<SoundEffect[]> => {
  if (!rootHandle) throw new Error("No folder selected");

  const audioFiles = new Map<string, FileSystemFileHandle>();
  let metadata: { sounds: SoundEffect[] } = { sounds: [] };

  // 1. Read Metadata File
  try {
    const metaHandle = await rootHandle.getFileHandle(METADATA_FILE);
    const file = await metaHandle.getFile();
    const text = await file.text();
    metadata = JSON.parse(text);
  } catch (e) {
    // File doesn't exist yet, that's fine
  }

  // 2. Scan Directory for Audio
  // @ts-ignore
  for await (const entry of rootHandle.values()) {
    if (entry.kind === 'file') {
      const name = entry.name.toLowerCase();
      if (name.endsWith('.mp3') || name.endsWith('.wav') || name.endsWith('.ogg') || name.endsWith('.m4a')) {
        audioFiles.set(entry.name, entry as FileSystemFileHandle);
      }
    }
  }

  // 3. Reconcile
  const finalLibrary: SoundEffect[] = [];
  const existingMap = new Map(metadata.sounds.map(s => [s.filename, s]));

  for (const [filename, handle] of audioFiles.entries()) {
    let sound = existingMap.get(filename);
    
    // Get file blob for playback
    const file = await handle.getFile();
    const url = URL.createObjectURL(file);
    
    // Cache file in memory for smoother access later
    memoryCache.set(filename, file);

    if (sound) {
      // Update url as it changes every session
      sound.url = url;
    } else {
      // New file discovered (manually added to folder) -> Create basic entry
      sound = {
        id: Math.random().toString(36).substr(2, 9),
        name: filename.replace(/\.[^/.]+$/, ""),
        filename: filename,
        category: 'Chưa phân loại',
        tags: ['newly-detected'],
        url: url,
        duration: 0, // Will be calculated by UI or lazily
        source: 'UPLOAD' as any,
        isFavorite: false,
        createdAt: Date.now()
      };
    }
    finalLibrary.push(sound);
  }

  // 4. Save updated metadata (removes deleted files, adds new ones)
  await saveMetadata(finalLibrary);

  return finalLibrary;
};

export const saveMetadata = async (library: SoundEffect[]) => {
  if (!rootHandle) return;
  
  // Don't save the Blob URL
  const storageData = {
    sounds: library.map(({ url, ...rest }) => rest)
  };

  const handle = await rootHandle.getFileHandle(METADATA_FILE, { create: true });
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(storageData, null, 2));
  await writable.close();
};

export const saveSoundToFolder = async (sound: SoundEffect, blob: Blob): Promise<SoundEffect> => {
  if (!rootHandle) throw new Error("No folder");

  // Determine filename
  let filename = sound.filename || `${sound.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp3`;
  if (blob.type.includes('wav') && !filename.endsWith('.wav')) filename += '.wav';
  else if (!filename.endsWith('.mp3') && !filename.endsWith('.wav')) filename += '.mp3';

  // Write Audio File
  const fileHandle = await rootHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();

  const finalSound = { ...sound, filename };
  
  // We need to read current library to append to metadata
  // Optimization: assumes caller will update state and call saveMetadata, 
  // but to be safe we can let the caller handle the full library save.
  
  return finalSound;
};

export const deleteSoundFile = async (filename: string) => {
    // This API doesn't support delete yet in all browsers easily without 'removeEntry'
    // @ts-ignore
    if (rootHandle && rootHandle.removeEntry) {
         // @ts-ignore
         await rootHandle.removeEntry(filename);
    }
};
