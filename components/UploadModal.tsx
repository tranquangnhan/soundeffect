
import React, { useState, useRef } from 'react';
import { analyzeSoundInfo } from '../services/geminiService';
import { blobToBase64, getAudioDuration } from '../services/audioUtils';
import { SoundEffect, SoundSource } from '../types';
import { isReadonlyMode } from '../services/storage';

const generateId = () => Math.random().toString(36).substr(2, 9);

interface UploadModalProps {
  onUpload: (sound: SoundEffect, file: Blob) => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const UploadModal: React.FC<UploadModalProps> = ({ onUpload, onShowToast }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, currentName: '' });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (fileList: FileList | File[]) => {
    // Expanded filter for Audio Mime Types or specific extensions (like WMA/AAC/FLAC)
    const files = Array.from(fileList).filter(f => 
        f.type.startsWith('audio/') || 
        /\.(aac|wma|flac|m4a|ogg|wav|mp3)$/i.test(f.name)
    );
    
    const isReadOnly = isReadonlyMode();

    if (files.length === 0) {
      onShowToast("Không tìm thấy file âm thanh hợp lệ (MP3, WAV, AAC, WMA...).", "error");
      return;
    }

    setIsProcessing(true);
    setProgress({ current: 0, total: files.length, currentName: '' });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress({ current: i + 1, total: files.length, currentName: file.name });

      try {
        const url = URL.createObjectURL(file);
        
        // Duration might fail for WMA/AAC in some browsers, default to 0
        let duration = 0;
        try {
            duration = await getAudioDuration(url);
        } catch(e) {
            console.warn("Could not get duration for", file.name);
        }
        
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
          url: url,
          duration: duration,
          source: SoundSource.UPLOAD,
          isFavorite: false,
          createdAt: Date.now(),
          filename: file.name
        };

        await onUpload(newSound, file);

      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
      }
    }

    if (isReadOnly) {
        onShowToast("Chế độ Chỉ Đọc: File sẽ không lưu vào ổ cứng.", "info");
    } else {
        onShowToast("Đã upload và phân loại xong!", "success");
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

  const isReadOnly = isReadonlyMode();

  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      {isProcessing ? (
        <div className="text-center animate-pulse max-w-md w-full">
          <div className="text-5xl mb-4">🧠</div>
          <h3 className="text-xl font-bold text-white mb-2">Đang phân tích thư viện</h3>
          <p className="text-primary-400 font-medium mb-4">
            Đang xử lý {progress.current} / {progress.total}
          </p>
          <div className="w-full bg-zinc-800 rounded-full h-2 mb-2 overflow-hidden">
            <div 
              className="bg-primary-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            ></div>
          </div>
          <p className="text-xs text-zinc-500 truncate">
            {progress.currentName}
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center w-full max-w-2xl">
          {isReadOnly && (
             <div className="bg-yellow-500/20 text-yellow-200 px-4 py-2 rounded-lg mb-6 text-sm border border-yellow-500/30">
                ⚠ Chế độ Read-Only: File sẽ không được lưu vào ổ cứng.
             </div>
          )}

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
              <p className="font-bold text-lg text-zinc-200">Kéo thả file vào đây</p>
              <p className="text-sm mt-2 text-zinc-500">
                  {isReadOnly ? "Phân tích file trong session hiện tại" : "File sẽ được copy vào thư mục gốc"}
              </p>
              <p className="text-[10px] text-zinc-600 mt-2 uppercase tracking-widest">Supports: MP3, WAV, AAC, WMA, FLAC, M4A</p>
            </div>
          </div>

          <div className="flex space-x-4">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="bg-primary-600 hover:bg-primary-500 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <span>📄</span> Chọn File
            </button>
            {!isReadOnly && (
                <button 
                onClick={() => folderInputRef.current?.click()}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                <span>📂</span> Chọn Thư Mục
                </button>
            )}
          </div>

          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            multiple 
            accept="audio/*,.aac,.wma,.flac,.m4a"
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
