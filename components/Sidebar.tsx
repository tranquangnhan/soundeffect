import React, { useState } from 'react';
import { ViewMode } from '../types';

interface SidebarProps {
  currentView: ViewMode;
  setView: (view: ViewMode) => void;
  itemCount: number;
  folderName?: string | null;
  onRescan?: () => void;
  categories: string[];
  activeCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  onCreateCategory: (name: string) => void;
  onDropSoundToCategory: (soundId: string, category: string) => void;
  onDisconnect?: () => void;
  onMagicScan?: () => void;
  isScanning?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ 
    currentView, setView, itemCount, folderName, onRescan,
    categories, activeCategory, onSelectCategory, onCreateCategory, onDropSoundToCategory,
    onDisconnect, onMagicScan, isScanning
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [dragOverCat, setDragOverCat] = useState<string | null>(null);

  const menuItems: { id: ViewMode; label: string; icon: string }[] = [
    { id: 'LIBRARY', label: 'Library', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
    { id: 'RECOMMENDATIONS', label: 'For You', icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z' },
    { id: 'UPLOAD', label: 'Upload', icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12' },
    { id: 'EXTRACTOR', label: 'Extract', icon: 'M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z' },
    { id: 'WEB_SEARCH', label: 'Web', icon: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9' },
  ];

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCatName.trim()) {
        onCreateCategory(newCatName.trim());
        setNewCatName('');
        setIsCreating(false);
    }
  };

  const handleDragOver = (e: React.DragEvent, cat: string) => {
    e.preventDefault();
    setDragOverCat(cat);
  };

  const handleDrop = (e: React.DragEvent, cat: string) => {
    e.preventDefault();
    setDragOverCat(null);
    const soundId = e.dataTransfer.getData('soundId');
    if (soundId) {
        onDropSoundToCategory(soundId, cat);
    }
  };

  return (
    <>
      {/* --- DESKTOP SIDEBAR --- */}
      <div id="tour-sidebar" className="hidden md:flex w-64 glass flex-col h-full shrink-0 z-20 transition-all duration-300 overflow-hidden border-r border-white/5">
        <div className="p-6 flex items-center justify-start space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-ios-blue to-purple-600 shadow-lg shadow-blue-900/50 shrink-0"></div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              SFX Studio
            </h1>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar">
            <nav className="px-3 space-y-1.5 mt-4">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setView(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-all duration-200 group ${
                    currentView === item.id
                      ? 'bg-ios-blue text-white shadow-lg shadow-blue-900/30'
                      : 'text-ios-gray hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className={`transition-transform duration-200 ${currentView === item.id ? 'scale-110' : 'group-hover:scale-110'}`}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                    </svg>
                  </span>
                  <span className="font-medium text-[15px]">{item.label}</span>
                  {item.id === 'LIBRARY' && activeCategory === null && (
                    <span className={`flex ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${currentView === item.id ? 'bg-white/20 text-white' : 'bg-ios-surface2 text-ios-gray'}`}>
                      {itemCount}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            {/* MAGIC SCAN BUTTON (DESKTOP) */}
            {onMagicScan && (
              <div className="px-3 mt-6 mb-2">
                <button 
                  id="tour-magic-scan-desktop"
                  onClick={onMagicScan}
                  disabled={isScanning}
                  className={`
                    w-full relative overflow-hidden px-4 py-3 rounded-xl font-bold text-sm transition-all duration-300 shadow-lg active:scale-95 flex items-center justify-center gap-2
                    ${isScanning 
                      ? 'bg-ios-surface2 text-ios-gray cursor-not-allowed' 
                      : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white hover:shadow-purple-500/40 hover:scale-[1.02]'
                    }
                  `}
                >
                   {isScanning ? (
                     <>
                       <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                       <span>Scanning...</span>
                     </>
                   ) : (
                     <>
                       <span className="text-lg">✨</span>
                       <span>Magic Scan</span>
                     </>
                   )}
                </button>
                <p className="text-[10px] text-ios-gray text-center mt-1.5 opacity-60">
                   Tự động phân loại bằng AI
                </p>
              </div>
            )}

            {/* CATEGORIES SECTION (Desktop Only) */}
            <div id="tour-categories" className="px-3 mt-6">
               <div className="flex items-center justify-between px-3 mb-2">
                  <span className="text-xs font-bold text-ios-gray uppercase tracking-wider">Categories</span>
                  <button 
                    onClick={() => setIsCreating(true)}
                    className="text-ios-gray hover:text-white hover:bg-white/10 p-1 rounded transition-colors"
                    title="Add Category"
                  >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  </button>
               </div>
               
               {isCreating && (
                   <form onSubmit={handleCreateSubmit} className="px-2 mb-2">
                       <input 
                         autoFocus
                         type="text" 
                         placeholder="Name..."
                         className="w-full bg-ios-surface2 text-white text-xs px-2 py-1.5 rounded border border-ios-blue focus:outline-none"
                         value={newCatName}
                         onChange={e => setNewCatName(e.target.value)}
                         onBlur={() => !newCatName && setIsCreating(false)}
                       />
                   </form>
               )}

               <div className="space-y-0.5 pb-20">
                  <button
                      onClick={() => { setView('LIBRARY'); onSelectCategory('All'); }}
                      className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                          activeCategory === 'All' && currentView === 'LIBRARY' ? 'bg-white/10 text-white' : 'text-ios-gray hover:text-white'
                      }`}
                  >
                      <span className="text-lg">💿</span>
                      <span>All Sounds</span>
                  </button>

                  {categories.map(cat => (
                      <button
                          key={cat}
                          onClick={() => { setView('LIBRARY'); onSelectCategory(cat); }}
                          className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                              activeCategory === cat ? 'bg-white/10 text-white' : 'text-ios-gray hover:text-white'
                          } ${dragOverCat === cat ? 'bg-ios-blue/20 ring-1 ring-ios-blue scale-105' : ''}`}
                          onDragOver={(e) => handleDragOver(e, cat)}
                          onDragLeave={() => setDragOverCat(null)}
                          onDrop={(e) => handleDrop(e, cat)}
                      >
                          <span className={dragOverCat === cat ? 'text-ios-blue transition-colors' : 'text-zinc-500'}>🏷️</span>
                          <span className="truncate">{cat}</span>
                      </button>
                  ))}
               </div>
            </div>
        </div>

        <div className="p-4 border-t border-white/5 mt-auto bg-black/20">
          {folderName ? (
            <div className="bg-ios-surface2/50 rounded-xl p-3 border border-white/5">
               <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2 overflow-hidden">
                      <span className="text-lg">📁</span>
                      <div className="overflow-hidden">
                         <p className="text-[10px] text-ios-gray uppercase font-bold tracking-wider">Source</p>
                         <p className="text-xs text-white truncate font-medium max-w-[80px]" title={folderName}>{folderName}</p>
                      </div>
                  </div>
                  {onDisconnect && (
                      <button 
                          onClick={onDisconnect}
                          className="text-ios-gray hover:text-red-400 p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                          title="Change Folder"
                      >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                      </button>
                  )}
               </div>
               <button 
                 onClick={onRescan}
                 className="w-full bg-white/5 hover:bg-white/10 text-xs text-ios-gray hover:text-white py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5"
               >
                 <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                 Sync
               </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* --- MOBILE BOTTOM BAR --- */}
      <div className="md:hidden fixed bottom-0 left-0 w-full glass z-50 border-t border-white/10 pb-safe-area">
        <nav className="flex items-center justify-around p-2 pb-5"> {/* Added extra padding bottom for home indicator */}
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`flex flex-col items-center justify-center space-y-1 p-2 rounded-xl transition-all ${
                currentView === item.id
                  ? 'text-ios-blue'
                  : 'text-ios-gray hover:text-white'
              }`}
            >
              <span className={`transition-transform duration-200 ${currentView === item.id ? 'scale-110' : ''}`}>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
              </span>
              <span className="text-[10px] font-medium">{item.label.replace('LIBRARY', 'Lib')}</span>
            </button>
          ))}
          {/* Mobile Menu for Extra Actions (Rescan/Folder) could go here or in a modal */}
        </nav>
      </div>
    </>
  );
};

export default Sidebar;