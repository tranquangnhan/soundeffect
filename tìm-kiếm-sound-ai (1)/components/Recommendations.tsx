
import React, { useEffect, useState } from 'react';
import { SoundEffect } from '../types';
import { getRecommendations } from '../services/geminiService';
import SoundList from './SoundList';

interface RecommendationsProps {
  library: SoundEffect[];
  searchHistory: string[];
  favorites: SoundEffect[];
  onToggleFavorite: (id: string) => void;
  onUpdateSound: (updated: SoundEffect) => void;
}

const Recommendations: React.FC<RecommendationsProps> = ({ 
  library, 
  searchHistory, 
  favorites,
  onToggleFavorite,
  onUpdateSound
}) => {
  const [recommendedItems, setRecommendedItems] = useState<{id: string, reason: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    if (!hasFetched && library.length > 0) {
      fetchRecommendations();
    }
  }, [library.length]);

  const fetchRecommendations = async () => {
    setLoading(true);
    const results = await getRecommendations(searchHistory, favorites, library);
    setRecommendedItems(results);
    setLoading(false);
    setHasFetched(true);
  };

  const displayedSounds = recommendedItems
    .map(item => library.find(s => s.id === item.id))
    .filter((s): s is SoundEffect => s !== undefined);

  return (
    <div className="h-full flex flex-col px-2 py-4">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent">
            For You
          </h2>
          <p className="text-ios-gray text-sm mt-1 font-medium">
            Curated by AI based on your workflow.
          </p>
        </div>
        <button 
          onClick={fetchRecommendations}
          disabled={loading}
          className="bg-ios-surface2 hover:bg-white hover:text-black text-white px-4 py-2 rounded-full text-sm font-semibold transition-all shadow-lg active:scale-95 flex items-center gap-2"
        >
          {loading ? 'Thinking...' : 'Refresh'}
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-ios-gray space-y-4">
           <div className="w-12 h-12 border-4 border-ios-surface2 border-t-ios-blue rounded-full animate-spin"></div>
        </div>
      ) : displayedSounds.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
          {displayedSounds.map(sound => {
            const reason = recommendedItems.find(r => r.id === sound.id)?.reason;
            // Manual Card Render to include the Reason Badge with new styling
            return (
              <div key={sound.id} className="relative group">
                <div className="absolute -top-3 left-4 z-10">
                   <div className="bg-ios-blue/90 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg border border-white/10">
                     {reason}
                   </div>
                </div>
                
                <div className="bg-ios-surface hover:bg-ios-surface2 transition-all duration-300 rounded-2xl p-5 shadow-lg h-full flex flex-col border border-transparent hover:border-white/10 hover:-translate-y-1">
                   <div className="flex justify-between items-start mb-4 mt-2">
                      <div className="overflow-hidden">
                        <h3 className="font-semibold text-white truncate w-40 text-[15px]">{sound.name}</h3>
                        <p className="text-xs text-ios-gray font-medium uppercase tracking-wider mt-1">{sound.category}</p>
                      </div>
                      <button
                        onClick={() => onToggleFavorite(sound.id)}
                        className={`text-lg transition-transform active:scale-90 ${sound.isFavorite ? 'text-yellow-400' : 'text-ios-gray hover:text-white'}`}
                      >
                        {sound.isFavorite ? '★' : '☆'}
                      </button>
                   </div>

                   <div className="flex flex-wrap gap-1.5 mb-6">
                      {sound.tags.slice(0, 3).map((tag, idx) => (
                        <span key={idx} className="text-[10px] bg-ios-surface2 text-ios-gray px-2 py-0.5 rounded-full border border-white/5">
                            #{tag}
                        </span>
                      ))}
                   </div>

                   <div className="mt-auto">
                      <audio controls src={sound.url} className="w-full h-8 opacity-60 hover:opacity-100 transition-opacity rounded-md" />
                   </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-24 text-ios-gray glass rounded-3xl border-2 border-dashed border-white/5">
          <p className="text-lg font-medium">No recommendations yet.</p>
          <p className="text-sm mt-2 opacity-70">Interact with the app to get personalized picks.</p>
        </div>
      )}
    </div>
  );
};

export default Recommendations;
