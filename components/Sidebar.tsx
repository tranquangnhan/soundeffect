
import React from 'react';
import { ViewMode } from '../types';

interface SidebarProps {
  currentView: ViewMode;
  setView: (view: ViewMode) => void;
  itemCount: number;
  folderName?: string | null;
  onRescan?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, itemCount, folderName, onRescan }) => {
  const menuItems: { id: ViewMode; label: string; icon: string }[] = [
    { id: 'LIBRARY', label: 'Library', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
    { id: 'RECOMMENDATIONS', label: 'For You', icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z' },
    { id: 'UPLOAD', label: 'Upload', icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12' },
    { id: 'EXTRACTOR', label: 'Extract', icon: 'M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z' },
    { id: 'WEB_SEARCH', label: 'Web', icon: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9' },
  ];

  return (
    <div className="w-20 md:w-64 glass flex flex-col h-full shrink-0 z-20 transition-all duration-300">
      <div className="p-6 flex items-center justify-center md:justify-start space-x-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-ios-blue to-purple-600 shadow-lg shadow-blue-900/50 shrink-0"></div>
        <div className="hidden md:block">
          <h1 className="text-xl font-bold tracking-tight text-white">
            SonicFlow
          </h1>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1.5 mt-4">
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
            <span className="hidden md:block font-medium text-[15px]">{item.label}</span>
            {item.id === 'LIBRARY' && (
              <span className={`hidden md:flex ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${currentView === item.id ? 'bg-white/20 text-white' : 'bg-ios-surface2 text-ios-gray'}`}>
                {itemCount}
              </span>
            )}
            {item.id === 'RECOMMENDATIONS' && (
              <span className="hidden md:block ml-auto w-2 h-2 bg-pink-500 rounded-full animate-pulse"></span>
            )}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-white/5 hidden md:block">
        {folderName ? (
          <div className="bg-ios-surface2/50 rounded-xl p-3 border border-white/5">
             <div className="flex items-center space-x-2 mb-2">
                <span className="text-lg">📁</span>
                <div className="overflow-hidden">
                   <p className="text-[10px] text-ios-gray uppercase font-bold tracking-wider">Current Location</p>
                   <p className="text-xs text-white truncate font-medium" title={folderName}>{folderName}</p>
                </div>
             </div>
             <button 
               onClick={onRescan}
               className="w-full bg-white/5 hover:bg-white/10 text-xs text-ios-gray hover:text-white py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5"
             >
               <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
               Sync Metadata
             </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Sidebar;
