export interface Location {
  lat: number;
  lon: number;
  address?: string;
}

export interface PhotoMetadata {
  dateTaken?: string;
  location?: Location;
  source: 'camera' | 'bulk' | 'import';
  filename: string;
}

export interface PhotoItem {
  id: string;
  image: string;
  ocrText: string;
  tags: string[];
  memo: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: PhotoMetadata;
  groupId?: string;
}

export interface PostalItemGroup {
  id: string;
  title: string;
  photos: PhotoItem[];
  tags: string[];
  memo: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Tag {
  name: string;
  color: string;
}

// インポート/エクスポート用の統合データ型
export interface StorageData {
  items: PhotoItem[];
  groups: PostalItemGroup[];
  tags: Tag[];
}

// アプリケーションの画面状態
export type Screen = 
  | { type: 'home' }
  | { type: 'detail'; itemId: string }
  | { type: 'detail-group'; groupId: string }
  | { type: 'add'; mode: 'unified' }
  | { type: 'sync' };

// アプリケーションの状態
export interface AppState {
  screen: Screen;
}

export interface HomeScreenProps {
  items: PhotoItem[];
  groups: PostalItemGroup[];
  searchQuery: string;
  selectedTags: string[];
  onSearchChange: (query: string) => void;
  onTagToggle: (tag: string) => void;
  onAddItem: (mode: 'single' | 'group') => void;
  onItemClick: (itemId: string) => void;
  onGroupClick: (groupId: string) => void;
  onBulkTagRename: (oldName: string, newName: string) => void;
  onImport: (data: any) => void;
  onExport: () => void;
}