
import React, { useState } from 'react';
import { SoundEffect } from '../types';
import { checkCopyright } from '../services/geminiService';

interface SoundListProps {
  sounds: SoundEffect[];
  onToggleFavorite: (id: string) => void;
  onUpdateSound: (updated: SoundEffect) => void;
}

const SoundList: React.FC<SoundListProps> = ({ sounds, onToggleFavorite, onUpdateSound }) => {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [errorIds, setErrorIds] = useState<Set<string>>(new Set());
  
  // Renaming State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');

  const handlePlay = (id: string, url: string) => {
    if (errorIds.has(id)) return;

    // Stop any currently playing audio
    const audios = document.getElementsByTagName('audio');
    for (let i = 0; i < audios.length; i++) {
      audios[i].pause();
      audios[i].currentTime = 0;
    }

    if (playingId === id) {
      setPlayingId(null);
    } else {
      setPlayingId(id);
      const audio = document.getElementById(`audio-${id}`) as HTMLAudioElement;
      if (audio) {
        audio.play().catch(e => {
          console.error("Playback failed", e);
          setPlayingId(null);
        });
        audio.onended = () => setPlayingId(null);
      }
    }
  };

  const handlePlayError = (id: string) => {
    setErrorIds(prev => new Set(prev).add(id));
    setPlayingId(null);
  };

  const handleCopyrightCheck = async (sound: SoundEffect) => {
    setCheckingId(sound.id);
    const result = await checkCopyright(sound.name, sound.source);
    onUpdateSound({
      ...sound,
      copyrightStatus: result.status,
      copyrightReason: result.reason
    });
    setCheckingId(null);
  };

  // --- Renaming Logic ---
  const startEditing = (sound: SoundEffect) => {
    setEditingId(sound.id);
    setEditName(sound.name);
  };

  const saveEdit = (sound: SoundEffect) => {
    if (editName.trim()) {
      onUpdateSound({ ...sound, name: editName.trim() });
    }
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  // --- Download Logic ---
  const handleDownload = (e: React.MouseEvent, sound: SoundEffect) => {
    e.stopPropagation(); // Prevent triggering other clicks
    const a = document.createElement('a');
    a.href = sound.url;
    // Simple extension detection
    const ext = sound.url.includes('wav') ? 'wav' : 'mp3';
    a.download = `${sound.name.replace(/\s+/g, '_')}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (sounds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-ios-gray">
        <span className="text-4xl mb-4 opacity-50">🔇</span>
        <p className="font-light">Library Empty</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pb-24">
      {sounds.map((sound) => (
        <div 
          key={sound.id} 
          className={`relative group bg-ios-surface hover:bg-ios-surface2 transition-all duration-300 rounded-2xl p-5 shadow-lg border border-transparent hover:border-ios-border hover:-translate-y-1 ${errorIds.has(sound.id) ? 'opacity-50' : ''}`}
        >
          {/* Header: Title & Tags */}
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1 mr-3 overflow-hidden">
              {editingId === sound.id ? (
                <div className="flex items-center space-x-2">
                  <input 
                    type="text" 
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-ios-surface2 border border-ios-blue rounded-lg px-2 py-1 text-sm text-white focus:outline-none"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(sound);
                      if (e.key === 'Escape') cancelEdit();
                    }}
                  />
                </div>
              ) : (
                <div className="group/title">
                  <h3 
                    className="font-semibold text-white truncate text-[15px] leading-tight cursor-pointer" 
                    title={sound.name}
                    onDoubleClick={() => startEditing(sound)}
                  >
                    {sound.name}
                  </h3>
                  <div className="flex items-center mt-1 space-x-2">
                    <p className="text-[11px] font-medium text-ios-gray uppercase tracking-wider">{sound.category}</p>
                    <button 
                      onClick={() => startEditing(sound)} 
                      className="opacity-0 group-hover/title:opacity-100 text-ios-blue text-xs transition-opacity"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <button
              onClick={() => onToggleFavorite(sound.id)}
              className={`transition-transform active:scale-90 ${sound.isFavorite ? 'text-yellow-400' : 'text-ios-gray hover:text-white'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 fill-current" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </button>
          </div>

          {/* Tags (Subtle) */}
          <div className="flex gap-1.5 mb-6 opacity-70">
            {sound.tags.slice(0, 3).map((tag, idx) => (
              <span key={idx} className="text-[10px] bg-ios-surface2 text-ios-gray px-2 py-0.5 rounded-full border border-white/5">
                #{tag}
              </span>
            ))}
          </div>

          {/* Controls Area */}
          <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
            <div className="flex items-center space-x-3">
              {/* Main Play Button */}
              <button
                onClick={() => handlePlay(sound.id, sound.url)}
                disabled={errorIds.has(sound.id)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg active:scale-95 ${
                  errorIds.has(sound.id) ? 'bg-red-500/20 text-red-500' : 
                  playingId === sound.id ? 'bg-ios-blue text-white shadow-blue-500/30' : 'bg-white text-black hover:bg-gray-200'
                }`}
              >
                {errorIds.has(sound.id) ? '!' : playingId === sound.id ? (
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 fill-current" viewBox="0 0 20 20" fill="currentColor">
                     <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 01-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 001 1h2a1 1 0 001-1V8a1 1 0 00-1-1h-2z" clipRule="evenodd" />
                   </svg>
                ) : (
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-0.5 fill-current" viewBox="0 0 20 20" fill="currentColor">
                     <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                   </svg>
                )}
              </button>

              {/* Download Button - Big and Easy to Hit */}
              <button 
                onClick={(e) => handleDownload(e, sound)}
                className="w-10 h-10 rounded-full bg-ios-surface2 hover:bg-ios-blue hover:text-white text-ios-gray flex items-center justify-center transition-all active:scale-95 group/dl"
                title="Download File"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
            </div>
            
            {/* Visualizer / Status */}
            <div className="flex flex-col items-end space-y-1">
               <div className="h-4 flex items-center space-x-0.5">
                   {playingId === sound.id ? (
                     [...Array(6)].map((_, i) => (
                       <div 
                          key={i} 
                          className="w-0.5 bg-ios-blue animate-pulse-fast rounded-full"
                          style={{ height: '100%', animationDelay: `${i * 0.1}s` }}
                       ></div>
                     ))
                   ) : (
                     <div className="w-12 h-0.5 bg-white/10 rounded-full"></div>
                   )}
               </div>
               <div className="flex items-center space-x-2">
                 {/* Copyright Badge - Minimal */}
                 {sound.copyrightStatus === 'Safe' && (
                   <span className="text-[9px] text-green-500 font-medium px-1.5 py-0.5 bg-green-500/10 rounded">SAFE</span>
                 )}
                 {sound.copyrightStatus === 'Risky' && (
                   <span className="text-[9px] text-red-500 font-medium px-1.5 py-0.5 bg-red-500/10 rounded">RISKY</span>
                 )}
                 {!sound.copyrightStatus && (
                    <button 
                      onClick={() => handleCopyrightCheck(sound)} 
                      className="text-[9px] text-ios-gray hover:text-ios-blue transition-colors"
                    >
                      {checkingId === sound.id ? '...' : 'Check ©'}
                    </button>
                 )}
                 <span className="text-[10px] text-ios-gray tabular-nums">{sound.duration.toFixed(1)}s</span>
               </div>
            </div>
          </div>
          
          {/* Hidden Audio */}
          <audio 
            id={`audio-${sound.id}`} 
            src={sound.url} 
            preload="none" 
            onError={() => handlePlayError(sound.id)}
          />
        </div>
      ))}
    </div>
  );
};

export default SoundList;
