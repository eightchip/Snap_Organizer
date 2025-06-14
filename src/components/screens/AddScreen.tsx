import React, { useState, useRef } from 'react';
import { Camera, Upload, Loader2, ArrowLeft, Check } from 'lucide-react';
import { TagChip } from '../TagChip';
import { extractTextFromImage, imageToDataURL } from '../../utils/ocr';

interface AddScreenProps {
  onSave: (data: {
    image: string;
    ocrText: string;
    tags: string[];
    memo: string;
  }) => void;
  onBack: () => void;
}

const AVAILABLE_TAGS = ['仕事', '趣味', '旅行', '郵便物'];

export const AddScreen: React.FC<AddScreenProps> = ({ onSave, onBack }) => {
  const [image, setImage] = useState<string>('');
  const [ocrText, setOcrText] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [memo, setMemo] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const processImage = async (file: File) => {
    setIsProcessing(true);
    try {
      const [imageDataURL, extractedText] = await Promise.all([
        imageToDataURL(file),
        extractTextFromImage(file)
      ]);
      
      setImage(imageDataURL);
      setOcrText(extractedText);
    } catch (error) {
      console.error('画像処理エラー:', error);
      alert('画像の処理中にエラーが発生しました');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processImage(file);
    }
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleSave = () => {
    if (!image || !ocrText.trim()) {
      alert('画像とOCRテキストが必要です');
      return;
    }

    onSave({
      image,
      ocrText,
      tags: selectedTags,
      memo
    });
  };

  const canSave = image && ocrText.trim();

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
              新しいアイテム
            </h1>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                canSave
                  ? 'bg-blue-500 hover:bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Check className="h-4 w-4" />
              保存
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Image Capture */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">写真を撮影</h2>
          
          {!image && (
            <div className="space-y-3">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-3 py-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors"
              >
                <Camera className="h-6 w-6 text-gray-400" />
                <span className="text-gray-600">カメラで撮影</span>
              </button>
              
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-3 py-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors"
              >
                <Upload className="h-6 w-6 text-gray-400" />
                <span className="text-gray-600">ファイルを選択</span>
              </button>
            </div>
          )}

          {image && (
            <div className="space-y-3">
              <img
                src={image}
                alt="撮影画像"
                className="w-full rounded-lg border border-gray-200"
              />
              <button
                onClick={() => {
                  setImage('');
                  setOcrText('');
                }}
                className="text-sm text-blue-500 hover:text-blue-600"
              >
                別の画像を選択
              </button>
            </div>
          )}

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* OCR Results */}
        {isProcessing && (
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-center gap-3 py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              <span className="text-gray-600">テキストを抽出中...</span>
            </div>
          </div>
        )}

        {ocrText && (
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              抽出されたテキスト
            </h2>
            <textarea
              value={ocrText}
              onChange={(e) => setOcrText(e.target.value)}
              className="w-full h-32 p-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="OCRで抽出されたテキストが表示されます"
            />
          </div>
        )}

        {/* Tags */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">タグ</h2>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_TAGS.map(tag => (
              <TagChip
                key={tag}
                tag={tag}
                selected={selectedTags.includes(tag)}
                onClick={() => handleTagToggle(tag)}
              />
            ))}
          </div>
        </div>

        {/* Memo */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">メモ</h2>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="w-full h-24 p-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="追加のメモを入力..."
          />
        </div>
      </div>
    </div>
  );
};