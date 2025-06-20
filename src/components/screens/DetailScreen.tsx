import React, { useState, useEffect } from 'react';
import { PhotoItem, Location } from '../../types';
import { TagChip } from '../TagChip';
import { ArrowLeft, Edit3, Check, X, Trash2, Calendar, FileText, StickyNote, Mic, MicOff, Share2, RotateCw, RotateCcw, MapPin } from 'lucide-react';
import { loadImageBlob, saveImageBlob } from '../../utils/imageDB';
import { shareItem } from '../../utils/share';
import { LocationMap } from '../LocationMap';
import LocationEditorModal from '../LocationEditorModal';

interface DetailScreenProps {
  item: PhotoItem;
  onBack: () => void;
  onUpdate: (updates: Partial<PhotoItem>) => void;
  onDelete?: () => void;
}

// PhotoItemにrotationを持たせる
interface PhotoItemWithRotation extends PhotoItem {
  rotation?: number; // 0, 90, 180, 270
}

const getTagColor = (tagName: string) => {
  const tags = JSON.parse(localStorage.getItem('postal_tags') || '[]');
  const found = tags.find((t: any) => t.name === tagName);
  return found ? found.color : '#ccc';
};

// Utility function
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const DetailScreen: React.FC<DetailScreenProps> = ({
  item,
  onBack,
  onUpdate,
  onDelete
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedOcrText, setEditedOcrText] = useState(item.ocrText);
  const [editedMemo, setEditedMemo] = useState(item.memo);
  const [editedTags, setEditedTags] = useState<string[]>(item.tags);
  const [editedLocation, setEditedLocation] = useState<Location | null>(item.metadata?.location || null);
  const [isListening, setIsListening] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isLocationEditorOpen, setIsLocationEditorOpen] = useState(false);
  const [availableTags, setAvailableTags] = useState(() => {
    const saved = localStorage.getItem('postal_tags');
    return saved ? JSON.parse(saved) : [];
  });
  const [imageUrl, setImageUrl] = useState<string>('');
  const [rotation, setRotation] = useState<number>(0);

  // タグリストを更新
  useEffect(() => {
    const saved = localStorage.getItem('postal_tags');
    if (saved) {
      setAvailableTags(JSON.parse(saved));
    }
  }, [isEditing]);

  useEffect(() => {
    if (item.image) {
      loadImageBlob(item.image).then(blob => {
        if (blob) setImageUrl(URL.createObjectURL(blob));
      });
    }
  }, [item.image]);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'long'
    }).format(date);
  };

  // 画像回転をcanvasで適用する関数
  const applyRotationToBase64 = async (base64: string, rotation: number): Promise<string> => {
    if (!rotation || rotation % 360 === 0) return base64;
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('No ctx');
        if (rotation % 180 === 0) {
          canvas.width = img.width;
          canvas.height = img.height;
        } else {
          canvas.width = img.height;
          canvas.height = img.width;
        }
        ctx.save();
        switch (rotation) {
          case 90:
            ctx.translate(canvas.width, 0);
            ctx.rotate(Math.PI / 2);
            break;
          case 180:
            ctx.translate(canvas.width, canvas.height);
            ctx.rotate(Math.PI);
            break;
          case 270:
            ctx.translate(0, canvas.height);
            ctx.rotate(-Math.PI / 2);
            break;
        }
        ctx.drawImage(img, 0, 0);
        ctx.restore();
        resolve(canvas.toDataURL('image/jpeg'));
      };
      img.onerror = reject;
      img.src = base64;
    });
  };

  // 画像回転UI
  const handleRotate = (direction: 'left' | 'right') => {
    setRotation(prev => {
      let newRotation = prev + (direction === 'right' ? 90 : -90);
      newRotation = ((newRotation % 360) + 360) % 360;
      return newRotation;
    });
  };

  // 保存時に回転を反映
  const handleSave = async () => {
    let base64 = '';
    if (item.image) {
      const blob = await loadImageBlob(item.image);
      base64 = await blobToBase64(blob!);
      if (rotation && rotation % 360 !== 0) {
        base64 = await applyRotationToBase64(base64, rotation);
        // 保存用blob生成
        const response = await fetch(base64);
        const rotatedBlob = await response.blob();
        await loadImageBlob(item.image).then(() => saveImageBlob(item.id, rotatedBlob));
      }
    }
    
    // メタデータを更新
    const updatedMetadata = {
      ...item.metadata,
      location: editedLocation || undefined,
    };
    
    onUpdate({
      ocrText: editedOcrText,
      memo: editedMemo,
      tags: editedTags,
      metadata: updatedMetadata,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedOcrText(item.ocrText);
    setEditedMemo(item.memo);
    setEditedTags(item.tags);
    setEditedLocation(item.metadata?.location || null);
    setIsEditing(false);
  };

  const handleTagToggle = (tag: string) => {
    setEditedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleDelete = async () => {
    if (window.confirm('このアイテムを削除しますか？')) {
      await onDelete?.();
    }
  };

  // 音声入力
  const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('このブラウザは音声認識に対応していません');
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setEditedMemo((prev: string) => prev ? prev + '\n' + transcript : transcript);
    };

    recognition.start();
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const success = await shareItem(item);
      if (!success) {
        alert('共有に失敗しました。');
      }
    } catch (error) {
      console.error('共有エラー:', error);
      alert('共有中にエラーが発生しました。');
    } finally {
      setIsSharing(false);
    }
  };

  const handleLocationSave = (location: Location) => {
    setEditedLocation(location);
    setIsLocationEditorOpen(false);
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-md mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-xl font-bold text-gray-900 flex-1">
                アイテム詳細
              </h1>
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={handleCancel}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <X className="h-5 w-5 text-gray-500" />
                    </button>
                    <button
                      onClick={handleSave}
                      className="p-2 hover:bg-green-100 rounded-lg transition-colors"
                    >
                      <Check className="h-5 w-5 text-green-600" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleShare}
                      disabled={isSharing}
                      className={`p-2 rounded-lg transition-colors ${
                        isSharing
                          ? 'bg-gray-200 cursor-not-allowed'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      <Share2 className="h-5 w-5" />
                    </button>
                    {onDelete && (
                      <button
                        onClick={handleDelete}
                        className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-5 w-5 text-red-500" />
                      </button>
                    )}
                    <button
                      onClick={() => setIsEditing(true)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Edit3 className="h-5 w-5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {isEditing && (
          <div className="bg-yellow-100 text-yellow-800 p-2 text-center text-sm">
            編集中
          </div>
        )}

        <main className="max-w-md mx-auto px-4 pb-20">
          {/* Image Display */}
          {imageUrl && (
            <div className="mb-4 relative">
              <img
                src={imageUrl}
                alt="Postal Item"
                className="rounded-lg w-full h-auto object-contain transition-transform duration-300"
                style={{ transform: `rotate(${rotation}deg)` }}
              />
              {isEditing && (
                <div className="absolute top-2 right-2 flex gap-2">
                  <button
                    onClick={() => handleRotate('left')}
                    className="bg-white/80 p-2 rounded-full shadow-md hover:bg-white"
                  >
                    <RotateCcw className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleRotate('right')}
                    className="bg-white/80 p-2 rounded-full shadow-md hover:bg-white"
                  >
                    <RotateCw className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tags */}
          <div className="mb-6">
            <div className="flex flex-wrap gap-2">
              {isEditing
                ? availableTags.map((tag: any) => (
                    <TagChip
                      key={tag.name}
                      tag={tag.name}
                      color={tag.color}
                      isSelected={editedTags.includes(tag.name)}
                      onClick={() => handleTagToggle(tag.name)}
                    />
                  ))
                : item.tags.map(tag => (
                    <TagChip key={tag} tag={tag} color={getTagColor(tag)} />
                  ))}
            </div>
          </div>
          
          {/* Date */}
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
            <Calendar className="h-4 w-4" />
            <span>{formatDate(new Date(item.createdAt))}</span>
          </div>

          {/* OCR Text */}
          <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-gray-400" />
              <h3 className="text-lg font-semibold">認識されたテキスト</h3>
            </div>
            {isEditing ? (
              <textarea
                value={editedOcrText}
                onChange={(e) => setEditedOcrText(e.target.value)}
                className="mt-2 w-full h-32 p-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            ) : (
              <div className="mt-2 whitespace-pre-wrap text-gray-900 bg-gray-50 p-3 rounded-lg">
                {item.ocrText}
              </div>
            )}
          </div>
          
          {/* Memo */}
          <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
            <div className="flex items-center gap-2">
              <StickyNote className="h-5 w-5 text-gray-400" />
              <h3 className="text-lg font-semibold">メモ</h3>
              {isEditing && (
                <button onClick={handleVoiceInput} className={`p-1 rounded-full ${isListening ? 'bg-red-500 text-white' : 'bg-gray-200'}`}>
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
              )}
            </div>
            {isEditing ? (
              <textarea
                value={editedMemo}
                onChange={(e) => setEditedMemo(e.target.value)}
                className="mt-2 w-full h-24 p-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="メモを追加..."
              />
            ) : (
              <div className="mt-2 whitespace-pre-wrap text-gray-900 bg-gray-50 p-3 rounded-lg min-h-[5rem]">
                {item.memo || <span className="text-gray-400">メモはありません</span>}
              </div>
            )}
          </div>

          {/* Location Info */}
          {(editedLocation || isEditing) && (
            <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
              <div className="flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-gray-400" />
                  <h3 className="text-lg font-semibold">位置情報</h3>
                </div>
                {isEditing && (
                  <button 
                    onClick={() => setIsLocationEditorOpen(true)}
                    className="text-sm bg-blue-500 text-white py-1 px-3 rounded-full hover:bg-blue-600 transition-colors"
                  >
                    {editedLocation ? '編集' : '追加'}
                  </button>
                )}
              </div>
              
              {editedLocation ? (
                <div className="mt-4">
                  {editedLocation.name && (
                    <p className="font-bold text-gray-800">{editedLocation.name}</p>
                  )}
                  <p className="text-sm text-gray-500">
                    緯度: {editedLocation.lat.toFixed(6)}, 経度: {editedLocation.lon.toFixed(6)}
                  </p>
                  <div className="mt-2 h-48 rounded-lg overflow-hidden">
                    <LocationMap 
                      items={[{...item, metadata: {...item.metadata, location: editedLocation}}]} 
                      groups={[]} 
                    />
                  </div>
                </div>
              ) : (
                 isEditing && <p className="text-sm text-gray-500 mt-2">このアイテムには位置情報がありません。</p>
              )}
            </div>
          )}
        </main>
      </div>
      
      {isLocationEditorOpen && (
        <LocationEditorModal
          initialLocation={editedLocation}
          onClose={() => setIsLocationEditorOpen(false)}
          onSave={handleLocationSave}
        />
      )}
    </>
  );
};