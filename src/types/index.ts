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

export type Screen = 'home' | 'add' | 'detail' | 'add-group';

export interface AppState {
  currentScreen: Screen;
  selectedItemId: string | null;
  searchQuery: string;
  selectedTags: string[];
}