
import React, { useState, useRef } from 'react';
import { extractAudioFromVideo, getAudioDuration, processVideoLink, blobToBase64 } from '../services/audioUtils';
import { analyzeSoundInfo } from '../services/geminiService';
import { SoundEffect, SoundSource } from '../types';
import { isReadonlyMode } from '../services/storage';

const generateId = () => Math.random().toString(36).substr(2, 9);

interface ExtractorProps {
  onExtract: (sound: SoundEffect, file: Blob) => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const Extractor: React.FC<ExtractorProps> = ({ onExtract, onShowToast }) => {
  const [activeTab, setActiveTab] = useState<'FILE' | 'LINK'>('FILE');
  const [isProcessing, setIsProcessing] = useState(false);
  const [videoLink, setVideoLink] = useState('');
  
  const inputRef = useRef<HTMLInputElement>(null);
  const isReadOnly = isReadonlyMode();

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    await processSource(file, file.name);
  };

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoLink.trim()) return;

    setIsProcessing(true);
    try {
        const blob = await processVideoLink(videoLink);
        // Guess filename from URL or use timestamp
        let filename = "video_download.mp4";
        try {
            const urlPath = new URL(videoLink).pathname;
            const name = urlPath.split('/').pop();
            if (name) filename = name;
        } catch(e) {}
        
        await processSource(blob, filename, true); // true = isBlob
        setVideoLink('');
    } catch (error) {
        console.error("Link processing error", error);
        onShowToast("Không thể tải video từ link này.", "error");
        setIsProcessing(false);
    }
  };

  const processSource = async (source: File | Blob, originalName: string, isBlob = false) => {
    setIsProcessing(true);
    try {
      let audioBlob: Blob;
      let audioUrl: string;
      let duration: number;

      // 1. Extract/Prepare Audio
      if (isBlob) {
          // If it came from link, it might already be audio (wav) from our util, or raw video blob
          // For simplicity in this demo, we assume processVideoLink returns a WAV blob ready to go
          audioBlob = source;
          audioUrl = URL.createObjectURL(audioBlob);
          duration = await getAudioDuration(audioUrl);
      } else {
          // It's a user uploaded video file
          audioBlob = await extractAudioFromVideo(source as File);
          audioUrl = URL.createObjectURL(audioBlob);
          duration = await getAudioDuration(audioUrl);
      }

      // 2. AI Analyze
      // We assume a generic name if it's a link, unless we parsed it
      let promptName = originalName.replace(/\.[^/.]+$/, "");
      if (promptName.length < 3) promptName = "Audio from Video";
      
      const info = await analyzeSoundInfo(promptName + " (Extracted)");

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
          // Auto download in fallback mode
          const a = document.createElement('a');
          a.href = audioUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          
          await onExtract(newSound, audioBlob);
          onShowToast("Đã tách và tải xuống máy!", "success");
      } else {
          await onExtract(newSound, audioBlob);
          onShowToast("Đã tách và lưu vào thư viện!", "success");
      }
    } catch (error) {
      console.error("Extraction error", error);
      onShowToast("Xử lý thất bại.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-4 md:p-8">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center space-x-4 mb-6 relative z-10">
           <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center text-2xl shadow-lg shadow-purple-900/30">
             {activeTab === 'FILE' ? '🎞️' : '🔗'}
           </div>
           <div>
             <h2 className="text-xl font-bold text-white">Video to Sound</h2>
             <p className="text-zinc-400 text-sm">Tách âm thanh & AI đặt tên tự động.</p>
           </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-zinc-800 p-1 rounded-xl mb-6 relative z-10">
            <button 
                onClick={() => setActiveTab('FILE')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'FILE' ? 'bg-zinc-700 text-white shadow' : 'text-zinc-400 hover:text-white'}`}
            >
                Upload File
            </button>
            <button 
                onClick={() => setActiveTab('LINK')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'LINK' ? 'bg-zinc-700 text-white shadow' : 'text-zinc-400 hover:text-white'}`}
            >
                Video Link
            </button>
        </div>

        {/* Content */}
        <div className="relative z-10 min-h-[160px]">
            {activeTab === 'FILE' ? (
                <label className={`block w-full h-40 flex flex-col items-center justify-center border-2 border-dashed border-zinc-700 rounded-xl cursor-pointer hover:border-purple-500 hover:bg-zinc-800/50 transition-all group ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <svg className="w-6 h-6 text-zinc-400 group-hover:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    </div>
                    <span className="text-zinc-300 font-medium text-sm">
                        {isProcessing ? 'Đang tách âm thanh...' : 'Chọn file Video từ máy'}
                    </span>
                    <input 
                    type="file" 
                    accept="video/*" 
                    onChange={handleVideoSelect} 
                    ref={inputRef}
                    className="hidden" 
                    />
                </label>
            ) : (
                <form onSubmit={handleLinkSubmit} className="flex flex-col h-full">
                    <div className="relative mb-4 flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                             <span className="text-zinc-500">🌐</span>
                        </div>
                        <input 
                            type="url"
                            placeholder="Paste YouTube, TikTok, Facebook link..." 
                            className="w-full h-12 bg-zinc-800 border border-zinc-700 rounded-xl pl-10 pr-4 text-white text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                            value={videoLink}
                            onChange={(e) => setVideoLink(e.target.value)}
                            disabled={isProcessing}
                        />
                    </div>
                    
                    <button 
                        type="submit"
                        disabled={isProcessing || !videoLink}
                        className={`
                            w-full py-3 rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all
                            ${isProcessing || !videoLink 
                                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                                : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-purple-500/30 hover:scale-[1.02] active:scale-95'
                            }
                        `}
                    >
                        {isProcessing ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                <span>Processing...</span>
                            </>
                        ) : (
                            <>
                                <span>Get Audio</span>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                            </>
                        )}
                    </button>
                    <p className="text-[10px] text-zinc-500 text-center mt-3">
                        Hỗ trợ đa nền tảng. AI sẽ tự động phân tích nội dung.
                    </p>
                </form>
            )}
        </div>

        {/* Decorative BG */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3 pointer-events-none"></div>
      </div>
    </div>
  );
};

export default Extractor;
