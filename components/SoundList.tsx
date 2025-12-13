
import React, { useState, useEffect, useRef, memo } from 'react';
import { SoundEffect } from '../types';
import { checkCopyright, analyzeSoundInfo } from '../services/geminiService';
import { blobToBase64 } from '../services/audioUtils';
import WaveSurfer from 'wavesurfer.js';

interface SoundListProps {
  sounds: SoundEffect[];
  onToggleFavorite: (id: string) => void;
  onUpdateSound: (updated: SoundEffect) => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

// Separate component for Waveform to handle lifecycle cleanly
const WaveformPlayer = memo(({ url, isPlaying, onFinish }: { url: string, isPlaying: boolean, onFinish: () => void }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create WaveSurfer instance
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#4b5563', // gray-600
      progressColor: '#0a84ff', // ios-blue
      cursorColor: 'rgba(255, 255, 255, 0.5)',
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 40,
      normalize: true,
      url: url,
    });

    wavesurferRef.current = ws;

    // Fix: Wait for audio to be ready before playing
    ws.once('ready', () => {
        if (isPlaying) {
            ws.play().catch(e => console.error("Auto-play failed:", e));
        }
    });

    ws.on('finish', () => {
        onFinish();
    });

    // Ensure interaction (seeking) plays the audio
    ws.on('interaction', () => {
       ws.play();
    });

    return () => {
      // Cleanup
      try {
        ws.unAll();
        ws.destroy();
      } catch (e) {
        // ignore cleanup errors
      }
    };
  }, [url]);

  // Handle Play/Pause props updates
  useEffect(() => {
    if (!wavesurferRef.current) return;
    
    if (isPlaying) {
        wavesurferRef.current.play().catch(() => {});
    } else {
        wavesurferRef.current.pause();
    }
  }, [isPlaying]);

  // Stop propagation to prevent parent onClick
  return <div ref={containerRef} className="w-full" onClick={(e) => e.stopPropagation()} />;
});

// Component for static fake waveform (performance optimization)
const StaticWaveform = memo(({ seed }: { seed: string }) => {
    const bars = 40;
    const pseudoRandom = (str: string) => {
        let h = 0xdeadbeef;
        for(let i = 0; i < str.length; i++)
            h = Math.imul(h ^ str.charCodeAt(i), 2654435761);
        return ((h ^ h >>> 16) >>> 0) / 4294967296;
    }

    return (
        <div className="flex items-center gap-[1px] h-[40px] w-full opacity-60">
            {Array.from({ length: bars }).map((_, i) => {
                const height = Math.max(20, Math.floor(pseudoRandom(seed + i) * 100));
                return (
                    <div 
                        key={i} 
                        className="w-[2px] bg-gray-600 rounded-full"
                        style={{ height: `${height}%` }}
                    ></div>
                );
            })}
        </div>
    );
});

const SoundList: React.FC<SoundListProps> = ({ sounds, onToggleFavorite, onUpdateSound, onShowToast }) => {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [errorIds, setErrorIds] = useState<Set<string>>(new Set());
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');

  const handlePlayToggle = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (errorIds.has(id)) return;
    setPlayingId(prev => prev === id ? null : id);
  };

  const handleWaveformClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    // If clicking waveform while not playing, start playing.
    // If already playing, WaveSurfer handles the seek internally (interaction event), 
    // so we don't toggle off here.
    if (playingId !== id) {
        setPlayingId(id);
    }
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
    onShowToast(`Đã kiểm tra bản quyền: ${result.status}`, result.status === 'Safe' ? 'success' : 'info');
  };

  const handleMagicRename = async (sound: SoundEffect) => {
    try {
      setRenamingId(sound.id);
      
      const response = await fetch(sound.url);
      const blob = await response.blob();
      
      let base64 = undefined;
      if (blob.size < 4 * 1024 * 1024) {
         base64 = await blobToBase64(blob);
      }
      
      const info = await analyzeSoundInfo(sound.filename, base64, blob.type);
      
      onUpdateSound({
        ...sound,
        name: info.name,
        category: info.category,
        tags: info.tags
      });
      onShowToast("Đã cập nhật tên mới!", "success");
      
    } catch (e) {
      console.error("Magic rename failed", e);
      onShowToast("AI không thể phân tích file này.", "error");
    } finally {
      setRenamingId(null);
    }
  };

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

  const handleDownload = (e: React.MouseEvent, sound: SoundEffect) => {
    e.stopPropagation();
    const a = document.createElement('a');
    a.href = sound.url;
    const ext = sound.url.includes('wav') ? 'wav' : 'mp3';
    a.download = `${sound.name.replace(/\s+/g, '_')}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    onShowToast("Đang tải xuống...", "info");
  };

  const handleDragStart = (e: React.DragEvent, sound: SoundEffect) => {
      e.dataTransfer.setData('soundId', sound.id);
      e.dataTransfer.effectAllowed = 'move';
      // Create a nice drag image
      const div = document.createElement('div');
      div.innerText = `🎵 ${sound.name}`;
      div.style.background = '#0a84ff';
      div.style.color = 'white';
      div.style.padding = '8px 12px';
      div.style.borderRadius = '8px';
      div.style.position = 'absolute';
      div.style.top = '-1000px';
      document.body.appendChild(div);
      e.dataTransfer.setDragImage(div, 0, 0);
      setTimeout(() => document.body.removeChild(div), 0);
  };

  if (sounds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-ios-gray">
        <span className="text-4xl mb-4 opacity-50">🔇</span>
        <p className="font-light">Thư viện trống</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5 pb-24 isolate">
      {sounds.map((sound) => (
        <div 
          key={sound.id} 
          draggable={true}
          onDragStart={(e) => handleDragStart(e, sound)}
          className={`relative group bg-ios-surface hover:bg-ios-surface2 transition-all duration-300 rounded-2xl p-4 md:p-5 shadow-lg border border-transparent hover:border-ios-border hover:z-50 ${errorIds.has(sound.id) ? 'opacity-50' : ''} cursor-grab active:cursor-grabbing`}
          onClick={(e) => {
              // Clicking background cancels edit
              if (editingId === sound.id) cancelEdit();
          }}
        >
          {/* Top Section: Title & Favorite */}
          <div className="flex justify-between items-start mb-4 relative z-20">
            <div className="flex-1 mr-3 min-w-0">
              {editingId === sound.id ? (
                <div className="flex items-center space-x-2">
                  <input 
                    type="text" 
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-ios-surface2 border border-ios-blue rounded-lg px-2 py-1 text-sm text-white focus:outline-none"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter') saveEdit(sound);
                      if (e.key === 'Escape') cancelEdit();
                    }}
                  />
                </div>
              ) : (
                <div>
                  {/* Title Row: Name + Buttons */}
                  <div className="flex items-center gap-2">
                    <h3 
                        className="font-semibold text-white truncate text-[15px] leading-tight cursor-pointer" 
                        title={sound.name}
                        onDoubleClick={() => startEditing(sound)}
                    >
                        {sound.name}
                    </h3>

                    {/* MOVED BUTTONS HERE: Right next to title */}
                    <div className="flex shrink-0 md:opacity-0 group-hover:opacity-100 items-center gap-1 transition-opacity duration-200">
                        <button onClick={(e) => { e.stopPropagation(); startEditing(sound); }} className="text-ios-blue text-xs hover:text-white px-1.5 py-0.5 rounded hover:bg-white/10 bg-white/5 md:bg-transparent">Edit</button>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleMagicRename(sound); }}
                            className={`text-xs flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/10 bg-white/5 md:bg-transparent ${renamingId === sound.id ? 'text-purple-400 animate-pulse' : 'text-purple-500 hover:text-purple-300'}`}
                            disabled={renamingId === sound.id}
                        >
                            {renamingId === sound.id ? '...' : 'AI Fix'}
                        </button>
                    </div>
                  </div>
                  
                  {/* Category Row */}
                  <div className="flex items-center mt-1">
                    <p className="text-[11px] font-medium text-ios-gray uppercase tracking-wider truncate">
                        {sound.category}
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(sound.id); }}
              className={`p-1 transition-transform active:scale-90 flex-shrink-0 ${sound.isFavorite ? 'text-yellow-400' : 'text-ios-gray hover:text-white'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 fill-current" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </button>
          </div>

          {/* Middle Section: Layout with Play Button Left + Waveform Right */}
          <div className="mb-4 flex items-center gap-3">
             {/* Circular Play Button */}
             <button
                onClick={(e) => handlePlayToggle(e, sound.id)}
                className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg active:scale-95 ${
                    playingId === sound.id 
                    ? 'bg-ios-blue text-white shadow-blue-500/30' 
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
             >
                 {playingId === sound.id ? (
                     <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                 ) : (
                     <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                 )}
             </button>

             {/* Waveform Container */}
             <div 
                className="flex-1 h-10 flex items-center justify-center bg-black/20 rounded-lg overflow-hidden relative cursor-pointer border border-white/5"
                onClick={(e) => handleWaveformClick(e, sound.id)}
             >
                  {playingId === sound.id ? (
                      <WaveformPlayer 
                        url={sound.url} 
                        isPlaying={true} 
                        onFinish={() => setPlayingId(null)} 
                      />
                  ) : (
                      <StaticWaveform seed={sound.id} />
                  )}
             </div>
          </div>

          {/* Bottom Section: Controls & Metadata */}
          <div className="flex items-center justify-between mt-auto border-t border-white/5 pt-2">
            <div className="flex gap-1.5 opacity-70 overflow-x-auto no-scrollbar max-w-[60%]">
                {sound.tags.slice(0, 2).map((tag, idx) => (
                <span key={idx} className="text-[10px] bg-ios-surface2 text-ios-gray px-2 py-0.5 rounded-full border border-white/5 whitespace-nowrap">
                    #{tag}
                </span>
                ))}
            </div>

            <div className="flex items-center space-x-2">
                 <button 
                    onClick={(e) => handleDownload(e, sound)}
                    className="p-1.5 rounded-full bg-ios-surface2 hover:bg-white/10 text-ios-gray hover:text-white transition-all"
                    title="Download"
                >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                </button>

                 {!sound.copyrightStatus ? (
                    <button onClick={(e) => { e.stopPropagation(); handleCopyrightCheck(sound); }} className="text-[9px] text-ios-gray hover:text-ios-blue transition-colors px-1.5 py-0.5 bg-white/5 rounded">
                      Check ©
                    </button>
                 ) : (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${sound.copyrightStatus === 'Safe' ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'}`}>
                        {sound.copyrightStatus.toUpperCase()}
                    </span>
                 )}
                 <span className="text-[10px] text-ios-gray font-mono">{sound.duration > 0 ? sound.duration.toFixed(1) + 's' : ''}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SoundList;
