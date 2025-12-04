
import React, { useState, useRef } from 'react';
import { analyzeSoundInfo } from '../services/geminiService';
import { blobToBase64, getAudioDuration } from '../services/audioUtils';
import { SoundEffect, SoundSource } from '../types';

const generateId = () => Math.random().toString(36).substr(2, 9);

interface UploadModalProps {
  onUpload: (sound: SoundEffect, file: Blob) => void;
}

const UploadModal: React.FC<UploadModalProps> = ({ onUpload }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, currentName: '' });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter(f => f.type.startsWith('audio/'));

    if (files.length === 0) {
      alert("No supported audio files found in selection.");
      return;
    }

    setIsProcessing(true);
    setProgress({ current: 0, total: files.length, currentName: '' });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress({ current: i + 1, total: files.length, currentName: file.name });

      try {
        const url = URL.createObjectURL(file);
        const duration = await getAudioDuration(url);
        
        // For analysis, we send a small sample or check if file is small enough
        let base64 = undefined;
        if (file.size < 4 * 1024 * 1024) { 
           base64 = await blobToBase64(file);
        }

        const info = await analyzeSoundInfo(file.name, base64, file.type);

        const newSound: SoundEffect = {
          id: generateId(),
          name: info.name,
          category: info.category,
          tags: info.tags,
          url: url, // Temporary blob url
          duration: duration,
          source: SoundSource.UPLOAD,
          isFavorite: false,
          createdAt: Date.now(),
          filename: file.name
        };

        // Pass raw file to be saved to disk
        await onUpload(newSound, file);
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
      }
    }

    setIsProcessing(false);
    setProgress({ current: 0, total: 0, currentName: '' });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      {isProcessing ? (
        <div className="text-center animate-pulse max-w-md w-full">
          <div className="text-5xl mb-4">🧠</div>
          <h3 className="text-xl font-bold text-white mb-2">Analyzing Library</h3>
          <p className="text-primary-400 font-medium mb-4">
            Processing {progress.current} of {progress.total}
          </p>
          <div className="w-full bg-zinc-800 rounded-full h-2 mb-2 overflow-hidden">
            <div 
              className="bg-primary-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            ></div>
          </div>
          <p className="text-xs text-zinc-500 truncate">
            Current: {progress.currentName}
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center w-full max-w-2xl">
          <div 
            className={`w-full h-64 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer mb-8 ${
              isDragging ? 'border-primary-500 bg-primary-500/10 scale-105' : 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/30'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="text-center text-zinc-400">
              <div className="text-5xl mb-4">💾</div>
              <p className="font-bold text-lg text-zinc-200">Drag & Drop to Local Folder</p>
              <p className="text-sm mt-2 text-zinc-500">Files will be copied to your connected folder</p>
            </div>
          </div>

          <div className="flex space-x-4">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="bg-primary-600 hover:bg-primary-500 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <span>📄</span> Select Files
            </button>
            <button 
              onClick={() => folderInputRef.current?.click()}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <span></span> Select Folder
            </button>
          </div>

          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            multiple 
            accept="audio/*"
            onChange={(e) => e.target.files && processFiles(e.target.files)}
          />
          
          <input 
            type="file" 
            ref={folderInputRef} 
            className="hidden" 
            multiple
            // @ts-ignore
            webkitdirectory=""
            directory=""
            onChange={(e) => e.target.files && processFiles(e.target.files)}
          />
        </div>
      )}
    </div>
  );
};

export default UploadModal;
