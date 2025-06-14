export interface PostalItem {
  id: string;
  image: string;
  ocrText: string;
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

export type Screen = 'home' | 'add' | 'detail';

export interface AppState {
  currentScreen: Screen;
  selectedItemId: string | null;
  searchQuery: string;
  selectedTags: string[];
}