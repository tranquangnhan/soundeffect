import React, { useState } from 'react';
import { findSoundsOnline } from '../services/geminiService';
import { WebSearchResult } from '../types';

const WebSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WebSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    const data = await findSoundsOnline(query);
    setResults(data);
    setLoading(false);
  };

  return (
    <div className="p-6 h-full flex flex-col" id="tour-web-search">
       <h2 className="text-2xl font-bold mb-4">Web Search</h2>
       <form onSubmit={handleSearch} className="flex gap-2 mb-6">
         <input
           type="text"
           value={query}
           onChange={(e) => setQuery(e.target.value)}
           placeholder="Search for 'explosion sound effect'..."
           className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 focus:outline-none focus:border-primary-500"
         />
         <button 
          type="submit"
          className="bg-primary-600 hover:bg-primary-500 px-6 py-3 rounded-lg font-medium transition-colors"
          disabled={loading}
         >
           {loading ? 'Searching...' : 'Search'}
         </button>
       </form>

       <div className="flex-1 overflow-y-auto">
          {loading && (
             <div className="text-center py-10 text-zinc-500">
               <p>Searching the web...</p>
             </div>
          )}

          {!loading && results.length === 0 && query && (
             <div className="text-center py-10 text-zinc-600">
               No results found. Try a different term.
             </div>
          )}

          <div className="space-y-3">
             {results.map((res, idx) => (
               <div key={idx} className="bg-zinc-800 p-4 rounded-lg border border-zinc-700 hover:border-zinc-500">
                 <h3 className="font-bold text-zinc-200">{res.title}</h3>
                 <a 
                   href={res.link} 
                   target="_blank" 
                   rel="noopener noreferrer"
                   className="text-primary-400 text-sm hover:underline break-all"
                 >
                   {res.link}
                 </a>
                 <div className="mt-2 text-xs text-zinc-500">
                   {res.snippet}
                 </div>
               </div>
             ))}
          </div>
       </div>
    </div>
  );
};

export default WebSearch;