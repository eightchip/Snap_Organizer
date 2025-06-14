import React from 'react';
import { PostalItem } from '../types';
import { TagChip } from './TagChip';
import { Calendar, FileText } from 'lucide-react';

interface ItemCardProps {
  item: PostalItem;
  onClick: () => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, onClick }) => {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
    >
      <div className="aspect-[16/9] bg-gray-100 overflow-hidden">
        <img
          src={item.image}
          alt="撮影画像"
          className="w-full h-full object-cover"
        />
      </div>
      
      <div className="p-4">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Calendar className="h-4 w-4" />
          <span>{formatDate(item.createdAt)}</span>
        </div>
        
        <div className="flex items-start gap-2 mb-3">
          <FileText className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-gray-700 leading-relaxed">
            {truncateText(item.ocrText)}
          </p>
        </div>
        
        {item.memo && (
          <p className="text-sm text-gray-600 mb-3 italic">
            {truncateText(item.memo, 80)}
          </p>
        )}
        
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.map((tag) => (
              <TagChip key={tag} tag={tag} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};