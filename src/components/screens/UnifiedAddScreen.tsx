import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, ArrowLeft, Check,  X, RotateCw, RotateCcw, Plus } from 'lucide-react';
import { TagChip } from '../TagChip';
import { PhotoItem, PostalItemGroup, PhotoMetadata, Location, Tag } from '../../types';
import { runTesseractOcr } from '../../utils/ocr';
import { normalizeOcrText } from '../../utils/normalizeOcrText';
import { resizeImageWithOrientation } from '../../utils/imageResize';
import { saveImageBlob, loadImageBlob } from '../../utils/imageDB';
import { generateId } from '../../utils/storage';
import init from '../../pkg/your_wasm_pkg';
import EXIF from 'exif-js';
import { coordinatesToLocationName, extractDisplayLocationName } from '../../utils/locationConverter';

interface UnifiedAddScreenProps {
  onSave: (data: PhotoItem | PostalItemGroup) => void;
  onBack: () => void;
  availableTags: Tag[];
  showAddTag: boolean;
  setShowAddTag: (v: boolean) => void;
  newTagName: string;
  setNewTagName: (v: string) => void;
  newTagColor: string;
  setNewTagColor: (v: string) => void;
  handleAddTag: () => void;
}

type OcrMode = 'disabled' | 'tesseract' | 'google-cloud';

// PhotoItemにrotationを持たせる
interface PhotoItemWithRotation extends PhotoItem {
  rotation?: number; // 0, 90, 180, 270
}

export const UnifiedAddScreen: React.FC<UnifiedAddScreenProps> = ({
  onSave, onBack, availableTags,
  showAddTag, setShowAddTag, newTagName, setNewTagName, newTagColor, setNewTagColor, handleAddTag
}) => {
  const [photos, setPhotos] = useState<PhotoItemWithRotation[]>([]);
  const [title, setTitle] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [memo, setMemo] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [wasmReady, setWasmReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const [ocrMode, setOcrMode] = useState<OcrMode>('disabled');
  // const [useCloudOcr, setUseCloudOcr] = useState(false);
  const [imageUrlMap, setImageUrlMap] = useState<Record<string, string>>({});
  // const [rotatedImageUrlMap, setRotatedImageUrlMap] = useState<Record<string, string>>({});
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [isProcessingLock, setIsProcessingLock] = useState(false);
  const processedFilesRef = useRef(new Set<string>());

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Initialize WASM
  useEffect(() => {
    init().then(() => {
      setWasmReady(true);
      console.log('WASM initialized successfully');
    }).catch((error) => {
      console.error('WASM initialization failed:', error);
      setSaveError(`WASM初期化に失敗しました: ${error.message}`);
    });
  }, []);

  // Load image URLs
  useEffect(() => {
    (async () => {
      const map: Record<string, string> = {};
      for (const photo of photos) {
        if (photo.image && !imageUrlMap[photo.image]) {
          const blob = await loadImageBlob(photo.image);
          if (blob) map[photo.image] = URL.createObjectURL(blob);
        }
      }
      setImageUrlMap(prev => ({ ...prev, ...map }));
    })();
  }, [photos]);

  // 画像回転用関数
  const rotatePhoto = (photoId: string, direction: 'left' | 'right') => {
    setPhotos(prev => prev.map(photo => {
      if (photo.id !== photoId) return photo;
      let newRotation = (photo.rotation || 0) + (direction === 'right' ? 90 : -90);
      newRotation = ((newRotation % 360) + 360) % 360; // 0,90,180,270
      return { ...photo, rotation: newRotation };
    }));
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

  // 現在位置を取得
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('お使いのブラウザは位置情報の取得に対応していません');
      return;
    }

    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude
        });
        setIsGettingLocation(false);
      },
      (error) => {
        console.error('位置情報の取得に失敗しました:', error);
        alert('位置情報の取得に失敗しました');
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true }
    );
  };

  // イベントハンドラの設定
  useEffect(() => {
    const cameraInput = cameraInputRef.current;
    const fileInput = fileInputRef.current;

    const handleCamera = async (e: Event) => {
      const event = { target: e.target } as React.ChangeEvent<HTMLInputElement>;
      if (isProcessingLock) {
        console.log('処理中のため、新しい撮影をスキップします');
        return;
      }
      await handleCameraCapture(event);
    };

    const handleFile = async (e: Event) => {
      const event = { target: e.target } as React.ChangeEvent<HTMLInputElement>;
      if (isProcessingLock) {
        console.log('処理中のため、新しいファイル選択をスキップします');
        return;
      }
      await handleFileSelect(event);
    };

    if (cameraInput) {
      cameraInput.onchange = handleCamera;
    }

    if (fileInput) {
      fileInput.onchange = handleFile;
    }

    return () => {
      if (cameraInput) {
        cameraInput.onchange = null;
        cameraInput.value = '';
      }
      if (fileInput) {
        fileInput.onchange = null;
        fileInput.value = '';
      }
      processedFilesRef.current.clear();
    };
  }, [currentLocation, isProcessingLock]);

  // Handle camera capture
  const handleCameraCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length) return;
    
    const file = event.target.files[0];
    const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
    
    if (processedFilesRef.current.has(fileKey)) {
      console.log('既に処理済みのファイルです:', fileKey);
      return;
    }

    setIsProcessingLock(true);
    setIsProcessing(true);
    setSaveError(null);

    try {
      console.log('カメラ撮影開始:', fileKey);
      processedFilesRef.current.add(fileKey);

      // 位置情報を取得
      let locationData: Location | null = currentLocation;
      if (locationData === null) {
        try {
          locationData = await new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => reject(new Error('位置情報の取得がタイムアウトしました')), 10000);
            navigator.geolocation.getCurrentPosition(
              (position) => {
                clearTimeout(timeoutId);
                const location = {
                  lat: position.coords.latitude,
                  lon: position.coords.longitude
                };
                console.log('カメラ撮影: 位置情報を取得しました', {
                  location,
                  accuracy: position.coords.accuracy,
                  timestamp: new Date(position.timestamp).toISOString()
                });
                resolve(location);
              },
              (error) => {
                clearTimeout(timeoutId);
                console.warn('位置情報の取得に失敗しました:', error);
                resolve(null);
              },
              { 
                enableHighAccuracy: true, 
                timeout: 10000,
                maximumAge: 0 
              }
            );
          });
        } catch (error) {
          console.warn('位置情報の取得に失敗しました:', error);
          locationData = null;
        }
      } else {
        console.log('カメラ撮影: 既存の位置情報を使用します', locationData);
      }

      // --- 地名変換を追加 ---
      let locationName: string | null = null;
      if (locationData) {
        locationName = coordinatesToLocationName(locationData.lat, locationData.lon);
        if (!locationName) {
          // OpenStreetMap Nominatim APIで逆ジオコーディング
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${locationData.lat}&lon=${locationData.lon}&format=json`);
            if (res.ok) {
              const data = await res.json();
              locationName = extractDisplayLocationName(data) || data.display_name || null;
            }
          } catch (e) {
            console.warn('Nominatim逆ジオコーディング失敗:', e);
          }
        }
      }
      // --- 地名変換ここまで ---

      const id = generateId();
      console.log('画像処理開始:', fileKey, id);

      const resizedBase64 = await resizeImageWithOrientation(file);
      const response = await fetch(resizedBase64);
      const resizedBlob = await response.blob();
      await saveImageBlob(id, resizedBlob);

      // EXIFから位置情報を取得
      const exifLocation = await extractLocation(file);
      console.log('カメラ撮影: EXIFの位置情報', {
        fileKey,
        exifLocation,
        deviceLocation: locationData
      });

      const metadata: PhotoMetadata = {
        filename: file.name,
        source: 'camera',
        dateTaken: await extractDateTaken(file),
        location: locationData
          ? { ...locationData, name: locationName || undefined }
          : exifLocation,
      };

      console.log('カメラ撮影: メタデータを設定', {
        fileKey,
        metadata
      });

      const photo: PhotoItemWithRotation = {
        id,
        image: id,
        ocrText: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata,
        tags: [],
        memo: '',
        rotation: 0,
      };

      console.log('画像処理完了:', fileKey, id);

      setPhotos(prev => [...prev, photo]);
    } catch (error) {
      console.error('カメラ撮影エラー:', error);
      setSaveError(error instanceof Error ? error.message : '写真の処理に失敗しました');
      processedFilesRef.current.delete(fileKey);
    } finally {
      setIsProcessing(false);
      setIsProcessingLock(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  // Handle file selection
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length) return;
    
    setIsProcessingLock(true);
    setIsProcessing(true);
    setSaveError(null);

    try {
      const newPhotos: PhotoItemWithRotation[] = [];

      for (const file of Array.from(event.target.files)) {
        const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
        if (processedFilesRef.current.has(fileKey)) {
          console.log('既に処理済みのファイルです:', fileKey);
          continue;
        }
        processedFilesRef.current.add(fileKey);

        const id = generateId();
        console.log('画像処理開始:', fileKey, id);

        const resizedBase64 = await resizeImageWithOrientation(file);
        const response = await fetch(resizedBase64);
        const resizedBlob = await response.blob();
        await saveImageBlob(id, resizedBlob);

        const metadata: PhotoMetadata = {
          filename: file.name,
          source: 'bulk',
          dateTaken: await extractDateTaken(file),
          location: await extractLocation(file),
        };

        const photo: PhotoItemWithRotation = {
          id,
          image: id,
          ocrText: '',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata,
          tags: [],
          memo: '',
          rotation: 0,
        };

        console.log('画像処理完了:', fileKey, id);
        newPhotos.push(photo);
      }

      setPhotos(prev => [...prev, ...newPhotos]);
    } catch (error) {
      console.error('ファイル処理エラー:', error);
      setSaveError(error instanceof Error ? error.message : '写真の処理中にエラーが発生しました');
    } finally {
      setIsProcessing(false);
      setIsProcessingLock(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  // Metadata extraction utilities
  const extractDateTaken = async (file: File): Promise<string | undefined> => {
    return new Promise((resolve) => {
      const exifCallback = function(this: any) {
        const exifDate = EXIF.getTag(this, 'DateTimeOriginal');
        if (exifDate) {
          // Convert EXIF date format to ISO string
          const [date] = exifDate.split(' ');
          const [year, month, day] = date.split(':');
          resolve(`${year}-${month}-${day}`);
        } else {
          resolve(undefined);
        }
      };
      EXIF.getData(file as any, exifCallback as any);
    });
  };

  const extractLocation = async (file: File): Promise<Location | undefined> => {
    return new Promise((resolve) => {
      const exifCallback = function(this: any) {
        const lat = EXIF.getTag(this, 'GPSLatitude');
        const lon = EXIF.getTag(this, 'GPSLongitude');
        const latRef = EXIF.getTag(this, 'GPSLatitudeRef');
        const lonRef = EXIF.getTag(this, 'GPSLongitudeRef');

        if (lat && lon && latRef && lonRef) {
          // Convert GPS coordinates to decimal
          const latitude = convertDMSToDD(lat, latRef);
          const longitude = convertDMSToDD(lon, lonRef);
          if (!isNaN(latitude) && !isNaN(longitude)) {
            resolve({ lat: latitude, lon: longitude });
          } else {
            resolve(undefined);
          }
        } else {
          resolve(undefined);
        }
      };
      EXIF.getData(file as any, exifCallback as any);
    });
  };

  const convertDMSToDD = (dms: number[], ref: string): number => {
    if (!dms || dms.length !== 3) return NaN;
    const degrees = dms[0];
    const minutes = dms[1];
    const seconds = dms[2];
    let dd = degrees + minutes / 60 + seconds / 3600;
    if (ref === 'S' || ref === 'W') dd = -dd;
    return dd;
  };

  // Handle OCR
  const handleOcr = async (photoId: string) => {
    const photo = photos.find(p => p.id === photoId);
    if (!photo) return;

    if (ocrMode === 'disabled') {
      setSaveError('OCRモードが選択されていません');
      return;
    }

    setIsProcessing(true);
    setSaveError(null);

    try {
      const blob = await loadImageBlob(photo.image);
      if (!blob) throw new Error('画像の読み込みに失敗しました');

      let extractedText = '';
      const file = new File([blob], 'image.jpg', { type: blob.type });

      if (ocrMode === 'google-cloud') {
        const base64 = await blobToBase64(blob);
        const res = await fetch('/api/vision-ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64.split(',')[1] }),
        });

        if (!res.ok) {
          throw new Error('Google Cloud Vision APIでの処理に失敗しました');
        }

        const { text } = await res.json();
        extractedText = text;
      } else if (ocrMode === 'tesseract') {
        extractedText = await runTesseractOcr(file);
      }

      setPhotos(prev => prev.map(p => 
        p.id === photoId 
          ? { ...p, ocrText: normalizeOcrText(extractedText) }
          : p
      ));
    } catch (error) {
      console.error('OCR error:', error);
      setSaveError(
        error instanceof Error
          ? `OCR処理中にエラーが発生しました: ${error.message}`
          : 'OCR処理中にエラーが発生しました'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle save
  const handleSave = async () => {
    if (photos.length === 0) {
      setSaveError('少なくとも1枚の写真が必要です');
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      console.log('Starting save process...', { photosCount: photos.length, selectedTags, memo });
      
      // 回転を反映した画像で保存
      const processedPhotos: PhotoItem[] = [];
      for (const photo of photos) {
        console.log('Processing photo:', photo.id);
        let base64 = await loadImageBlob(photo.image).then(blob => blobToBase64(blob!));
        if (photo.rotation && photo.rotation % 360 !== 0) {
          console.log('Applying rotation:', photo.rotation);
          base64 = await applyRotationToBase64(base64, photo.rotation);
        }
        // 保存用blob生成
        const response = await fetch(base64);
        const rotatedBlob = await response.blob();
        await saveImageBlob(photo.id, rotatedBlob);
        // rotationを除外して保存
        const { rotation, ...photoWithoutRotation } = photo;
        processedPhotos.push(photoWithoutRotation);
        console.log('Photo processed successfully:', photo.id);
      }

      if (processedPhotos.length === 1) {
        // Single photo mode
        const photo = processedPhotos[0];
        console.log('Saving single photo:', photo);
        await onSave({
          ...photo,
          tags: selectedTags,
          memo,
          updatedAt: new Date()
        });
      } else {
        // Group mode
        const group: PostalItemGroup = {
          id: generateId(),
          title: title || `写真グループ ${new Date().toLocaleDateString()}`,
          photos: processedPhotos,
          tags: selectedTags,
          memo,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        console.log('Saving group:', group);
        await onSave(group);
      }

      console.log('Save completed successfully');
      // 保存成功後にデータをクリア
      setShowSaved(true);
      setTimeout(() => {
        setShowSaved(false);
        setIsSaving(false);
        // 保存成功後に画面遷移
        onBack();
      }, 1000);
    } catch (error) {
      console.error('Save error:', error);
      setSaveError(error instanceof Error ? error.message : '保存中にエラーが発生しました');
      setIsSaving(false);
    }
  };

  // Utility functions
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const removePhoto = (photoId: string) => {
    setPhotos(photos.filter(p => p.id !== photoId));
  };

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
              {photos.length === 1 ? '新しいアイテム' : '写真グループを作成'}
            </h1>
            <button
              onClick={handleSave}
              disabled={photos.length === 0 || isSaving}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all 
                ${photos.length === 0 || isSaving ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
            >
              <Check className="h-4 w-4" />
              保存
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Title Input (Only for group mode) */}
        {photos.length > 1 && (
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="グループタイトル（任意）"
              className="w-full p-2 border border-gray-200 rounded-lg"
            />
          </div>
        )}

        {/* Photo Upload */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">写真を追加</h2>
          
          {/* OCR Settings (Only for single photo) */}
          {photos.length === 1 && (
            <div className="flex flex-col gap-2 mb-4">
              <div className="flex items-center gap-2">
                <select
                  value={ocrMode}
                  onChange={(e) => setOcrMode(e.target.value as OcrMode)}
                  className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="disabled">OCR無効</option>
                  <option value="tesseract">Tesseract OCR（無料）</option>
                  <option value="google-cloud">Google Cloud Vision（有料）</option>
                </select>
                {ocrMode !== 'disabled' && (
                  <button
                    onClick={() => handleOcr(photos[0].id)}
                    disabled={isProcessing}
                    className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {isProcessing ? '処理中...' : 'OCR実行'}
                  </button>
                )}
              </div>
              {ocrMode !== 'disabled' && (
                <p className="text-sm text-gray-500">
                  {ocrMode === 'tesseract' 
                    ? '※ Tesseract OCRは無料ですが、精度が低い場合があります。'
                    : '※ Google Cloud Visionは有料ですが、高精度な認識が可能です。'}
                </p>
              )}
            </div>
          )}

          {!photos.length && (
            <div className="space-y-3">
              <button
                onClick={() => {
                  getCurrentLocation();
                  cameraInputRef.current?.click();
                }}
                disabled={isProcessing || !wasmReady || isGettingLocation}
                className={`w-full flex items-center justify-center gap-3 py-4 border-2 border-dashed rounded-lg transition-colors
                  ${isProcessing || !wasmReady || isGettingLocation
                    ? 'border-gray-200 bg-gray-50 cursor-not-allowed' 
                    : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}`}
              >
                <Camera className={`h-6 w-6 ${isProcessing || !wasmReady || isGettingLocation ? 'text-gray-300' : 'text-gray-400'}`} />
                <span className={isProcessing || !wasmReady || isGettingLocation ? 'text-gray-400' : 'text-gray-600'}>
                  {isGettingLocation ? '位置情報を取得中...' : isProcessing ? '処理中...' : 'カメラで撮影（位置情報付き）'}
                </span>
              </button>
              
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing || !wasmReady}
                className={`w-full flex items-center justify-center gap-3 py-4 border-2 border-dashed rounded-lg transition-colors
                  ${isProcessing || !wasmReady 
                    ? 'border-gray-200 bg-gray-50 cursor-not-allowed' 
                    : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}`}
              >
                <Upload className={`h-6 w-6 ${isProcessing || !wasmReady ? 'text-gray-300' : 'text-gray-400'}`} />
                <span className={isProcessing || !wasmReady ? 'text-gray-400' : 'text-gray-600'}>
                  {isProcessing ? '処理中...' : 'ギャラリーから選択（複数可）'}
                </span>
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            disabled={isProcessing || !wasmReady}
          />
          
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleCameraCapture}
            className="hidden"
            disabled={isProcessing || !wasmReady}
          />

          {/* Photo Preview */}
          {photos.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {photos.map((photo) => (
                <div key={photo.id} className="relative group">
                  <img
                    src={imageUrlMap[photo.image] || ''}
                    alt="プレビュー"
                    className="w-full h-40 object-contain rounded"
                    style={{ transform: `rotate(${photo.rotation || 0}deg)` }}
                  />
                  <div className="absolute bottom-1 left-1 flex gap-1 opacity-80 group-hover:opacity-100">
                    <button
                      type="button"
                      className="p-1 bg-gray-200 rounded-full hover:bg-gray-300"
                      onClick={() => rotatePhoto(photo.id, 'left')}
                    >
                      <RotateCcw className="h-4 w-4 text-gray-700" />
                    </button>
                    <button
                      type="button"
                      className="p-1 bg-gray-200 rounded-full hover:bg-gray-300"
                      onClick={() => rotatePhoto(photo.id, 'right')}
                    >
                      <RotateCw className="h-4 w-4 text-gray-700" />
                    </button>
                  </div>
                  <button
                    onClick={() => removePhoto(photo.id)}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  {photos.length === 1 && !photo.ocrText && (
                    <button
                      onClick={() => handleOcr(photo.id)}
                      disabled={isProcessing}
                      className="absolute bottom-1 right-1 px-2 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:bg-gray-400"
                    >
                      OCR実行
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {photos.length > 0 && (
            <button
              onClick={() => {
                setPhotos([]);
                setTitle('');
                setMemo('');
              }}
              className="mt-4 text-sm text-blue-500 hover:text-blue-600"
            >
              別の画像を選択
            </button>
          )}
        </div>

        {/* OCR Results (Only for single photo) */}
        {photos.length === 1 && photos[0].ocrText && (
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-semibold text-gray-900">
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
              value={photos[0].ocrText}
              onChange={(e) => setPhotos(prev => [{...prev[0], ocrText: e.target.value}])}
              className="w-full h-32 p-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="OCRで抽出されたテキストが表示されます"
            />
          </div>
        )}

        {/* Tags */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">タグ</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {availableTags.map((tag: { name: string; color: string }) => (
              <TagChip
                key={tag.name}
                tag={tag.name}
                selected={selectedTags.includes(tag.name)}
                onClick={() => handleTagToggle(tag.name)}
                style={{ backgroundColor: tag.color + '22', color: tag.color }}
              />
            ))}
          </div>
          {showAddTag ? (
            <div className="flex items-center gap-2 mb-2">
              <input
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                placeholder="新規タグ名"
                className="border p-1 rounded w-24"
              />
              <input
                type="color"
                value={newTagColor}
                onChange={e => setNewTagColor(e.target.value)}
                className="w-8 h-8 p-0 border-none"
              />
              <button
                onClick={handleAddTag}
                className="px-2 py-1 bg-blue-500 text-white rounded"
              >
                追加
              </button>
              <button
                onClick={() => setShowAddTag(false)}
                className="px-2 py-1 bg-gray-200 rounded"
              >
                キャンセル
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddTag(true)}
              className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
            >
              <Plus className="h-4 w-4" /> 新規タグ
            </button>
          )}
        </div>

        {/* Memo */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">メモ</h2>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="w-full h-24 p-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="メモを入力..."
          />
        </div>
      </div>

      {/* Status Messages */}
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

      {isProcessing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">処理中...</p>
          </div>
        </div>
      )}
    </div>
  );
}; 