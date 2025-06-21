import React, { useState, useEffect } from 'react';
import { PostalItemGroup, PhotoItem, Tag, Location } from '../../types';
import { TagChip } from '../TagChip';
import { ArrowLeft, Edit3, Check, X, Trash2, Plus, Camera, Upload, Share2, RotateCw, RotateCcw, Pencil, MapPin, GripVertical, Navigation } from 'lucide-react';
import { imageToDataURL } from '../../utils/ocr';
import { resizeImage } from '../../utils/imageResize';
import { generateId } from '../../utils/storage';
import { loadImageBlob, saveImageBlob } from '../../utils/imageDB';
import { shareGroup } from '../../utils/share';
import { LocationMap } from '../LocationMap';
import LocationEditorModal from '../LocationEditorModal';
import NavigationModal from '../NavigationModal';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

interface DetailGroupScreenProps {
  group: PostalItemGroup;
  availableTags: Tag[];
  onBack: () => void;
  onUpdate: (updates: Partial<PostalItemGroup>) => void;
  onDelete: () => void;
}

// PhotoItemにrotationを持たせる
interface PhotoItemWithRotation extends PhotoItem {
  rotation?: number; // 0, 90, 180, 270
}

export const DetailGroupScreen: React.FC<DetailGroupScreenProps> = ({
  group,
  availableTags,
  onBack,
  onUpdate,
  onDelete
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(group.title);
  const [editedMemo, setEditedMemo] = useState(group.memo);
  const [editedTags, setEditedTags] = useState<string[]>(group.tags);
  const [editedPhotos, setEditedPhotos] = useState<PhotoItemWithRotation[]>(group.photos);
  const [editedLocation, setEditedLocation] = useState<Location | null>(group.metadata?.location || null);
  const [isSharing, setIsSharing] = useState(false);
  const [isLocationEditorOpen, setIsLocationEditorOpen] = useState(false);
  const [isNavigationModalOpen, setIsNavigationModalOpen] = useState(false);
  const [imageUrlMap, setImageUrlMap] = useState<Record<string, string>>({});
  const [rotatedImageUrlMap, setRotatedImageUrlMap] = useState<Record<string, string>>({});
  const [tagEditIdx, setTagEditIdx] = useState<number|null>(null);
  const [tagEditName, setTagEditName] = useState('');
  const [tagEditColor, setTagEditColor] = useState('#3B82F6');
  const [showAddTag, setShowAddTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3B82F6');

  useEffect(() => {
    (async () => {
      const map: Record<string, string> = {};
      for (const photo of editedPhotos) {
        let base64 = photo.image;
        // base64でなければBlobからbase64化
        if (!base64.startsWith('data:') && !base64.startsWith('blob:')) {
          const blob = await loadImageBlob(photo.image);
          if (blob) {
            base64 = await blobToBase64(blob);
          } else {
            map[photo.id] = '';
            continue;
          }
        } else if (base64.startsWith('blob:')) {
          const blob = await fetch(base64).then(r => r.blob());
          base64 = await blobToBase64(blob);
        }
        // 回転
        if (photo.rotation && photo.rotation % 360 !== 0) {
          base64 = await applyRotationToBase64(base64, photo.rotation);
        }
        map[photo.id] = base64;
      }
      setRotatedImageUrlMap(map);
    })();
  }, [editedPhotos]);

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

  // 画像回転用関数
  const rotatePhoto = (photoId: string, direction: 'left' | 'right') => {
    setEditedPhotos(prev => prev.map(photo => {
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

  // Utility function
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // 保存時に回転を反映
  const handleSave = async () => {
    const processedPhotos: PhotoItem[] = [];
    for (const photo of editedPhotos) {
      const base64 = rotatedImageUrlMap[photo.id] || photo.image;
      const response = await fetch(base64);
      const rotatedBlob = await response.blob();
      await saveImageBlob(photo.id, rotatedBlob);
      const { rotation, ...photoWithoutRotation } = photo;
      processedPhotos.push(photoWithoutRotation);
    }

    const updatedMetadata = {
      ...group.metadata,
      location: editedLocation || undefined,
    };

    onUpdate({
      title: editedTitle,
      memo: editedMemo,
      tags: editedTags,
      photos: processedPhotos,
      updatedAt: new Date(),
      metadata: updatedMetadata,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedTitle(group.title);
    setEditedMemo(group.memo);
    setEditedTags(group.tags);
    setEditedPhotos(group.photos);
    setEditedLocation(group.metadata?.location || null);
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
    if (window.confirm('このグループを削除しますか？')) {
      await onDelete();
    }
  };

  const handleAddPhoto = async (file: File) => {
    try {
      const imageDataURL = await imageToDataURL(file);
      const resizedImage = await resizeImage(imageDataURL, 1000, 1000);
      const blob = await (await fetch(resizedImage)).blob();
      const reader = new FileReader();
      reader.onload = () => {
        const newPhoto: PhotoItem = {
          id: generateId(),
          image: reader.result as string,
          ocrText: '',
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
          memo: '',
          metadata: {
            filename: file.name,
            source: 'bulk',
          },
        };
        setEditedPhotos(prev => [...prev, newPhoto]);
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('写真の追加に失敗しました:', error);
      alert('写真の追加に失敗しました');
    }
  };

  const handleRemovePhoto = (photoId: string) => {
    setEditedPhotos(prev => prev.filter(p => p.id !== photoId));
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      await shareGroup(group);
    } finally {
      setIsSharing(false);
    }
  };

  const handleLocationSave = (location: Location) => {
    setEditedLocation(location);
    setIsLocationEditorOpen(false);
  };

  const handleNavigation = () => {
    if (editedLocation) {
      setIsNavigationModalOpen(true);
    }
  };

  // DataURL→File変換
  function dataURLtoFile(dataurl: string, filename: string): File {
    const arr = dataurl.split(',');
    const match = arr[0].match(/:(.*?);/);
    const mime = match ? match[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  }

  // タグ追加
  const handleAddTag = () => {
    if (!newTagName.trim()) return;
    const newTag = { name: newTagName.trim(), color: newTagColor };
    const updated = [...availableTags, newTag];
    setEditedTags(tags => [...tags, newTag.name]);
    setNewTagName(''); setNewTagColor('#3B82F6'); setShowAddTag(false);
  };
  // タグ編集開始
  const startEditTag = (idx: number) => {
    setTagEditIdx(idx);
    setTagEditName(availableTags[idx].name);
    setTagEditColor(availableTags[idx].color);
  };
  // タグ編集保存
  const handleEditTag = () => {
    if (tagEditIdx === null || !tagEditName.trim()) return;
    const oldName = availableTags[tagEditIdx].name;
    const newName = tagEditName.trim();
    const updated = availableTags.map((t, i) => i === tagEditIdx ? { name: newName, color: tagEditColor } : t);
    setEditedTags(tags => tags.map(t => t === oldName ? newName : t));
    setTagEditIdx(null); setTagEditName(''); setTagEditColor('#3B82F6');
  };
  // タグ編集キャンセル
  const handleCancelEdit = () => {
    setTagEditIdx(null); setTagEditName(''); setTagEditColor('#3B82F6');
  };
  // タグ削除
  const handleRemoveTag = (idx: number) => {
    if (!window.confirm('このタグを削除しますか？')) return;
    const delName = availableTags[idx].name;
    const updated = availableTags.filter((_, i) => i !== idx);
    setEditedTags(tags => tags.filter(t => t !== delName));
  };

  // ドラッグ&ドロップによる並び替え
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    
    const items = Array.from(editedPhotos);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setEditedPhotos(items);
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
              グループ詳細
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
        {/* Title */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">タイトル</h2>
          {isEditing ? (
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <p className="text-gray-900">{group.title}</p>
          )}
        </div>

        {/* Photos */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">写真</h2>
            {isEditing && (
              <div className="flex gap-2">
                <label className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
                  <Camera className="h-5 w-5 text-gray-500" />
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => e.target.files?.[0] && handleAddPhoto(e.target.files[0])}
                    className="hidden"
                  />
                </label>
                <label className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
                  <Upload className="h-5 w-5 text-gray-500" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleAddPhoto(e.target.files[0])}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="photos" direction="horizontal">
              {(provided: any) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="flex gap-2 overflow-x-auto pb-2 min-h-[120px]"
                  style={{ scrollbarWidth: 'thin' }}
                >
                  {editedPhotos.map((photo, index) => (
                    <Draggable
                      key={photo.id}
                      draggableId={photo.id}
                      index={index}
                      isDragDisabled={!isEditing}
                    >
                      {(provided: any, snapshot: any) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`relative group flex-shrink-0`}
                          style={{
                            width: 120,
                            minWidth: 120,
                            maxWidth: 120,
                            ...provided.draggableProps.style,
                            transform: snapshot.isDragging
                              ? provided.draggableProps.style?.transform
                              : 'none',
                          }}
                        >
                          {isEditing && (
                            <div className="absolute top-0 left-0 right-0 h-6 flex justify-center items-center bg-gray-100/80 rounded-t-lg cursor-grab active:cursor-grabbing">
                              <GripVertical className="h-4 w-4 text-gray-600" />
                            </div>
                          )}
                          <img
                            src={rotatedImageUrlMap[photo.id] || ''}
                            alt="プレビュー"
                            className={`w-full h-[100px] object-contain rounded-lg border-2 mt-6 ${
                              snapshot.isDragging 
                                ? 'border-blue-500 shadow-lg bg-blue-50'
                                : isEditing 
                                  ? 'border-gray-200'
                                  : 'border-transparent'
                            }`}
                          />
                          {isEditing && (
                            <>
                              <div className="absolute bottom-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  className="p-1.5 bg-white/80 rounded-lg hover:bg-white"
                                  onClick={() => rotatePhoto(photo.id, 'left')}
                                >
                                  <RotateCcw className="h-4 w-4 text-gray-700" />
                                </button>
                                <button
                                  type="button"
                                  className="p-1.5 bg-white/80 rounded-lg hover:bg-white"
                                  onClick={() => rotatePhoto(photo.id, 'right')}
                                >
                                  <RotateCw className="h-4 w-4 text-gray-700" />
                                </button>
                              </div>
                              <button
                                onClick={() => handleRemovePhoto(photo.id)}
                                className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>

        {/* Tags */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">タグ</h2>
          <div className="flex flex-wrap gap-2 mb-2">
            {availableTags.map((tag, idx) => (
              <div key={tag.name} className="flex items-center gap-1">
                <TagChip
                  tag={tag.name}
                  selected={isEditing ? editedTags.includes(tag.name) : group.tags.includes(tag.name)}
                  onClick={isEditing ? () => handleTagToggle(tag.name) : undefined}
                  style={{ backgroundColor: tag.color + '22', color: tag.color, cursor: isEditing ? 'pointer' : 'default' }}
                />
                {isEditing && (
                  <>
                    <button onClick={() => startEditTag(idx)} className="p-1 hover:bg-gray-100 rounded"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => handleRemoveTag(idx)} className="p-1 hover:bg-red-100 rounded"><Trash2 className="h-4 w-4 text-red-500" /></button>
                  </>
                )}
              </div>
            ))}
          </div>
          {isEditing && (
            <>
              {tagEditIdx !== null ? (
                <div className="flex items-center gap-2 mb-2">
                  <input value={tagEditName} onChange={e => setTagEditName(e.target.value)} className="border p-1 rounded w-24" />
                  <input type="color" value={tagEditColor} onChange={e => setTagEditColor(e.target.value)} className="w-8 h-8 p-0 border-none" />
                  <button onClick={handleEditTag} className="px-2 py-1 bg-blue-500 text-white rounded">保存</button>
                  <button onClick={handleCancelEdit} className="px-2 py-1 bg-gray-200 rounded">キャンセル</button>
                </div>
              ) : null}
              {showAddTag ? (
                <div className="flex items-center gap-2 mb-2">
                  <input value={newTagName} onChange={e => setNewTagName(e.target.value)} placeholder="新規タグ名" className="border p-1 rounded w-24" />
                  <input type="color" value={newTagColor} onChange={e => setNewTagColor(e.target.value)} className="w-8 h-8 p-0 border-none" />
                  <button onClick={handleAddTag} className="px-2 py-1 bg-blue-500 text-white rounded">追加</button>
                  <button onClick={() => setShowAddTag(false)} className="px-2 py-1 bg-gray-200 rounded">キャンセル</button>
                </div>
              ) : (
                <button onClick={() => setShowAddTag(true)} className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">
                  <Plus className="h-4 w-4" /> 新規タグ
                </button>
              )}
            </>
          )}
        </div>

        {/* Memo */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">メモ</h2>
          {isEditing ? (
            <textarea
              value={editedMemo}
              onChange={(e) => setEditedMemo(e.target.value)}
              className="w-full h-32 p-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <div className="whitespace-pre-wrap text-gray-900">
              {group.memo}
            </div>
          )}
        </div>

        {/* Date Info */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">日時情報</h2>
          <p className="text-gray-600">作成日時: {formatDate(group.createdAt)}</p>
          {group.updatedAt.getTime() !== group.createdAt.getTime() && (
            <p className="text-gray-600 mt-1">最終更新: {formatDate(group.updatedAt)}</p>
          )}
        </div>

        {/* Location Section */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
            <MapPin className="h-5 w-5 mr-2 text-gray-500" />
            位置情報
          </h3>
          {isEditing ? (
                    <div>
              {editedLocation ? (
                <div className="space-y-2">
                  <p className="text-sm text-gray-700">{editedLocation.name || `緯度: ${editedLocation.lat.toFixed(4)}, 経度: ${editedLocation.lon.toFixed(4)}`}</p>
                  <div className="h-40 rounded-md overflow-hidden">
                    <LocationMap items={[{ 
                      id: 'temp-location-item', 
                      image: '', 
                      ocrText: '', 
                      memo: '', 
                      tags: [], 
                      createdAt: new Date(), 
                      updatedAt: new Date(), 
                      metadata: { location: editedLocation, source: 'import', filename: '' } 
                    }]} groups={[]} />
                  </div>
                  <button onClick={() => setIsLocationEditorOpen(true)} className="text-sm text-blue-600 hover:underline">
                    位置情報を変更
                  </button>
              </div>
              ) : (
                <button onClick={() => setIsLocationEditorOpen(true)} className="w-full text-center py-2 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600">
                  位置情報を追加
                </button>
              )}
            </div>
          ) : (
            <div>
              {group.metadata?.location ? (
                <div className="space-y-2">
                  <p className="text-sm text-gray-700">{group.metadata.location.name || `緯度: ${group.metadata.location.lat.toFixed(4)}, 経度: ${group.metadata.location.lon.toFixed(4)}`}</p>
                  <div className="h-40 rounded-md overflow-hidden">
                    <LocationMap items={[]} groups={[group]} />
                  </div>
                   <button onClick={handleNavigation} className="mt-2 w-full text-center py-2 px-4 bg-green-500 text-white rounded-md hover:bg-green-600 flex items-center justify-center gap-2">
                    <Navigation className="h-4 w-4" />
                    ここへ行く
                  </button>
                </div>
              ) : (
                <p className="text-sm text-gray-500">このグループに位置情報はありません。</p>
              )}
            </div>
          )}
        </div>
      </div>

      {isLocationEditorOpen && (
        <LocationEditorModal
          initialLocation={editedLocation}
          onClose={() => setIsLocationEditorOpen(false)}
          onSave={handleLocationSave}
        />
      )}

      {isNavigationModalOpen && editedLocation && (
        <NavigationModal
          onClose={() => setIsNavigationModalOpen(false)}
          destination={editedLocation}
        />
      )}
    </div>
  );
}; 