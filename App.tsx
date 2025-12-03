
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import SoundList from './components/SoundList';
import UploadModal from './components/UploadModal';
import Extractor from './components/Extractor';
import WebSearch from './components/WebSearch';
import Recommendations from './components/Recommendations';
import { SoundEffect, ViewMode, CATEGORIES, GoogleConfig, UserInfo } from './types';
import { smartFilterLibrary } from './services/geminiService';
import { 
  initGoogleServices, 
  handleLogin, 
  handleLogout, 
  loadLibraryFromDrive, 
  saveSoundToDrive, 
  updateSoundInDrive 
} from './services/storage';

const App: React.FC = () => {
  // Auth & Config State
  const [config, setConfig] = useState<GoogleConfig>({ apiKey: '', clientId: '' });
  const [isConfigured, setIsConfigured] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // App State
  const [view, setView] = useState<ViewMode>('LIBRARY');
  const [sounds, setSounds] = useState<SoundEffect[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [isSmartSearching, setIsSmartSearching] = useState(false);
  const [filteredIds, setFilteredIds] = useState<string[] | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // 1. Check for stored config on mount
  useEffect(() => {
    const storedConfig = localStorage.getItem('sonicflow_gconfig');
    if (storedConfig) {
      const parsed = JSON.parse(storedConfig);
      setConfig(parsed);
      setIsConfigured(true);
      // Initialize GAPI
      initGoogleServices(parsed, () => setIsInitialized(true));
    }
  }, []);

  // 2. Load History
  useEffect(() => {
    const savedHistory = localStorage.getItem('sonicflow_history');
    if (savedHistory) setSearchHistory(JSON.parse(savedHistory));
  }, []);

  useEffect(() => {
    localStorage.setItem('sonicflow_history', JSON.stringify(searchHistory));
  }, [searchHistory]);

  // 3. Handlers for Auth
  const saveConfig = (newConfig: GoogleConfig) => {
    localStorage.setItem('sonicflow_gconfig', JSON.stringify(newConfig));
    setConfig(newConfig);
    setIsConfigured(true);
    window.location.reload(); // Reload to init scripts fresh
  };

  const onLogin = async () => {
    try {
      const userInfo = await handleLogin();
      setUser(userInfo);
      setLoading(true);
      const lib = await loadLibraryFromDrive();
      setSounds(lib);
      setLoading(false);
    } catch (error) {
      console.error("Login failed", error);
      alert("Login failed or popup closed.");
    }
  };

  const onLogout = () => {
    handleLogout();
    setUser(null);
    setSounds([]);
    setView('LIBRARY');
  };

  // 4. Data Handlers
  const handleAddSound = async (sound: SoundEffect, file: Blob) => {
    // Optimistic Update
    setSounds(prev => [sound, ...prev]);
    setView('LIBRARY');
    
    // Upload to Drive
    try {
      const savedSound = await saveSoundToDrive(sound, file);
      // Update local state with the real Drive ID
      setSounds(prev => prev.map(s => s.id === sound.id ? savedSound : s));
    } catch (e) {
      console.error("Upload to Drive failed", e);
      alert("Failed to sync to Drive. Please try again.");
    }
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
      await updateSoundInDrive(updatedSound);
    }
  };

  const handleUpdateSound = async (updated: SoundEffect) => {
    setSounds(prev => prev.map(s => s.id === updated.id ? updated : s));
    await updateSoundInDrive(updated);
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

  // Screen 1: Config Form (First Run)
  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
         <div className="glass max-w-md w-full p-8 rounded-3xl border border-white/10">
            <div className="flex justify-center mb-6">
               <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-ios-blue to-purple-600 shadow-xl shadow-blue-900/40"></div>
            </div>
            <h1 className="text-2xl font-bold text-center text-white mb-2">Setup SonicFlow</h1>
            <p className="text-center text-ios-gray text-sm mb-8">
               To connect to your Google Drive, please provide your Google Cloud API credentials.
            </p>
            <form onSubmit={(e) => {
               e.preventDefault();
               const fd = new FormData(e.currentTarget);
               saveConfig({
                 apiKey: fd.get('apiKey') as string,
                 clientId: fd.get('clientId') as string
               });
            }} className="space-y-4">
               <div>
                  <label className="block text-xs font-medium text-ios-gray mb-1 uppercase tracking-wider">API Key</label>
                  <input name="apiKey" required className="w-full bg-ios-surface2 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-ios-blue" placeholder="AIzaSy..." />
               </div>
               <div>
                  <label className="block text-xs font-medium text-ios-gray mb-1 uppercase tracking-wider">Client ID</label>
                  <input name="clientId" required className="w-full bg-ios-surface2 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-ios-blue" placeholder="123...apps.googleusercontent.com" />
               </div>
               <button type="submit" className="w-full bg-ios-blue hover:bg-ios-blueHighlight text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-900/20 active:scale-95 mt-4">
                  Connect
               </button>
            </form>
         </div>
      </div>
    );
  }

  // Screen 2: Login (Authenticated but not logged in)
  if (isInitialized && !user) {
     return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
           {/* Background Blobs */}
           <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[100px] animate-float"></div>
           <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[100px] animate-float" style={{animationDelay: '2s'}}></div>

           <div className="glass max-w-sm w-full p-10 rounded-[40px] border border-white/5 shadow-2xl z-10 text-center">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-ios-blue to-purple-600 shadow-xl shadow-blue-500/20 mb-6 flex items-center justify-center text-3xl">
                 🌊
              </div>
              <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">SonicFlow AI</h1>
              <p className="text-ios-gray mb-10 leading-relaxed">
                 Your intelligent sound library.<br/>Synced with Google Drive.
              </p>
              
              <button 
                 onClick={onLogin}
                 className="w-full bg-white text-black font-semibold text-lg py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-gray-100 transition-all active:scale-95 shadow-lg"
              >
                 <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                 </svg>
                 Sign in with Google
              </button>
           </div>
        </div>
     );
  }

  // Screen 3: Loading
  if (!isInitialized || loading) {
    return (
      <div className="flex h-screen w-full bg-ios-black text-white items-center justify-center">
        <div className="flex flex-col items-center animate-pulse">
          <div className="w-12 h-12 border-4 border-ios-surface2 border-t-ios-blue rounded-full animate-spin mb-4"></div>
          <p className="text-ios-gray text-sm font-medium tracking-wide">Syncing Library...</p>
        </div>
      </div>
    );
  }

  // Screen 4: Main App
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
        user={user}
        onLogout={onLogout}
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
