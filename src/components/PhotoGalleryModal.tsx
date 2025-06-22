import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';

interface PhotoGalleryModalProps {
  photos: string[];
  initialIndex?: number;
  onClose: () => void;
}

const PhotoGalleryModal: React.FC<PhotoGalleryModalProps> = ({ photos, initialIndex = 0, onClose }) => {
  const [index, setIndex] = useState(initialIndex);

  const prev = () => setIndex(i => (i === 0 ? photos.length - 1 : i - 1));
  const next = () => setIndex(i => (i === photos.length - 1 ? 0 : i + 1));

  if (!photos.length) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-90 z-[9999] flex flex-col items-center justify-center">
        <div className="flex flex-col items-center justify-center">
          <ImageIcon className="h-24 w-24 text-gray-400 mb-4" />
          <div className="text-white text-lg font-bold mb-2">画像がありません</div>
          <button
            onClick={onClose}
            className="mt-6 px-6 py-2 bg-white/80 rounded-full hover:bg-white text-gray-800 font-bold"
          >
            閉じる
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-[9999] flex flex-col items-center justify-center">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 bg-white/80 rounded-full hover:bg-white z-10 flex items-center gap-2 font-bold"
      >
        <X className="h-6 w-6 text-gray-800" />
        <span className="hidden sm:inline">閉じる</span>
      </button>
      <div className="flex items-center justify-center w-full h-full">
        <button
          onClick={prev}
          className="p-2 bg-white/60 rounded-full hover:bg-white mx-2"
          style={{ visibility: photos.length > 1 ? 'visible' : 'hidden' }}
        >
          <ChevronLeft className="h-8 w-8 text-gray-800" />
        </button>
        <img
          src={photos[index]}
          alt={`写真${index + 1}`}
          className="max-h-[80vh] max-w-[90vw] rounded shadow-lg object-contain bg-white"
        />
        <button
          onClick={next}
          className="p-2 bg-white/60 rounded-full hover:bg-white mx-2"
          style={{ visibility: photos.length > 1 ? 'visible' : 'hidden' }}
        >
          <ChevronRight className="h-8 w-8 text-gray-800" />
        </button>
      </div>
      <div className="mt-4 text-white text-sm font-bold">
        {index + 1}枚目 / 全{photos.length}枚
      </div>
      <div className="mt-4 flex gap-2 overflow-x-auto px-4 pb-2">
        {photos.map((photo, i) => (
          <img
            key={i}
            src={photo}
            alt={`サムネイル${i + 1}`}
            className={`h-14 w-auto rounded cursor-pointer border-2 ${i === index ? 'border-blue-500 ring-2 ring-blue-400' : 'border-gray-300'}`}
            style={{ flex: '0 0 auto' }}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
      <div className="mt-2 text-gray-300 text-xs">← → で切り替え・サムネイルクリックでジャンプ</div>
    </div>
  );
};

export default PhotoGalleryModal; 