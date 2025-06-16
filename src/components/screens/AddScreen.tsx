import React from 'react';
import  { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Loader2, ArrowLeft, Check, Mic, MicOff } from 'lucide-react';
import { TagChip } from '../TagChip';
import { imageToDataURL, runTesseractOcr, runGoogleCloudOcr } from '../../utils/ocr';
import ReactCrop, { Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { normalizeOcrText } from '../../utils/normalizeOcrText';
import { rustResizeImage } from '../../utils/rustImageResize';
import init, { preprocess_image } from '../../pkg/your_wasm_pkg';
import { resizeImage } from '../../utils/imageResize.ts';

interface AddScreenProps {
  onSave: (data: {
    image: string;
    ocrText: string;
    tags: string[];
    memo: string;
  }) => void;
  onBack: () => void;
}

const AVAILABLE_TAGS = ['仕事', '趣味', '旅行'];

export const AddScreen: React.FC<AddScreenProps> = ({ onSave, onBack }) => {
  const [image, setImage] = useState<string>('');
  const [ocrText, setOcrText] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [memo, setMemo] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [ocrMode, setOcrMode] = useState<'full' | 'crop'>('full');
  const [crops, setCrops] = useState<Crop[]>([{ unit: '%', width: 50, height: 30, x: 25, y: 35 }]);
  const [cropResults, setCropResults] = useState<string[]>([]);
  const imgRef = useRef<HTMLImageElement>(null);
  const [useCloudOcr, setUseCloudOcr] = useState(false);
  const [tags, setTags] = useState(() => {
    const saved = localStorage.getItem('postal_tags');
    return saved ? JSON.parse(saved) : [
      { name: '仕事', color: '#3B82F6' },
      { name: '趣味', color: '#22C55E' },
      { name: '旅行', color: '#A78BFA' },
      { name: '郵便物', color: '#F59E42' },
    ];
  });
  const [isListening, setIsListening] = useState(false);
  const [wasmReady, setWasmReady] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [showSaved, setShowSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    init().then(() => setWasmReady(true)).catch(console.error);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('postal_tags');
    if (saved) setTags(JSON.parse(saved));
  }, []);

  const processImage = async (file: File) => {
    if (!wasmReady) {
      alert('WASMの初期化中です。少し待ってから再度お試しください。');
      return;
    }
    setIsProcessing(true);
    try {
      const imageDataURL = await imageToDataURL(file);
      const base64 = imageDataURL.split(',')[1];
      const imageBuffer = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      // WASMで前処理（Promise対応）
      const processed = await preprocess_image(imageBuffer);
      const processedBase64 = uint8ToBase64(processed);
      setImage('data:image/png;base64,' + processedBase64);
      setOcrText('');
      setCropResults([]);
      setCrops([{ unit: '%', width: 50, height: 30, x: 25, y: 35 }]);
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
      imageToDataURL(file).then(imageDataURL => {
        setImage(imageDataURL); // 表示・保存用
        // OCR用前処理はここで実施
      });
    }
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleSave = async () => {
    if (!image || !ocrText.trim()) {
      alert('画像とOCRテキストが必要です');
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      // 画像をリサイズ（最大幅1000px、最大高さ1000px、画質80%）
      const resizedImage = await resizeImage(dataURLtoFile(image, 'image.jpg'), 1000, 1000);
      onSave({
        image: URL.createObjectURL(resizedImage),
        ocrText: normalizeOcrText(ocrText),
        tags: selectedTags,
        memo
      });
      setShowSaved(true);
      setTimeout(() => {
        setShowSaved(false);
        setIsSaving(false);
      }, 2000);
    } catch (e: any) {
      setSaveError('保存に失敗しました。画像サイズが大きすぎる可能性があります。');
      setIsSaving(false);
    }
  };

  const canSave = image && ocrText.trim();

  // 範囲指定で画像を切り出す
  const getCroppedImage = async (crop: Crop): Promise<string | null> => {
    if (!imgRef.current || !crop.width || !crop.height) return null;
    const image = imgRef.current;
    if (!image.complete || image.naturalWidth === 0) return null;

    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = Math.round((crop.width as number) * scaleX);
    canvas.height = Math.round((crop.height as number) * scaleY);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(
      image,
      Math.round((crop.x as number) * scaleX),
      Math.round((crop.y as number) * scaleY),
      Math.round((crop.width as number) * scaleX),
      Math.round((crop.height as number) * scaleY),
      0,
      0,
      canvas.width,
      canvas.height
    );
    // Webではcanvasでリサイズ
    const croppedDataUrl = canvas.toDataURL('image/png');
    const resizedDataUrl = await resizeImageDataUrl(croppedDataUrl, 600, 800);
    return resizedDataUrl;
  };

  // OCR実行
  const handleOcr = async () => {
    setIsProcessing(true);
    setSaveError(null);
    try {
      let extractedText = '';
      if (useCloudOcr) {
        const res = await fetch('/api/vision-ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: image.split(',')[1] }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          let msg = 'Google Cloud Visionで画像処理に失敗しました。';
          if (errData && errData.error) {
            msg += `\n${errData.error}`;
          }
          setSaveError(msg);
          setIsProcessing(false);
          return;
        }
        const { text } = await res.json();
        extractedText = text;
        setOcrText(normalizeOcrText(extractedText));
        setSaveError(null);
      } else if (ocrMode === 'full') {
        extractedText = await runTesseractOcr(dataURLtoFile(image, 'image.jpg'));
        setOcrText(normalizeOcrText(extractedText));
        setSaveError(null);
      } else if (ocrMode === 'crop') {
        const results: string[] = [];
        for (const crop of crops) {
          const cropped = await getCroppedImage(crop);
          if (cropped) {
            const text = await runTesseractOcr(dataURLtoFile(cropped, 'crop.jpg'));
            results.push(text.trim());
          } else {
            results.push('');
          }
        }
        setCropResults(results);
        setOcrText(normalizeOcrText(results.filter(Boolean).join('\n')));
        setSaveError(null);
      }
    } catch (error: any) {
      setSaveError('画像の処理中にエラーが発生しました。\n' + (error?.message || ''));
    } finally {
      setIsProcessing(false);
    }
  };

  // DataURL→File変換
  function dataURLtoFile(dataurl: string, filename: string): File {
    const arr = dataurl.split(',');
    const match = arr[0].match(/:(.*?);/);
    const mime = match ? match[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length, u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], filename, { type: mime });
  }

  // 範囲追加・削除
  const handleAddCrop = () => {
    if (crops.length < 3) {
      setCrops([...crops, { unit: '%', width: 50, height: 30, x: 25, y: 35 }]);
    }
  };
  const handleRemoveCrop = (idx: number) => {
    if (crops.length > 1) {
      setCrops(crops.filter((_, i) => i !== idx));
      setCropResults(cropResults.filter((_, i) => i !== idx));
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
      setMemo(prev => prev ? prev + '\n' + transcript : transcript);
    };

    recognition.start();
  };

  // Uint8Array → base64 変換は以下のように分割して行う
  function uint8ToBase64(u8arr) {
    let CHUNK_SIZE = 0x8000; // 32KB
    let index = 0;
    let length = u8arr.length;
    let result = '';
    let slice;
    while (index < length) {
      slice = u8arr.subarray(index, Math.min(index + CHUNK_SIZE, length));
      result += String.fromCharCode.apply(null, slice);
      index += CHUNK_SIZE;
    }
    return btoa(result);
  }

  function resizeImageDataUrl(dataUrl: string, maxWidth: number, maxHeight: number): Promise<string> {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = function() {
        let { width, height } = img;
        const scale = Math.min(maxWidth / width, maxHeight / height, 1);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = dataUrl;
    });
  }

  return (
    <div className="min-h-screen max-h-screen overflow-auto bg-gray-50">
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
              disabled={!canSave || isSaving}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${(!canSave || isSaving) ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
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
          {/* OCR方式選択チェックボックス */}
          {image && (
            <div className="flex items-center gap-4 mb-2">
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={useCloudOcr}
                  onChange={e => setUseCloudOcr(e.target.checked)}
                />
                Google Cloud Visionで認識する（有料）
              </label>
            </div>
          )}
          {/* OCRモード切り替えボタン */}
          {image && (
            <div className="flex gap-2 mb-2 sticky top-16 bg-white z-20 py-2">
              <button
                className={`px-3 py-1 rounded ${ocrMode === 'full' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
                onClick={() => setOcrMode('full')}
              >全体OCR</button>
              <button
                className={`px-3 py-1 rounded ${ocrMode === 'crop' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
                onClick={() => setOcrMode('crop')}
              >範囲指定OCR</button>
              <button
                className="px-3 py-1 rounded bg-green-500 text-white ml-auto"
                onClick={handleOcr}
                disabled={isProcessing}
              >OCR実行</button>
            </div>
          )}
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
              {ocrMode === 'crop' ? (
                <>
                  {crops.map((crop, idx) => (
                    <div key={idx} className="mb-2 relative">
                      <ReactCrop
                        crop={crop}
                        onChange={c => setCrops(crops.map((v, i) => i === idx ? c : v))}
                        aspect={undefined}
                      >
                        <img
                          ref={idx === 0 ? imgRef : undefined}
                          src={image}
                          alt={`撮影画像${idx+1}`}
                          className="max-img-preview"
                        />
                      </ReactCrop>
                      {crops.length > 1 && (
                        <button
                          className="absolute top-2 right-2 bg-red-500 text-white rounded px-2 py-1 text-xs"
                          onClick={() => handleRemoveCrop(idx)}
                        >削除</button>
                      )}
                      {cropResults[idx] && (
                        <div className="mt-1 text-xs text-gray-600 bg-gray-100 rounded p-2 whitespace-pre-wrap">
                          {cropResults[idx]}
                        </div>
                      )}
                    </div>
                  ))}
                  <button
                    className="px-3 py-1 rounded bg-blue-200 text-blue-800"
                    onClick={handleAddCrop}
                    disabled={crops.length >= 3}
                  >＋範囲追加（最大3）</button>
                </>
              ) : (
                <div className="flex justify-center items-center bg-gray-100 rounded-lg" style={{ minHeight: 180, maxHeight: 300 }}>
                  <div>
                    <img
                      ref={imgRef}
                      src={image}
                      alt="撮影画像"
                      style={{ transform: `rotate(${rotation}deg)` }}
                      className="max-w-full max-h-[40vh] object-contain mx-auto"
                    />
                    <button onClick={() => setRotation(rotation + 90)}>↻ 右回転</button>
                    <button onClick={() => setRotation(rotation - 90)}>↺ 左回転</button>
                  </div>
                </div>
              )}
              <button
                onClick={() => {
                  setImage('');
                  setOcrText('');
                  setCropResults([]);
                  setCrops([{ unit: '%', width: 50, height: 30, x: 25, y: 35 }]);
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
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-semibold text-gray-900 mb-0">
                抽出されたテキスト
              </h2>
              <button
                className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                onClick={() => {
                  const textarea = document.getElementById('ocr-textarea');
                  if (textarea) (textarea as HTMLTextAreaElement).select();
                }}
              >
                全選択
              </button>
            </div>
            <textarea
              id="ocr-textarea"
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
            {tags.map(tag => (
              <TagChip
                key={tag.name}
                tag={tag.name}
                selected={selectedTags.includes(tag.name)}
                onClick={() => handleTagToggle(tag.name)}
                style={{ backgroundColor: tag.color + '22', color: tag.color }}
              />
            ))}
          </div>
        </div>

        {/* Memo */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">メモ</h2>
          <div className="flex items-center gap-2">
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full h-24 p-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="追加のメモを入力..."
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
        </div>
      </div>

      {showSaved && (
        <div className="fixed top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-[9999] text-lg font-bold animate-bounce">
          保存しました
        </div>
      )}
      {saveError && (
        <div className="fixed top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-[9999] text-lg font-bold">
          {saveError}
        </div>
      )}
    </div>
  );
};