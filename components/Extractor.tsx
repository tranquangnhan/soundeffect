
import React, { useState, useRef } from 'react';
import { extractAudioFromVideo, getAudioDuration } from '../services/audioUtils';
import { analyzeSoundInfo } from '../services/geminiService';
import { SoundEffect, SoundSource } from '../types';
import { isReadonlyMode } from '../services/storage';

const generateId = () => Math.random().toString(36).substr(2, 9);

interface ExtractorProps {
  onExtract: (sound: SoundEffect, file: Blob) => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const Extractor: React.FC<ExtractorProps> = ({ onExtract, onShowToast }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isReadOnly = isReadonlyMode();

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    
    const file = e.target.files[0];
    setIsProcessing(true);

    try {
      // 1. Extract Audio
      const audioBlob = await extractAudioFromVideo(file);
      const audioUrl = URL.createObjectURL(audioBlob);
      const duration = await getAudioDuration(audioUrl);

      // 2. AI Analyze
      const info = await analyzeSoundInfo(file.name.replace(/\.[^/.]+$/, "") + " (Extracted)");

      const filename = `${info.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.wav`;

      const newSound: SoundEffect = {
        id: generateId(),
        name: info.name,
        category: info.category,
        tags: [...info.tags, 'extracted'],
        url: audioUrl,
        duration: duration,
        source: SoundSource.EXTRACTED,
        isFavorite: false,
        createdAt: Date.now(),
        filename: filename
      };

      if (isReadOnly) {
          const a = document.createElement('a');
          a.href = audioUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          
          await onExtract(newSound, audioBlob);
          onShowToast("Đã tách và tải xuống audio!", "success");
      } else {
          await onExtract(newSound, audioBlob);
          onShowToast("Đã tách và lưu vào thư viện!", "success");
      }
    } catch (error) {
      console.error("Extraction error", error);
      onShowToast("Tách âm thanh thất bại.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-8 max-w-lg w-full shadow-2xl">
        <div className="flex items-center space-x-4 mb-6">
           <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center text-2xl">🎞️</div>
           <div>
             <h2 className="text-xl font-bold text-white">Video to Sound</h2>
             <p className="text-zinc-400 text-sm">Tách âm thanh từ file video.</p>
           </div>
        </div>

        {isReadOnly && (
             <div className="bg-yellow-500/20 text-yellow-200 px-4 py-2 rounded-lg mb-6 text-sm border border-yellow-500/30">
                Mode: Read-Only. File sẽ tự động tải xuống thay vì lưu vào thư mục.
             </div>
        )}

        <div className="space-y-4">
           <label className={`block w-full py-4 text-center border-2 border-dashed border-zinc-700 rounded-lg cursor-pointer hover:border-purple-500 hover:bg-zinc-800 transition-colors ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}>
             <span className="text-zinc-300 font-medium">
               {isProcessing ? 'Đang xử lý...' : 'Chọn file Video'}
             </span>
             <input 
               type="file" 
               accept="video/*" 
               onChange={handleVideoSelect} 
               ref={inputRef}
               className="hidden" 
             />
           </label>
        </div>
      </div>
    </div>
  );
};

export default Extractor;
