export const COLOR_PALETTE = [
  // 書類・文書関連
  { name: '仕事', color: '#3B82F6' },  // 青
  { name: '趣味', color: '#22C55E' },  // 緑
  { name: '旅行', color: '#A78BFA' },  // 紫
  { name: '食事', color: '#F59E0B' },  // オレンジ
  { name: '趣味', color: '#EC4899' },    // ピンク
  { name: '営業第一部', color: '#EF4444' },    // 赤
  { name: '営業第二部', color: '#06B6D4' },    // シアン
  { name: '経営企画部', color: '#8B5CF6' },    // バイオレット
  { name: '経理部', color: '#10B981' },    // エメラルド
  { name: '総務部', color: '#6366F1' },    // インディゴ

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