
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import SoundList from './components/SoundList';
import UploadModal from './components/UploadModal';
import Extractor from './components/Extractor';
import WebSearch from './components/WebSearch';
import Recommendations from './components/Recommendations';
import { SoundEffect, ViewMode, CATEGORIES } from './types';
import { smartFilterLibrary } from './services/geminiService';
import { 
  openDirectory, 
  scanLibrary, 
  saveMetadata, 
  saveSoundToFolder, 
  getRootHandle 
} from './services/storage';

const App: React.FC = () => {
  // App State
  const [view, setView] = useState<ViewMode>('LIBRARY');
  const [sounds, setSounds] = useState<SoundEffect[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [isSmartSearching, setIsSmartSearching] = useState(false);
  const [filteredIds, setFilteredIds] = useState<string[] | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  
  const [folderName, setFolderName] = useState<string | null>(null);

  // Load Search History
  useEffect(() => {
    const savedHistory = localStorage.getItem('sonicflow_history');
    if (savedHistory) setSearchHistory(JSON.parse(savedHistory));
  }, []);

  useEffect(() => {
    localStorage.setItem('sonicflow_history', JSON.stringify(searchHistory));
  }, [searchHistory]);

  // Handlers
  const handleConnectFolder = async () => {
    try {
      const handle = await openDirectory();
      setFolderName(handle.name);
      setLoading(true);
      const lib = await scanLibrary();
      setSounds(lib);
      setLoading(false);
    } catch (error) {
      console.error("Failed to open folder", error);
      // alert("Could not open folder. Feature requires Chrome/Edge desktop.");
    }
  };

  const handleRescan = async () => {
    if (!getRootHandle()) return;
    setLoading(true);
    const lib = await scanLibrary();
    setSounds(lib);
    setLoading(false);
  };

  const handleAddSound = async (sound: SoundEffect, file: Blob) => {
    try {
      // 1. Save file to disk
      const savedSound = await saveSoundToFolder(sound, file);
      
      // 2. Update state
      const newLib = [savedSound, ...sounds];
      setSounds(newLib);
      
      // 3. Update metadata json
      await saveMetadata(newLib);
      
      setView('LIBRARY');
    } catch (e) {
      console.error("Save failed", e);
      alert("Failed to save file to folder.");
    }
  };

  const handleToggleFavorite = async (id: string) => {
    const newLib = sounds.map(s => s.id === id ? { ...s, isFavorite: !s.isFavorite } : s);
    setSounds(newLib);
    await saveMetadata(newLib);
  };

  const handleUpdateSound = async (updated: SoundEffect) => {
    const newLib = sounds.map(s => s.id === updated.id ? updated : s);
    setSounds(newLib);
    await saveMetadata(newLib);
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

  const displayedSounds = sounds.filter(sound => {
    if (activeCategory === 'Favorites' && !sound.isFavorite) return false;
    if (activeCategory !== 'All' && activeCategory !== 'Favorites' && sound.category !== activeCategory) return false;
    
    if (filteredIds !== null) return filteredIds.includes(sound.id);
    if (searchQuery) return sound.name.toLowerCase().includes(searchQuery.toLowerCase());
    return true;
  });

  const favorites = sounds.filter(s => s.isFavorite);

  // --- RENDERING ---

  // Screen 1: Connect Folder
  if (!folderName) {
     return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
           {/* Background Blobs */}
           <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[100px] animate-float"></div>
           <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[100px] animate-float" style={{animationDelay: '2s'}}></div>

           <div className="glass max-w-md w-full p-10 rounded-[40px] border border-white/5 shadow-2xl z-10 text-center">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-ios-blue to-purple-600 shadow-xl shadow-blue-500/20 mb-6 flex items-center justify-center text-4xl">
                 📁
              </div>
              <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">SonicFlow AI</h1>
              <p className="text-ios-gray mb-8 leading-relaxed text-sm">
                 Choose a folder on your computer to store your sound library.<br/>
                 Move this folder to back up or transfer your sounds.
              </p>
              
              <button 
                 onClick={handleConnectFolder}
                 className="w-full bg-white text-black font-semibold text-lg py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-gray-100 transition-all active:scale-95 shadow-lg"
              >
                 Open Local Folder
              </button>
              <p className="mt-4 text-xs text-zinc-600">
                Your data stays on your device.
              </p>
           </div>
        </div>
     );
  }

  // Screen 2: Loading
  if (loading) {
    return (
      <div className="flex h-screen w-full bg-ios-black text-white items-center justify-center">
        <div className="flex flex-col items-center animate-pulse">
          <div className="w-12 h-12 border-4 border-ios-surface2 border-t-ios-blue rounded-full animate-spin mb-4"></div>
          <p className="text-ios-gray text-sm font-medium tracking-wide">Scanning Folder...</p>
        </div>
      </div>
    );
  }

  // Screen 3: Main App
  return (
    <div className="flex h-screen w-full bg-ios-black text-white font-sans overflow-hidden">
      {/* Background Gradient Blob */}
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
      />

      <main className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
        {/* iOS-style Header */}
        {view === 'LIBRARY' && (
          <header className="px-6 py-4 flex flex-col md:flex-row gap-4 items-center justify-between sticky top-0 z-20 backdrop-blur-xl bg-ios-black/80 border-b border-white/5 shadow-sm">
            <div className="relative w-full md:w-72 group shrink-0">
              <input
                type="text"
                placeholder="Search sounds..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runSmartSearch()}
                className="w-full bg-ios-surface2/80 hover:bg-ios-surface2 transition-colors rounded-xl py-2.5 pl-10 pr-10 text-sm text-white placeholder-ios-gray focus:outline-none focus:ring-2 focus:ring-ios-blue/50"
              />
              <svg className="h-4 w-4 absolute left-3.5 top-3 text-ios-gray" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button onClick={runSmartSearch} className="absolute right-2 top-1.5 p-1 rounded-lg text-ios-blue hover:bg-white/10">✨</button>
              )}
            </div>

            <div className="relative w-full overflow-hidden">
               <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-ios-black/90 to-transparent z-10 pointer-events-none md:hidden"></div>
               <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-ios-black/90 to-transparent z-10 pointer-events-none"></div>

               <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar pb-1 px-1">
                  <button
                    onClick={() => setActiveCategory('All')}
                    className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold transition-all duration-300 ${activeCategory === 'All' ? 'bg-white text-black shadow-lg shadow-white/10 scale-105' : 'bg-ios-surface2 text-ios-gray hover:bg-white/10 hover:text-white'}`}
                  >All</button>

                  <button
                    onClick={() => setActiveCategory('Favorites')}
                    className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold transition-all duration-300 flex items-center gap-1.5 ${activeCategory === 'Favorites' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 shadow-lg shadow-yellow-900/20 scale-105' : 'bg-ios-surface2 text-ios-gray hover:bg-white/10 hover:text-white'}`}
                  >
                    <span className="text-yellow-400">★</span> Favorites
                  </button>

                  <div className="w-px h-4 bg-white/10 mx-1 shrink-0"></div>

                  {CATEGORIES.map(category => (
                    <button
                      key={category}
                      onClick={() => setActiveCategory(category)}
                      className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold transition-all duration-300 border border-transparent ${activeCategory === category ? 'bg-ios-blue text-white shadow-lg shadow-blue-900/40 scale-105' : 'bg-ios-surface2 text-ios-gray hover:bg-white/10 hover:text-white'}`}
                    >{category}</button>
                  ))}
               </div>
            </div>
          </header>
        )}

        <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
          {view === 'LIBRARY' && (
            <>
              {isSmartSearching && (
                <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-ios-blue/20 to-purple-500/20 border border-ios-blue/30 flex items-center space-x-3">
                  <div className="animate-spin h-4 w-4 border-2 border-ios-blue border-t-transparent rounded-full"></div>
                  <span className="text-sm font-medium text-ios-blueHighlight">AI is analyzing library for: "{searchQuery}"...</span>
                </div>
              )}
              <SoundList sounds={displayedSounds} onToggleFavorite={handleToggleFavorite} onUpdateSound={handleUpdateSound} />
            </>
          )}
          {view === 'UPLOAD' && <UploadModal onUpload={handleAddSound} />}
          {view === 'EXTRACTOR' && <Extractor onExtract={handleAddSound} />}
          {view === 'WEB_SEARCH' && <WebSearch />}
          {view === 'RECOMMENDATIONS' && (
            <Recommendations library={sounds} favorites={favorites} searchHistory={searchHistory} onToggleFavorite={handleToggleFavorite} onUpdateSound={handleUpdateSound} />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
