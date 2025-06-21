import React, { useState } from 'react';
import { Search, X, Filter, Sparkles } from 'lucide-react';
import AdvancedSearchModal from './AdvancedSearchModal';
import { SearchQuery } from '../hooks/useSearch';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onAdvancedSearch?: (query: SearchQuery) => void;
  placeholder?: string;
  showAdvancedSearch?: boolean;
  isSearching?: boolean;
  advancedTags?: string[];
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  onAdvancedSearch,
  placeholder = 'テキストやタグで検索...',
  showAdvancedSearch = true,
  isSearching = false,
  advancedTags,
}) => {
  const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);

  const handleAdvancedSearch = (query: SearchQuery) => {
    onAdvancedSearch?.(query);
    setIsAdvancedSearchOpen(false);
  };

  return (
    <>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="block w-full pl-10 pr-20 py-3 border border-gray-200 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
          placeholder={placeholder}
          disabled={isSearching}
        />
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-1">
          {value && (
            <button
              onClick={() => onChange('')}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              disabled={isSearching}
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {showAdvancedSearch && onAdvancedSearch && (
            <button
              onClick={() => setIsAdvancedSearchOpen(true)}
              className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
              title="高度な検索"
              disabled={isSearching}
            >
              <Filter className="h-4 w-4" />
            </button>
          )}
        </div>
        
      </div>

      {/* 高度な検索モーダル */}
      {showAdvancedSearch && onAdvancedSearch && (
        <AdvancedSearchModal
          isOpen={isAdvancedSearchOpen}
          onClose={() => setIsAdvancedSearchOpen(false)}
          onSearch={handleAdvancedSearch}
          isSearching={isSearching}
          availableTags={advancedTags}
        />
      )}
    </>
  );
};