
import React, { useState, useEffect, useRef, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import SoundList from './components/SoundList';
import Extractor from './components/Extractor';
import WebSearch from './components/WebSearch';
import Recommendations from './components/Recommendations';
import Toast from './components/Toast';
import ConfirmModal from './components/ConfirmModal';
import Tour from './components/Tour';
import SupportWidget from './components/SupportWidget';
import { SoundEffect, ViewMode, DEFAULT_CATEGORIES } from './types';
import { smartFilterLibrary, analyzeSoundInfo } from './services/geminiService';
import { blobToBase64 } from './services/audioUtils';
import { 
  openDirectory, 
  scanLibrary, 
  saveMetadata, 
  saveSoundToFolder, 
  handleFallbackSelection,
  checkSavedSession,
  restoreSession,
  disconnectSession
} from './services/storage';

const App: React.FC = () => {
  // App State
  const [view, setView] = useState<ViewMode>('LIBRARY');
  const [sounds, setSounds] = useState<SoundEffect[]>([]);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  
  // Combined categories
  const allCategories = Array.from(new Set([...DEFAULT_CATEGORIES, ...customCategories]));

  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [isSmartSearching, setIsSmartSearching] = useState(false);
  const [filteredIds, setFilteredIds] = useState<string[] | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  
  // Batch Processing State
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const cancelScanRef = useRef(false);

  const [folderName, setFolderName] = useState<string | null>(null);
  const [savedFolder, setSavedFolder] = useState<string | null>(null);
  
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null); // Ref for shortcut

  // UI Feedback State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  // Tour State
  const [showTour, setShowTour] = useState(false);

  // Helper function to show toast
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
  };

  // Helper function to show confirmation
  const requestConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({ title, message, onConfirm });
  };

  // Load Search History and Check Session
  useEffect(() => {
    const savedHistory = localStorage.getItem('sonicflow_history');
    if (savedHistory) setSearchHistory(JSON.parse(savedHistory));

    const checkSession = async () => {
      const saved = await checkSavedSession();
      if (saved) setSavedFolder(saved);
    };
    checkSession();

    // Check tour status
    const tourSeen = localStorage.getItem('sfx_tour_seen');
    if (!tourSeen) {
       // Wait a bit for UI to load
       setTimeout(() => setShowTour(true), 1000);
    }
  }, []);

  // Keyboard Shortcuts (Ctrl + F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const finishTour = () => {
    setShowTour(false);
    localStorage.setItem('sfx_tour_seen', 'true');
  };

  useEffect(() => {
    localStorage.setItem('sonicflow_history', JSON.stringify(searchHistory));
  }, [searchHistory]);

  // Handlers
  const handleConnectFolder = async () => {
    try {
      const handle = await openDirectory();
      setFolderName(handle.name);
      setSavedFolder(handle.name);
      loadLibrary();
    } catch (error: any) {
      if (error.message !== 'The user aborted a request.') {
        console.warn("Native File System failed, trying fallback input", error);
        if (fallbackInputRef.current) {
          fallbackInputRef.current.click();
        }
      }
    }
  };

  const handleRestoreSession = async () => {
    try {
      const handle = await restoreSession();
      setFolderName(handle.name);
      loadLibrary();
    } catch (error) {
      console.error("Restore failed", error);
      showToast("Phiên làm việc hết hạn hoặc bị từ chối. Vui lòng chọn lại folder.", "error");
      await disconnectSession();
      setSavedFolder(null);
    }
  };

  const handleDisconnect = async () => {
    requestConfirm("Đổi thư mục", "Bạn có chắc muốn đóng thư viện hiện tại để chọn thư mục khác không?", async () => {
       await disconnectSession();
       setFolderName(null);
       setSavedFolder(null);
       setSounds([]);
       setConfirmDialog(null);
    });
  };

  const handleFallbackChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const name = await handleFallbackSelection(e.target.files);
      setFolderName(name + " (Session)");
      loadLibrary();
    }
  };

  const loadLibrary = async () => {
    setLoading(true);
    try {
        const result = await scanLibrary();
        setSounds(result.sounds);
        setCustomCategories(result.customCategories);
    } catch(e) {
        showToast("Lỗi tải thư viện", "error");
    }
    setLoading(false);
  };

  const handleRescan = async () => {
    loadLibrary();
    showToast("Đã làm mới thư viện", "success");
  };

  const handleAddSound = async (sound: SoundEffect, file: Blob) => {
    try {
      // 1. Save file to disk
      const savedSound = await saveSoundToFolder(sound, file);
      
      // 2. Update state
      const newLib = [savedSound, ...sounds];
      setSounds(newLib);
      
      // 3. Update metadata json
      await saveMetadata(newLib, customCategories);
      
      setView('LIBRARY');
    } catch (e: any) {
      if (e.message === "READ_ONLY_MODE") {
         showToast("Chế độ Read-Only: Hãy tải file thủ công.", "info");
      } else {
         console.error("Save failed", e);
         showToast("Lỗi khi lưu file.", "error");
      }
    }
  };

  const handleCreateCategory = async (name: string) => {
    if (allCategories.includes(name)) {
        showToast("Danh mục đã tồn tại", "error");
        return;
    }
    const newCustom = [...customCategories, name];
    setCustomCategories(newCustom);
    await saveMetadata(sounds, newCustom);
    showToast(`Đã tạo danh mục "${name}"`, "success");
  };

  const handleDeleteCategory = async (category: string) => {
    if (DEFAULT_CATEGORIES.includes(category)) return;

    requestConfirm(
      "Xóa danh mục",
      `Bạn có chắc muốn xóa danh mục "${category}"? Các âm thanh trong này sẽ chuyển về "Chưa phân loại".`,
      async () => {
        // 1. Remove from custom list
        const newCustom = customCategories.filter(c => c !== category);
        setCustomCategories(newCustom);

        // 2. Update sounds: Move sounds in this category to "Chưa phân loại"
        const newLib = sounds.map(s => 
          s.category === category ? { ...s, category: 'Chưa phân loại' } : s
        );
        setSounds(newLib);

        // 3. Save
        await saveMetadata(newLib, newCustom);

        // 4. Reset view if needed
        if (activeCategory === category) {
          setActiveCategory('All');
        }
        
        setConfirmDialog(null);
        showToast(`Đã xóa danh mục "${category}"`, "success");
      }
    );
  };

  const handleDropSoundToCategory = async (soundId: string, category: string) => {
    const sound = sounds.find(s => s.id === soundId);
    if (!sound) return;

    if (sound.category === category) return;

    const updatedSound = { ...sound, category };
    const newLib = sounds.map(s => s.id === soundId ? updatedSound : s);
    
    setSounds(newLib);
    await saveMetadata(newLib, customCategories);
    showToast(`Đã chuyển sang "${category}"`, "success");
  };

  const handleToggleFavorite = async (id: string) => {
    const newLib = sounds.map(s => s.id === id ? { ...s, isFavorite: !s.isFavorite } : s);
    setSounds(newLib);
    await saveMetadata(newLib, customCategories);
  };

  const handleUpdateSound = async (updated: SoundEffect) => {
    const newLib = sounds.map(s => s.id === updated.id ? updated : s);
    setSounds(newLib);
    await saveMetadata(newLib, customCategories);
  };

  const runSmartSearch = async () => {
    if (!searchQuery) {
      setFilteredIds(null);
      return;
    }
    setSearchHistory(prev => [searchQuery, ...prev.filter(s => s !== searchQuery)].slice(0, 20));
    setIsSmartSearching(true);
    const ids = await smartFilterLibrary(searchQuery, sounds);
    setFilteredIds(ids);
    setIsSmartSearching(false);
  };

  const handleCancelScan = () => {
    if (isBatchProcessing) {
      cancelScanRef.current = true;
      setIsBatchProcessing(false);
      setBatchProgress(0);
      showToast("Đã dừng Magic Scan.", "info");
    }
  };

  const handleBatchAutoRename = async () => {
    // If currently processing, clicking again (via button in header) cancels it.
    if (isBatchProcessing) {
      handleCancelScan();
      return;
    }

    const unclassified = sounds.filter(s => 
      !s.category || 
      s.category === 'Chưa phân loại' || 
      s.category === 'Unknown' ||
      s.tags.includes('newly-detected')
    );

    if (unclassified.length === 0) {
      showToast("Tuyệt vời! Tất cả file đã được phân loại.", "success");
      return;
    }

    requestConfirm(
      "AI Magic Scan",
      `Tìm thấy ${unclassified.length} file chưa phân loại. Bạn có muốn AI tự động nghe và đặt tên lại không?`,
      async () => {
        setConfirmDialog(null); // Close modal
        setIsBatchProcessing(true);
        cancelScanRef.current = false;
        let processedCount = 0;
        let currentLib = [...sounds];

        for (const sound of unclassified) {
          if (cancelScanRef.current) break; // Check for cancellation

          try {
              processedCount++;
              setBatchProgress(Math.round((processedCount / unclassified.length) * 100));

              let base64 = undefined;
              let mimeType = undefined;

              try {
                const res = await fetch(sound.url);
                const blob = await res.blob();
                mimeType = blob.type;
                if (blob.size < 4 * 1024 * 1024) {
                  base64 = await blobToBase64(blob);
                }
              } catch (blobError) {
                console.warn(`Could not read audio data for ${sound.name}, using filename only.`);
              }

              const info = await analyzeSoundInfo(sound.filename || sound.name, base64, mimeType);

              currentLib = currentLib.map(s => s.id === sound.id ? {
                ...s,
                name: info.name,
                category: info.category,
                tags: info.tags
              } : s);

              setSounds([...currentLib]);
          } catch (e) {
              console.error("Batch fail for", sound.name, e);
          }
        }

        await saveMetadata(currentLib, customCategories);
        setIsBatchProcessing(false);
        setBatchProgress(0);
        
        if (!cancelScanRef.current) {
          showToast("Hoàn tất Magic Scan!", "success");
        }
      }
    );
  };

  const displayedSounds = sounds.filter(sound => {
    // 1. Category Filter
    if (activeCategory === 'Favorites' && !sound.isFavorite) return false;
    if (activeCategory !== 'All' && activeCategory !== 'Favorites' && sound.category !== activeCategory) return false;
    
    // 2. Search Filter
    if (filteredIds !== null) return filteredIds.includes(sound.id);
    if (searchQuery) return sound.name.toLowerCase().includes(searchQuery.toLowerCase());
    return true;
  });

  const favorites = sounds.filter(s => s.isFavorite);

  // --- RELATED TAGS CALCULATION ---
  const relatedTags = useMemo(() => {
    if (!searchQuery || displayedSounds.length === 0) return [];
    
    const tagCounts: Record<string, number> = {};
    displayedSounds.forEach(sound => {
      sound.tags.forEach(tag => {
        const lowerTag = tag.toLowerCase();
        // Ignore the search query itself in suggestions
        if (!searchQuery.toLowerCase().includes(lowerTag)) {
             tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        }
      });
    });

    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1]) // Sort by frequency
      .slice(0, 6) // Top 6
      .map(([tag]) => tag);
  }, [displayedSounds, searchQuery]);

  const addTagToSearch = (tag: string) => {
    setSearchQuery(prev => `${prev} ${tag}`.trim());
    // Auto trigger search logic if needed, but the current UI requires enter or button
  };

  // --- RENDERING ---

  // Screen 1: Connect / Reconnect Folder
  if (!folderName) {
     return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
           <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[100px] animate-float"></div>
           <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[100px] animate-float" style={{animationDelay: '2s'}}></div>

           <div className="glass max-w-md w-full p-8 md:p-10 rounded-[32px] md:rounded-[40px] border border-white/5 shadow-2xl z-10 text-center">
              <div className="w-16 h-16 md:w-20 md:h-20 mx-auto rounded-3xl bg-gradient-to-br from-ios-blue to-purple-600 shadow-xl shadow-blue-500/20 mb-6 flex items-center justify-center text-3xl md:text-4xl">
                 📁
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 tracking-tight">SFX Studio</h1>
              
              {savedFolder ? (
                <>
                  <div className="bg-ios-surface2/50 rounded-xl p-4 mb-6 border border-white/5">
                      <p className="text-ios-gray text-xs uppercase tracking-wider font-bold mb-1">Thư viện gần nhất</p>
                      <p className="text-white font-semibold text-lg truncate" title={savedFolder}>{savedFolder}</p>
                  </div>
                  
                  <button 
                     onClick={handleRestoreSession}
                     className="w-full bg-ios-blue text-white font-semibold text-base md:text-lg py-3.5 md:py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-ios-blueHighlight transition-all active:scale-95 shadow-lg shadow-blue-900/30 mb-4"
                  >
                     <span>⚡️</span> Vào ngay
                  </button>

                  <button 
                     onClick={async () => { await disconnectSession(); setSavedFolder(null); }}
                     className="w-full bg-white/5 hover:bg-white/10 text-ios-gray hover:text-white font-medium text-sm py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                     Đổi thư mục khác
                  </button>
                </>
              ) : (
                <>
                  <p className="text-ios-gray mb-8 leading-relaxed text-sm">
                     Chọn thư mục trên máy tính để quản lý âm thanh.<br className="hidden md:block"/>
                     Dữ liệu sẽ được lưu an toàn trên máy bạn.
                  </p>
                  
                  <button 
                     onClick={handleConnectFolder}
                     className="w-full bg-white text-black font-semibold text-base md:text-lg py-3.5 md:py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-gray-100 transition-all active:scale-95 shadow-lg"
                  >
                     📂 Mở Thư Mục
                  </button>
                </>
              )}
              
              <input 
                ref={fallbackInputRef}
                type="file" 
                // @ts-ignore
                webkitdirectory="" 
                directory="" 
                className="hidden"
                onChange={handleFallbackChange}
              />
           </div>
           {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
     );
  }

  // Screen 2: Loading
  if (loading) {
    return (
      <div className="flex h-screen w-full bg-ios-black text-white items-center justify-center">
        <div className="flex flex-col items-center animate-pulse">
          <div className="w-12 h-12 border-4 border-ios-surface2 border-t-ios-blue rounded-full animate-spin mb-4"></div>
          <p className="text-ios-gray text-sm font-medium tracking-wide">Đang quét thư viện...</p>
        </div>
      </div>
    );
  }

  // Screen 3: Main App
  return (
    <div className="flex h-screen w-full bg-ios-black text-white font-sans overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
         <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-ios-blue/10 rounded-full blur-[120px] animate-float"></div>
         <div className="absolute top-[40%] right-[0%] w-[40%] h-[40%] bg-purple-900/10 rounded-full blur-[100px] animate-float" style={{animationDelay: '1s'}}></div>
      </div>

      <Sidebar 
        currentView={view} 
        setView={setView} 
        itemCount={sounds.length}
        folderName={folderName}
        onRescan={handleRescan}
        categories={allCategories}
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
        onCreateCategory={handleCreateCategory}
        onDeleteCategory={handleDeleteCategory}
        onDropSoundToCategory={handleDropSoundToCategory}
        onDisconnect={handleDisconnect}
        onMagicScan={handleBatchAutoRename}
        onCancelScan={handleCancelScan}
        isScanning={isBatchProcessing}
        scanProgress={batchProgress}
      />

      <main className="flex-1 flex flex-col h-full overflow-hidden relative z-10 w-full">
        {view === 'LIBRARY' && (
          <header className="px-4 md:px-6 py-3 md:py-4 flex flex-col items-start justify-between sticky top-0 z-20 backdrop-blur-xl bg-ios-black/80 border-b border-white/5 shadow-sm space-y-3">
            <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-center justify-between w-full">
                <div className="flex items-center gap-2 w-full md:w-auto">
                {/* MOBILE ONLY: MAGIC SCAN BUTTON */}
                <div className="md:hidden">
                    <button 
                    onClick={handleBatchAutoRename}
                    // Not disabling when processing, allowing click to cancel
                    className={`
                        w-10 h-10 rounded-xl flex items-center justify-center shadow-lg active:scale-95 transition-all
                        ${isBatchProcessing 
                        ? 'bg-ios-surface2 text-red-400 border border-red-500/30' 
                        : 'bg-gradient-to-br from-indigo-500 to-purple-500 text-white'
                        }
                    `}
                    >
                    {isBatchProcessing ? (
                        <div className="flex flex-col items-center justify-center">
                            <span className="text-[9px] font-bold">{batchProgress}%</span>
                            <span className="text-[9px]">✕</span>
                        </div>
                    ) : (
                        <span>✨</span>
                    )}
                    </button>
                </div>

                <div id="tour-search-bar" className="relative w-full md:w-96 group shrink-0">
                    <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Tìm kiếm (Ctrl+F)..."
                    value={searchQuery}
                    onChange={(e) => {
                        const val = e.target.value;
                        setSearchQuery(val);
                        // FIX: Reset filters if search is cleared
                        if (!val.trim()) {
                            setFilteredIds(null);
                        }
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && runSmartSearch()}
                    className="w-full bg-ios-surface2/80 hover:bg-ios-surface2 transition-colors rounded-xl py-2 pl-9 pr-20 text-[13px] md:text-sm text-white placeholder-ios-gray focus:outline-none focus:ring-2 focus:ring-ios-blue/50"
                    />
                    <svg className="h-4 w-4 absolute left-3 top-2.5 text-ios-gray" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    
                    <div className="absolute right-1.5 top-1.5 flex items-center">
                        {searchQuery && (
                        <button 
                            onClick={() => { setSearchQuery(''); setFilteredIds(null); }} 
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-ios-gray hover:text-white hover:bg-white/10 transition-colors"
                            title="Clear search"
                        >
                           ✕
                        </button>
                        )}
                        <button 
                            onClick={runSmartSearch} 
                            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${searchQuery ? 'text-ios-blue hover:bg-ios-blue/20' : 'text-ios-gray/30'}`}
                            title="AI Search"
                            disabled={!searchQuery}
                        >
                            ✨
                        </button>
                    </div>
                </div>
                </div>

                {/* Categories Scroll */}
                <div className="relative w-full md:w-auto overflow-hidden">
                   <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar pb-1 px-1">
                      <button onClick={() => setActiveCategory('All')} className={`whitespace-nowrap px-3 md:px-4 py-1.5 md:py-2 rounded-full text-xs font-semibold transition-all duration-300 ${activeCategory === 'All' ? 'bg-white text-black shadow-lg shadow-white/10 scale-105' : 'bg-ios-surface2 text-ios-gray hover:bg-white/10 hover:text-white'}`}>Tất cả</button>
                      <button onClick={() => setActiveCategory('Favorites')} className={`whitespace-nowrap px-3 md:px-4 py-1.5 md:py-2 rounded-full text-xs font-semibold transition-all duration-300 flex items-center gap-1.5 ${activeCategory === 'Favorites' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 shadow-lg shadow-yellow-900/20 scale-105' : 'bg-ios-surface2 text-ios-gray hover:bg-white/10 hover:text-white'}`}><span className="text-yellow-400">★</span> <span className="hidden md:inline">Đã lưu</span></button>
                      <div className="w-px h-4 bg-white/10 mx-1 shrink-0"></div>
                      {allCategories.map(category => (
                        <button key={category} onClick={() => setActiveCategory(category)} className={`whitespace-nowrap px-3 md:px-4 py-1.5 md:py-2 rounded-full text-xs font-semibold transition-all duration-300 border border-transparent ${activeCategory === category ? 'bg-ios-blue text-white shadow-lg shadow-blue-900/40 scale-105' : 'bg-ios-surface2 text-ios-gray hover:bg-white/10 hover:text-white'}`}>{category}</button>
                      ))}
                   </div>
                </div>
            </div>

            {/* Related Tags (Suggestions) */}
            {relatedTags.length > 0 && (
                <div className="w-full flex items-center gap-2 overflow-x-auto no-scrollbar pt-1 animate-[fadeIn_0.3s_ease-out]">
                    <span className="text-xs text-ios-gray font-medium whitespace-nowrap">Gợi ý:</span>
                    {relatedTags.map((tag, idx) => (
                        <button 
                            key={idx}
                            onClick={() => addTagToSearch(tag)}
                            className="text-[11px] bg-white/5 hover:bg-ios-blue/20 hover:text-ios-blue border border-white/10 rounded-md px-2 py-0.5 transition-colors whitespace-nowrap"
                        >
                            + {tag}
                        </button>
                    ))}
                </div>
            )}
          </header>
        )}

        {/* Added padding-bottom to account for mobile tab bar */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth pb-24 md:pb-6">
          {view === 'LIBRARY' && (
            <SoundList 
               sounds={displayedSounds} 
               onToggleFavorite={handleToggleFavorite} 
               onUpdateSound={handleUpdateSound} 
               onShowToast={showToast}
            />
          )}
          {view === 'EXTRACTOR' && <Extractor onExtract={handleAddSound} onShowToast={showToast} />}
          {view === 'WEB_SEARCH' && <WebSearch />}
          {view === 'RECOMMENDATIONS' && (
            <Recommendations library={sounds} favorites={favorites} searchHistory={searchHistory} onToggleFavorite={handleToggleFavorite} onUpdateSound={handleUpdateSound} />
          )}
        </div>
      </main>

      {/* Global Modals */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <SupportWidget />
      {confirmDialog && (
        <ConfirmModal 
          title={confirmDialog.title} 
          message={confirmDialog.message} 
          onConfirm={confirmDialog.onConfirm} 
          onCancel={() => setConfirmDialog(null)} 
        />
      )}
      <Tour isOpen={showTour} onClose={() => setShowTour(false)} onComplete={finishTour} />
    </div>
  );
};

export default App;
