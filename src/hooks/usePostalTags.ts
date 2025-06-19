import { useState, useEffect } from 'react';

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

  // タグ変更時にlocalStorageに保存
  useEffect(() => {
    localStorage.setItem('postal_tags', JSON.stringify(tags));
  }, [tags]);

  // タグ追加
  const handleAddTag = () => {
    if (!newTagName.trim()) return;
    const newTag = { name: newTagName.trim(), color: newTagColor };
    const updated = [...tags, newTag];
    setTags(updated);
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
  const handleEditTag = () => {
    if (tagEditIdx === null || !tagEditName.trim()) return;
    const oldName = tags[tagEditIdx].name;
    const newName = tagEditName.trim();
    const updated = tags.map((t, i) => i === tagEditIdx ? { name: newName, color: tagEditColor } : t);
    setTags(updated);
    setTagEditIdx(null);
    setTagEditName('');
    setTagEditColor('#3B82F6');
    return { oldName, newName }; // タグ名変更時の情報を返す
  };

  // タグ編集キャンセル
  const handleCancelEdit = () => {
    setTagEditIdx(null);
    setTagEditName('');
    setTagEditColor('#3B82F6');
  };

  // タグ削除
  const handleRemoveTag = (idx: number) => {
    if (!window.confirm('このタグを削除しますか？')) return;
    const delName = tags[idx].name;
    const updated = tags.filter((_, i) => i !== idx);
    setTags(updated);
    return delName; // 削除したタグ名を返す
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
    tagEditColor,
    handleAddTag,
    startEditTag,
    handleEditTag,
    handleCancelEdit,
    handleRemoveTag
  };
}; 