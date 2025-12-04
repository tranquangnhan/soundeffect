
import React, { useState, useRef } from 'react';
import { extractAudioFromVideo, getAudioDuration } from '../services/audioUtils';
import { analyzeSoundInfo } from '../services/geminiService';
import { SoundEffect, SoundSource } from '../types';

const generateId = () => Math.random().toString(36).substr(2, 9);

interface ExtractorProps {
  onExtract: (sound: SoundEffect, file: Blob) => void;
}

const Extractor: React.FC<ExtractorProps> = ({ onExtract }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
        filename: `${info.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.wav`
      };

      await onExtract(newSound, audioBlob);
      alert("Audio extracted and saved to library!");
    } catch (error) {
      console.error("Extraction error", error);
      alert("Failed to extract audio.");
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
             <p className="text-zinc-400 text-sm">Extract audio track from video files.</p>
           </div>
        </div>

        <div className="space-y-4">
           <label className={`block w-full py-4 text-center border-2 border-dashed border-zinc-700 rounded-lg cursor-pointer hover:border-purple-500 hover:bg-zinc-800 transition-colors ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}>
             <span className="text-zinc-300 font-medium">
               {isProcessing ? 'Extracting & Saving...' : 'Select Video File'}
             </span>
             <input 
               type="file" 
               accept="video/*" 
               onChange={handleVideoSelect} 
               ref={inputRef}
               className="hidden" 
             />
           </label>
           
           <p className="text-xs text-zinc-600 text-center">
             The audio will be saved directly to your active library folder.
           </p>
        </div>
      </div>
    </div>
  );
};

export default Extractor;
