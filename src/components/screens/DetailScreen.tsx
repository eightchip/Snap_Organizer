import React, { useState, useEffect } from 'react';
import { PostalItem } from '../../types';
import { TagChip } from '../TagChip';
import { ArrowLeft, Edit3, Check, X, Trash2, Calendar, FileText, StickyNote, Mic, MicOff } from 'lucide-react';
import { loadImageBlob } from '../../utils/imageDB';

interface DetailScreenProps {
  item: PostalItem;
  onBack: () => void;
  onUpdate: (updates: Partial<PostalItem>) => void;
  onDelete: () => void;
}

const getTagColor = (tagName: string) => {
  const tags = JSON.parse(localStorage.getItem('postal_tags') || '[]');
  const found = tags.find((t: any) => t.name === tagName);
  return found ? found.color : '#ccc';
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
  const [availableTags, setAvailableTags] = useState(() => {
    const saved = localStorage.getItem('postal_tags');
    return saved ? JSON.parse(saved) : [];
  });
  const [imageUrl, setImageUrl] = useState<string>('');

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

  const handleSave = () => {
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
      onDelete();
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
          <img
            src={imageUrl || ''}
            alt="撮影画像"
            className="object-contain"
            style={{ maxWidth: '100%', maxHeight: '320px', width: 'auto', height: 'auto' }}
          />
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