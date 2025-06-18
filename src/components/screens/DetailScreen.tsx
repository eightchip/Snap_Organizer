import React, { useState, useEffect } from 'react';
import { PhotoItem } from '../../types';
import { TagChip } from '../TagChip';
import { ArrowLeft, Edit3, Check, X, Trash2, Calendar, FileText, StickyNote, Mic, MicOff, Share2, RotateCw, RotateCcw } from 'lucide-react';
import { loadImageBlob, saveImageBlob } from '../../utils/imageDB';
import { shareItem } from '../../utils/share';

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
  const [isListening, setIsListening] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
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
    onUpdate({
      ocrText: editedOcrText,
      memo: editedMemo,
      tags: editedTags
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedOcrText(item.ocrText);
    setEditedMemo(item.memo);
    setEditedTags(item.tags);
    setIsEditing(false);
  };

  const handleTagToggle = (tag: string) => {
    setEditedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleDelete = () => {
    if (window.confirm('このアイテムを削除しますか？')) {
      onDelete?.();
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

  return (
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
                      isSharing ? 'bg-gray-100 cursor-not-allowed' : 'hover:bg-blue-100'
                    }`}
                  >
                    <Share2 className={`h-5 w-5 ${isSharing ? 'text-gray-400' : 'text-blue-500'}`} />
                  </button>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Edit3 className="h-5 w-5 text-gray-500" />
                  </button>
                  <button
                    onClick={handleDelete}
                    className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-5 w-5 text-red-500" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Image */}
        <div className="bg-white rounded-xl overflow-hidden shadow-sm flex justify-center items-center" style={{ minHeight: 180, maxHeight: 320 }}>
          <div className="flex justify-center items-center mb-4 relative group">
            <img
              src={imageUrl}
              alt="撮影画像"
              className="object-contain"
              style={{ maxWidth: '100%', maxHeight: '320px', width: 'auto', height: 'auto', transform: `rotate(${rotation}deg)` }}
            />
            {isEditing && (
              <div className="absolute bottom-2 left-2 flex gap-1 opacity-80 group-hover:opacity-100">
                <button
                  type="button"
                  className="p-1 bg-gray-200 rounded-full hover:bg-gray-300"
                  onClick={() => handleRotate('left')}
                >
                  <RotateCcw className="h-4 w-4 text-gray-700" />
                </button>
                <button
                  type="button"
                  className="p-1 bg-gray-200 rounded-full hover:bg-gray-300"
                  onClick={() => handleRotate('right')}
                >
                  <RotateCw className="h-4 w-4 text-gray-700" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Date Info */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 text-gray-600 mb-2">
            <Calendar className="h-5 w-5" />
            <span className="font-medium">作成日時</span>
          </div>
          <p className="text-gray-900">{formatDate(item.createdAt)}</p>
          {item.updatedAt.getTime() !== item.createdAt.getTime() && (
            <p className="text-sm text-gray-500 mt-1">
              最終更新: {formatDate(item.updatedAt)}
            </p>
          )}
        </div>

        {/* OCR Text */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 text-gray-600 mb-4">
            <FileText className="h-5 w-5" />
            <span className="font-medium">抽出されたテキスト</span>
          </div>
          {isEditing ? (
            <textarea
              value={editedOcrText}
              onChange={(e) => setEditedOcrText(e.target.value)}
              className="w-full h-32 p-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          ) : (
            <div className="whitespace-pre-wrap text-gray-900 bg-gray-50 p-3 rounded-lg">
              {item.ocrText}
            </div>
          )}
        </div>

        {/* Tags */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">タグ</h2>
          <div className="flex flex-wrap gap-2">
            {isEditing ? (
              availableTags.map(tag => (
                <TagChip
                  key={tag.name}
                  tag={tag.name}
                  selected={editedTags.includes(tag.name)}
                  onClick={() => handleTagToggle(tag.name)}
                  style={{ backgroundColor: tag.color + '22', color: tag.color }}
                />
              ))
            ) : (
              item.tags.length > 0 ? (
                item.tags.map(tag => (
                  <TagChip 
                    key={tag} 
                    tag={tag} 
                    style={{ 
                      backgroundColor: getTagColor(tag) + '22', 
                      color: getTagColor(tag) 
                    }} 
                  />
                ))
              ) : (
                <p className="text-gray-500">タグが設定されていません</p>
              )
            )}
          </div>
        </div>

        {/* Memo */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 text-gray-600 mb-4">
            <StickyNote className="h-5 w-5" />
            <span className="font-medium">メモ</span>
          </div>
          {isEditing ? (
            <div className="flex items-center gap-2">
            <textarea
              value={editedMemo}
              onChange={(e) => setEditedMemo(e.target.value)}
              className="w-full h-24 p-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="メモを入力..."
            />
              <button
                type="button"
                className={`p-2 rounded-full ${isListening ? 'bg-blue-100' : 'bg-gray-100'} ml-2`}
                onClick={handleVoiceInput}
                title="音声入力"
              >
                {isListening ? <MicOff className="w-5 h-5 text-blue-500" /> : <Mic className="w-5 h-5 text-gray-500" />}
              </button>
            </div>
          ) : (
            <div className="text-gray-900">
              {item.memo || (
                <span className="text-gray-500 italic">メモはありません</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};