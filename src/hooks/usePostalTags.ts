import { useState, useEffect } from 'react';
import { loadAllData, saveAllData } from '../utils/storage';
import { DEFAULT_TAGS } from '../constants/tags';

interface Tag {
  name: string;
  color: string;
}

export const usePostalTags = () => {
  const [tags, setTags] = useState<Tag[]>([]);

  // 初期化時にIndexedDBからtagsを取得
  useEffect(() => {
    loadAllData().then(data => {
      if (data.tags && data.tags.length > 0) {
        setTags(data.tags);
        localStorage.setItem('postal_tags', JSON.stringify(data.tags));
      } else {
        setTags(DEFAULT_TAGS);
        localStorage.setItem('postal_tags', JSON.stringify(DEFAULT_TAGS));
        // 初回のみ保存
        saveAllData({ ...data, tags: DEFAULT_TAGS });
      }
    });
  }, []);

  const [showAddTag, setShowAddTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3B82F6');
  const [tagEditIdx, setTagEditIdx] = useState<number|null>(null);
  const [tagEditName, setTagEditName] = useState('');
  const [tagEditColor, setTagEditColor] = useState('#3B82F6');

  // タグ追加
  const handleAddTag = async (newTag: Tag) => {
    const data = await loadAllData();
    const updated = [...(data.tags || []), newTag];
    await saveAllData({ ...data, tags: updated });
    setTags(updated);
    localStorage.setItem('postal_tags', JSON.stringify(updated));
  };

  // タグ編集開始
  const startEditTag = (idx: number) => {
    setTagEditIdx(idx);
    setTagEditName(tags[idx].name);
    setTagEditColor(tags[idx].color);
  };

  // タグ編集保存
  const handleEditTag = async (idx: number, newName: string, newColor: string) => {
    const data = await loadAllData();
    const updated = (data.tags || []).map((t: Tag, i: number) =>
      i === idx ? { name: newName.trim(), color: newColor } : t
    );
    await saveAllData({ ...data, tags: updated });
    setTags(updated);
    localStorage.setItem('postal_tags', JSON.stringify(updated));
  };

  // タグ編集キャンセル
  const handleCancelEdit = () => {
    setTagEditIdx(null);
    setTagEditName('');
    setTagEditColor('#3B82F6');
  };

  // タグ削除
  const handleRemoveTag = async (idx: number) => {
    const data = await loadAllData();
    const updated = (data.tags || []).filter((_: Tag, i: number) => i !== idx);
    await saveAllData({ ...data, tags: updated });
    setTags(updated);
    localStorage.setItem('postal_tags', JSON.stringify(updated));
  };

  return {
    tags,
    showAddTag,
    setShowAddTag,
    newTagName,
    setNewTagName,
    newTagColor,
    setNewTagColor,
    tagEditIdx,
    tagEditName,
    setTagEditName,
    tagEditColor,
    setTagEditColor,
    handleAddTag,
    startEditTag,
    handleEditTag,
    handleCancelEdit,
    handleRemoveTag
  };
}; 