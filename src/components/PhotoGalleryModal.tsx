import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface PhotoGalleryModalProps {
  photos: string[];
  initialIndex?: number;
  onClose: () => void;
}

const PhotoGalleryModal: React.FC<PhotoGalleryModalProps> = ({ photos, initialIndex = 0, onClose }) => {
  const [index, setIndex] = useState(initialIndex);

  const prev = () => setIndex(i => (i === 0 ? photos.length - 1 : i - 1));
  const next = () => setIndex(i => (i === photos.length - 1 ? 0 : i + 1));

  if (!photos.length) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-[9999] flex flex-col items-center justify-center">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 bg-white/80 rounded-full hover:bg-white z-10"
      >
        <X className="h-6 w-6 text-gray-800" />
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
      <div className="mt-4 text-white text-sm">
        {index + 1} / {photos.length}
      </div>
    </div>
  );
};

export default PhotoGalleryModal; 