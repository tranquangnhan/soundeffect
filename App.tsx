
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import SoundList from './components/SoundList';
import UploadModal from './components/UploadModal';
import Extractor from './components/Extractor';
import WebSearch from './components/WebSearch';
import Recommendations from './components/Recommendations';
import { SoundEffect, ViewMode, CATEGORIES } from './types';
import { smartFilterLibrary } from './services/geminiService';
import { loadLibraryFromDB, saveSoundToDB, updateSoundInDB } from './services/storage';

const App: React.FC = () => {
  const [view, setView] = useState<ViewMode>('LIBRARY');
  const [sounds, setSounds] = useState<SoundEffect[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [isSmartSearching, setIsSmartSearching] = useState(false);
  const [filteredIds, setFilteredIds] = useState<string[] | null>(null);
  
  // Tracking User Behavior
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // Load History from LocalStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('sonicflow_history');
    if (savedHistory) {
      try {
        setSearchHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to load history");
      }
    }
  }, []);

  // Save History to LocalStorage
  useEffect(() => {
    localStorage.setItem('sonicflow_history', JSON.stringify(searchHistory));
  }, [searchHistory]);

  // Load Library from IndexedDB
  useEffect(() => {
    const loadSounds = async () => {
      try {
        const library = await loadLibraryFromDB();
        setSounds(library);
      } catch (error) {
        console.error("Failed to load library from DB", error);
      } finally {
        setLoading(false);
      }
    };
    loadSounds();
  }, []);

  const handleAddSound = async (sound: SoundEffect, file: Blob) => {
    setSounds(prev => [sound, ...prev]);
    await saveSoundToDB(sound, file);
    setView('LIBRARY');
  };

  const handleToggleFavorite = async (id: string) => {
    const updatedSounds = sounds.map(s => {
      if (s.id === id) {
        return { ...s, isFavorite: !s.isFavorite };
      }
      return s;
    });
    setSounds(updatedSounds);
    const updatedSound = updatedSounds.find(s => s.id === id);
    if (updatedSound) {
      await updateSoundInDB(updatedSound);
    }
  };

  const handleUpdateSound = async (updated: SoundEffect) => {
    setSounds(prev => prev.map(s => s.id === updated.id ? updated : s));
    await updateSoundInDB(updated);
  };

  const runSmartSearch = async () => {
    if (!searchQuery) {
      setFilteredIds(null);
      return;
    }
    setSearchHistory(prev => {
      const newHistory = [searchQuery, ...prev.filter(s => s !== searchQuery)].slice(0, 20);
      return newHistory;
    });

    setIsSmartSearching(true);
    const ids = await smartFilterLibrary(searchQuery, sounds);
    setFilteredIds(ids);
    setIsSmartSearching(false);
  };

  const displayedSounds = sounds.filter(sound => {
    // 1. Filter by Category / Favorites
    if (activeCategory === 'Favorites') {
      if (!sound.isFavorite) return false;
    } else if (activeCategory !== 'All') {
      if (sound.category !== activeCategory) return false;
    }

    // 2. Filter by Search / Smart Search
    if (filteredIds !== null) {
      return filteredIds.includes(sound.id);
    } else if (searchQuery) {
      return sound.name.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  const favorites = sounds.filter(s => s.isFavorite);

  if (loading) {
    return (
      <div className="flex h-screen w-full bg-ios-black text-white items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 border-t-2 border-ios-blue rounded-full animate-spin mb-4"></div>
          <p className="text-ios-gray text-sm font-medium tracking-wide">Initializing Studio...</p>
        </div>
      </div>
    );
  }

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
      />

      <main className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
        {/* iOS-style Header */}
        {view === 'LIBRARY' && (
          <header className="px-6 py-4 flex flex-col md:flex-row gap-4 items-center justify-between sticky top-0 z-20 backdrop-blur-xl bg-ios-black/80 border-b border-white/5 shadow-sm">
            
            {/* Search Bar */}
            <div className="relative w-full md:w-72 group shrink-0">
              <input
                type="text"
                placeholder="Search sounds..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runSmartSearch()}
                className="w-full bg-ios-surface2/80 hover:bg-ios-surface2 transition-colors rounded-xl py-2.5 pl-10 pr-10 text-sm text-white placeholder-ios-gray focus:outline-none focus:ring-2 focus:ring-ios-blue/50"
              />
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-3.5 top-3 text-ios-gray" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              
              {searchQuery && (
                <button 
                  onClick={runSmartSearch}
                  className="absolute right-2 top-1.5 p-1 rounded-lg text-ios-blue hover:bg-white/10"
                >
                  ✨
                </button>
              )}
            </div>

            {/* Improved Categories Slider */}
            <div className="relative w-full overflow-hidden">
               {/* Fade Masks */}
               <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-ios-black/90 to-transparent z-10 pointer-events-none md:hidden"></div>
               <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-ios-black/90 to-transparent z-10 pointer-events-none"></div>

               <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar pb-1 px-1">
                  
                  {/* All Button */}
                  <button
                    onClick={() => setActiveCategory('All')}
                    className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold transition-all duration-300 ${
                      activeCategory === 'All' 
                        ? 'bg-white text-black shadow-lg shadow-white/10 scale-105' 
                        : 'bg-ios-surface2 text-ios-gray hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    All
                  </button>

                  {/* Favorites Button */}
                  <button
                    onClick={() => setActiveCategory('Favorites')}
                    className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold transition-all duration-300 flex items-center gap-1.5 ${
                      activeCategory === 'Favorites' 
                        ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 shadow-lg shadow-yellow-900/20 scale-105' 
                        : 'bg-ios-surface2 text-ios-gray hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20">
                       <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    Favorites
                  </button>

                  {/* Separator */}
                  <div className="w-px h-4 bg-white/10 mx-1 shrink-0"></div>

                  {/* Categories */}
                  {CATEGORIES.map(category => (
                    <button
                      key={category}
                      onClick={() => setActiveCategory(category)}
                      className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold transition-all duration-300 border border-transparent ${
                        activeCategory === category 
                          ? 'bg-ios-blue text-white shadow-lg shadow-blue-900/40 scale-105' 
                          : 'bg-ios-surface2 text-ios-gray hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {category}
                    </button>
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
                  <span className="text-sm font-medium text-ios-blueHighlight">
                    AI is analyzing library for: "{searchQuery}"...
                  </span>
                </div>
              )}
              
              <SoundList 
                sounds={displayedSounds} 
                onToggleFavorite={handleToggleFavorite}
                onUpdateSound={handleUpdateSound}
              />
            </>
          )}

          {view === 'UPLOAD' && <UploadModal onUpload={handleAddSound} />}
          
          {view === 'EXTRACTOR' && <Extractor onExtract={handleAddSound} />}
          
          {view === 'WEB_SEARCH' && <WebSearch />}

          {view === 'RECOMMENDATIONS' && (
            <Recommendations 
              library={sounds} 
              favorites={favorites} 
              searchHistory={searchHistory}
              onToggleFavorite={handleToggleFavorite}
              onUpdateSound={handleUpdateSound}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
