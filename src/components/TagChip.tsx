import React from 'react';

interface TagChipProps {
  tag: string;
  selected?: boolean;
  count?: number;
  onClick?: (e: React.MouseEvent) => void;
  removable?: boolean;
  onRemove?: () => void;
  style?: React.CSSProperties;
  color?: string;
}

const TAG_COLORS: Record<string, string> = {
  '仕事': 'bg-blue-100 text-blue-800 border-blue-200',
  '趣味': 'bg-green-100 text-green-800 border-green-200',
  '旅行': 'bg-purple-100 text-purple-800 border-purple-200',
  '郵便物': 'bg-orange-100 text-orange-800 border-orange-200'
};

export const TagChip: React.FC<TagChipProps> = ({
  tag,
  selected = false,
  count,
  onClick,
  removable = false,
  onRemove,
  style,
  color
}) => {
  const colorClass = !color ? (TAG_COLORS[tag] || 'bg-gray-100 text-gray-800 border-gray-200') : '';
  const selectedClass = selected ? 'ring-2 ring-blue-500 ring-opacity-50' : '';

  const dynamicStyle = color 
    ? { 
        backgroundColor: `${color}22`,
        color: color,
        borderColor: color 
      } 
    : {};

  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border cursor-pointer transition-all duration-200 ${colorClass} ${selectedClass} ${
        onClick ? 'hover:shadow-md hover:scale-105' : ''
      }`}
      onClick={onClick}
      style={{ ...style, ...dynamicStyle }}
    >
      #{tag}
      {count !== undefined && (
        <span className="ml-1 text-xs opacity-75">({count})</span>
      )}
      {removable && onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 hover:bg-red-200 rounded-full p-0.5 transition-colors"
        >
          ×
        </button>
      )}
    </span>
  );
};