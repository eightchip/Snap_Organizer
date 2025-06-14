import React, { useMemo } from 'react';
import { PostalItem } from '../../types';
import { SearchBar } from '../SearchBar';
import { TagChip } from '../TagChip';
import { ItemCard } from '../ItemCard';
import { Plus, Package } from 'lucide-react';

interface HomeScreenProps {
  items: PostalItem[];
  searchQuery: string;
  selectedTags: string[];
  onSearchChange: (query: string) => void;
  onTagToggle: (tag: string) => void;
  onAddItem: () => void;
  onItemClick: (itemId: string) => void;
}

const AVAILABLE_TAGS = ['仕事', '趣味', '旅行', '郵便物'];

export const HomeScreen: React.FC<HomeScreenProps> = ({
  items,
  searchQuery,
  selectedTags,
  onSearchChange,
  onTagToggle,
  onAddItem,
  onItemClick
}) => {
  const { filteredItems, tagCounts } = useMemo(() => {
    // Calculate tag counts
    const counts: Record<string, number> = {};
    AVAILABLE_TAGS.forEach(tag => {
      counts[tag] = items.filter(item => item.tags.includes(tag)).length;
    });

    // Filter items
    let filtered = items;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.ocrText.toLowerCase().includes(query) ||
        item.memo.toLowerCase().includes(query) ||
        item.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    if (selectedTags.length > 0) {
      filtered = filtered.filter(item =>
        selectedTags.every(tag => item.tags.includes(tag))
      );
    }

    return { filteredItems: filtered, tagCounts: counts };
  }, [items, searchQuery, selectedTags]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900 mb-4">
            Postal Snap Organizer
          </h1>
          <SearchBar
            value={searchQuery}
            onChange={onSearchChange}
            placeholder="テキストやタグで検索..."
          />
        </div>
      </div>

      {/* Tags Filter */}
      <div className="max-w-md mx-auto px-4 py-4">
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_TAGS.map(tag => (
            <TagChip
              key={tag}
              tag={tag}
              count={tagCounts[tag]}
              selected={selectedTags.includes(tag)}
              onClick={() => onTagToggle(tag)}
            />
          ))}
        </div>
      </div>

      {/* Items List */}
      <div className="max-w-md mx-auto px-4 pb-20">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">
              {items.length === 0 ? 'まだアイテムがありません' : '該当するアイテムが見つかりません'}
            </p>
            <p className="text-sm text-gray-400">
              {items.length === 0 ? '写真を撮影してアイテムを追加しましょう' : '検索条件を変更してみてください'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredItems.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                onClick={() => onItemClick(item.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Button */}
      <button
        onClick={onAddItem}
        className="fixed bottom-6 right-6 bg-blue-500 hover:bg-blue-600 text-white p-4 rounded-full shadow-lg transition-all duration-200 hover:scale-110 active:scale-95"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
};