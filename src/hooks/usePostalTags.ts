import { useState, useEffect } from 'react';
import { DEFAULT_TAGS } from '../constants/tags';

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
  const [tags, setTags] = useState(() => {
    const saved = localStorage.getItem('postal_tags');
    if (saved) {
      // 既存のタグのみを使う（DEFAULT_TAGSはマージしない）
      return JSON.parse(saved);
    }
    // 初回のみDEFAULT_TAGSをセット
    localStorage.setItem('postal_tags', JSON.stringify(DEFAULT_TAGS));
    return DEFAULT_TAGS;
  });

  const [showAddTag, setShowAddTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3B82F6');
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
  const handleEditTag = () => {
    if (tagEditIdx === null || !tagEditName.trim()) return;
    const updated = tags.map((t: Tag, i: number) => 
      i === tagEditIdx ? { name: tagEditName.trim(), color: tagEditColor } : t
    );
    setTags(updated);
    localStorage.setItem('postal_tags', JSON.stringify(updated));
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
  const handleRemoveTag = (idx: number) => {
    if (!window.confirm('このタグを削除しますか？')) return;
    const updated = tags.filter((_: Tag, i: number) => i !== idx);
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