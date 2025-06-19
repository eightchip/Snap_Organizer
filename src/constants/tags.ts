export const COLOR_PALETTE = [
  // 書類・文書関連
  { name: '請求書', color: '#3B82F6' },  // 青
  { name: '領収書', color: '#22C55E' },  // 緑
  { name: '契約書', color: '#A78BFA' },  // 紫
  { name: '申請書', color: '#F59E0B' },  // オレンジ
  { name: '通知', color: '#EC4899' },    // ピンク

  // 生活関連
  { name: '病院', color: '#EF4444' },    // 赤
  { name: '学校', color: '#06B6D4' },    // シアン
  { name: '住所', color: '#8B5CF6' },    // バイオレット
  { name: '保険', color: '#10B981' },    // エメラルド
  { name: 'メモ', color: '#6366F1' },    // インディゴ

  // 追加のカラーパレット（新規タグ用）
  { name: '赤', color: '#DC2626' },
  { name: '青', color: '#2563EB' },
  { name: '緑', color: '#059669' },
  { name: '黄', color: '#D97706' },
  { name: '紫', color: '#7C3AED' },
  { name: '橙', color: '#EA580C' },
  { name: '茶', color: '#92400E' },
  { name: 'ピンク', color: '#DB2777' },
  { name: 'シアン', color: '#0891B2' },
  { name: 'マゼンタ', color: '#BE185D' },
  { name: 'ライム', color: '#65A30D' },
  { name: 'ネイビー', color: '#1E40AF' },
  { name: 'オリーブ', color: '#4D7C0F' },
  { name: 'テール', color: '#0F766E' },
  { name: 'マルーン', color: '#9F1239' },
  { name: 'グレー', color: '#4B5563' },
  { name: '白', color: '#F9FAFB' },
];

export const DEFAULT_TAGS = COLOR_PALETTE.slice(0, 10); // 最初の10個を初期タグとして使用
export const MAX_TAGS = 40; // 最大タグ数 