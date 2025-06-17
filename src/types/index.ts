export interface PostalItem {
  id: string;
  image: string;
  ocrText: string;
  tags: string[];
  memo: string;
  createdAt: Date;
  updatedAt: Date;
  groupId?: string;
}

export interface PhotoItem {
  id: string;
  image: string;
  ocrText: string;
  createdAt: Date;
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
  id: string;
  name: string;
  color: string;
  count: number;
}

export type Screen = 'home' | 'add' | 'detail' | 'add-group' | 'detail-group';

export interface AppState {
  currentScreen: Screen;
  selectedItemId: string | null;
  searchQuery: string;
  selectedTags: string[];
}

export interface HomeScreenProps {
  items: PostalItem[];
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