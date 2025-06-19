import { useState, useEffect } from 'react';
import { loadAllData, saveAllData } from '../utils/storage';

interface Tag {
  name: string;
  color: string;
}

const COLOR_PALETTE = [
  { name: '仕事', color: '#3B82F6' },
  { name: '趣味', color: '#22C55E' },
  { name: '旅行', color: '#A78BFA' },
];

export const usePostalTags = () => {
  // タグ管理（localStorage永続化）
  const [tags, setTags] = useState<Tag[]>(() => {
    const saved = localStorage.getItem('postal_tags');
    return saved ? JSON.parse(saved) : COLOR_PALETTE;
  });

  // 新規タグ追加用state
  const [showAddTag, setShowAddTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3B82F6');

  // タグ編集用state
  const [tagEditIdx, setTagEditIdx] = useState<number|null>(null);
  const [tagEditName, setTagEditName] = useState('');
  const [tagEditColor, setTagEditColor] = useState('#3B82F6');

  // タグ追加
  const handleAddTag = () => {
    if (!newTagName.trim()) return;
    const newTag = { name: newTagName.trim(), color: newTagColor };
    const updated = [...tags, newTag];
    setTags(updated);
    localStorage.setItem('postal_tags', JSON.stringify(updated));
    setNewTagName('');
    setNewTagColor('#3B82F6');
    setShowAddTag(false);
  };

  // タグ編集開始
  const startEditTag = (idx: number) => {
    setTagEditIdx(idx);
    setTagEditName(tags[idx].name);
    setTagEditColor(tags[idx].color);
  };

  // タグ編集保存
  const handleEditTag = async () => {
    if (tagEditIdx === null || !tagEditName.trim()) return;
    const oldName = tags[tagEditIdx].name;
    const newName = tagEditName.trim();
    const updated = tags.map((t, i) => i === tagEditIdx ? { name: newName, color: tagEditColor } : t);
    setTags(updated);
    localStorage.setItem('postal_tags', JSON.stringify(updated));

    // 既存のアイテムとグループのタグも更新
    const data = loadAllData();
    data.items = data.items.map(item => ({
      ...item,
      tags: item.tags.map(t => t === oldName ? newName : t)
    }));
    data.groups = data.groups.map(group => ({
      ...group,
      tags: group.tags.map(t => t === oldName ? newName : t)
    }));
    await saveAllData(data);

    setTagEditIdx(null);
    setTagEditName('');
    setTagEditColor('#3B82F6');
  };

  // タグ編集キャンセル
  const handleCancelEdit = () => {
    setTagEditIdx(null);
    setTagEditName('');
    setTagEditColor('#3B82F6');
  };

  // タグ削除
  const handleRemoveTag = async (idx: number) => {
    if (!window.confirm('このタグを削除しますか？')) return;
    const delName = tags[idx].name;
    const updated = tags.filter((_, i) => i !== idx);
    setTags(updated);
    localStorage.setItem('postal_tags', JSON.stringify(updated));

    // 既存のアイテムとグループからタグを削除
    const data = loadAllData();
    data.items = data.items.map(item => ({
      ...item,
      tags: item.tags.filter(t => t !== delName)
    }));
    data.groups = data.groups.map(group => ({
      ...group,
      tags: group.tags.filter(t => t !== delName)
    }));
    await saveAllData(data);
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
    setTagEditIdx,
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