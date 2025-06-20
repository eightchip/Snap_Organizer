import { useState, useEffect, useCallback } from 'react';
import { PhotoItem, PostalItemGroup } from '../types';

// Tauri APIの条件付きインポート
let invoke: any = null;
try {
  // ブラウザ環境でのみTauri APIをインポート
  if (typeof window !== 'undefined' && (window as any).__TAURI__) {
    const tauriModule = require('@tauri-apps/api/tauri');
    invoke = tauriModule.invoke;
  }
} catch (error) {
  console.warn('Tauri API not available:', error);
}

export interface SearchQuery {
  query: string;
  fields?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  tags?: string[];
  limit?: number;
}

export interface SearchResult {
  id: string;
  score: number;
  highlights: string[];
  matchedFields: string[];
}

export interface SearchHistoryItem {
  query: string;
  timestamp: Date;
  resultCount: number;
}

// フォールバック検索機能（Tauriが利用できない場合）
const fallbackSearch = (items: PhotoItem[], groups: PostalItemGroup[], query: SearchQuery): SearchResult[] => {
  const results: SearchResult[] = [];
  const searchTerm = query.query.toLowerCase();
  
  // アイテムの検索
  items.forEach(item => {
    let score = 0;
    const highlights: string[] = [];
    const matchedFields: string[] = [];
    
    // OCRテキストの検索
    if (item.ocrText?.toLowerCase().includes(searchTerm)) {
      score += 3;
      highlights.push(`OCR: ${item.ocrText}`);
      matchedFields.push('ocr_text');
    }
    
    // メモの検索
    if (item.memo?.toLowerCase().includes(searchTerm)) {
      score += 2;
      highlights.push(`メモ: ${item.memo}`);
      matchedFields.push('memo');
    }
    
    // タグの検索
    if (item.tags?.some(tag => tag.toLowerCase().includes(searchTerm))) {
      score += 1;
      highlights.push(`タグ: ${item.tags.join(', ')}`);
      matchedFields.push('tags');
    }
    
    // 位置情報の検索
    if (item.metadata?.location?.name?.toLowerCase().includes(searchTerm)) {
      score += 2;
      highlights.push(`位置: ${item.metadata.location.name}`);
      matchedFields.push('location_name');
    }
    
    if (score > 0) {
      results.push({
        id: item.id,
        score,
        highlights,
        matchedFields,
      });
    }
  });
  
  // グループの検索
  groups.forEach(group => {
    let score = 0;
    const highlights: string[] = [];
    const matchedFields: string[] = [];
    
    // グループタイトルの検索
    if (group.title?.toLowerCase().includes(searchTerm)) {
      score += 2;
      highlights.push(`タイトル: ${group.title}`);
      matchedFields.push('group_title');
    }
    
    // グループメモの検索
    if (group.memo?.toLowerCase().includes(searchTerm)) {
      score += 1;
      highlights.push(`メモ: ${group.memo}`);
      matchedFields.push('memo');
    }
    
    // グループ内の写真の検索
    group.photos.forEach(photo => {
      if (photo.ocrText?.toLowerCase().includes(searchTerm)) {
        score += 1;
        highlights.push(`写真OCR: ${photo.ocrText}`);
        matchedFields.push('ocr_text');
      }
    });
    
    if (score > 0) {
      results.push({
        id: group.id,
        score,
        highlights,
        matchedFields,
      });
    }
  });
  
  // スコア順でソート
  return results.sort((a, b) => b.score - a.score).slice(0, query.limit || 20);
};

export const useSearch = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [useTauri, setUseTauri] = useState(false);

  // Tauriが利用可能かチェック
  useEffect(() => {
    setUseTauri(!!invoke);
    setIsInitialized(true);
  }, []);

  // 検索エンジンの初期化
  const initializeSearchEngine = useCallback(async () => {
    if (!useTauri) {
      setIsInitialized(true);
      return;
    }

    try {
      await invoke('init_search_engine');
      setIsInitialized(true);
      setError(null);
    } catch (err) {
      setError(`検索エンジンの初期化に失敗しました: ${err}`);
      console.error('Search engine initialization failed:', err);
    }
  }, [useTauri]);

  // アイテムを検索インデックスに追加
  const addItemToIndex = useCallback(async (item: PhotoItem) => {
    if (!isInitialized || !useTauri) return;

    try {
      const searchableItem = {
        id: item.id,
        ocrText: item.ocrText,
        memo: item.memo,
        tags: item.tags,
        locationName: item.metadata?.location?.name,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        groupTitle: null,
        imagePath: item.image,
      };

      await invoke('add_item_to_index', { item: searchableItem });
    } catch (err) {
      console.error('Failed to add item to search index:', err);
    }
  }, [isInitialized, useTauri]);

  // グループを検索インデックスに追加
  const addGroupToIndex = useCallback(async (group: PostalItemGroup) => {
    if (!isInitialized || !useTauri) return;

    try {
      for (const photo of group.photos) {
        const searchableItem = {
          id: photo.id,
          ocrText: photo.ocrText,
          memo: photo.memo,
          tags: photo.tags,
          locationName: photo.metadata?.location?.name,
          createdAt: photo.createdAt.toISOString(),
          updatedAt: photo.updatedAt.toISOString(),
          groupTitle: group.title,
          imagePath: photo.image,
        };

        await invoke('add_item_to_index', { item: searchableItem });
      }
    } catch (err) {
      console.error('Failed to add group to search index:', err);
    }
  }, [isInitialized, useTauri]);

  // アイテムを検索インデックスから更新
  const updateItemInIndex = useCallback(async (item: PhotoItem) => {
    if (!isInitialized || !useTauri) return;

    try {
      const searchableItem = {
        id: item.id,
        ocrText: item.ocrText,
        memo: item.memo,
        tags: item.tags,
        locationName: item.metadata?.location?.name,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        groupTitle: null,
        imagePath: item.image,
      };

      await invoke('update_item_in_index', { item: searchableItem });
    } catch (err) {
      console.error('Failed to update item in search index:', err);
    }
  }, [isInitialized, useTauri]);

  // アイテムを検索インデックスから削除
  const deleteItemFromIndex = useCallback(async (itemId: string) => {
    if (!isInitialized || !useTauri) return;

    try {
      await invoke('delete_item_from_index', { itemId });
    } catch (err) {
      console.error('Failed to delete item from search index:', err);
    }
  }, [isInitialized, useTauri]);

  // 検索実行
  const search = useCallback(async (query: SearchQuery, items?: PhotoItem[], groups?: PostalItemGroup[]) => {
    if (!isInitialized) {
      setError('検索エンジンが初期化されていません');
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      let results: SearchResult[] = [];

      if (useTauri) {
        // Tauri検索エンジンを使用
        const searchQuery = {
          query: query.query,
          fields: query.fields,
          dateFrom: query.dateFrom?.toISOString(),
          dateTo: query.dateTo?.toISOString(),
          tags: query.tags,
          limit: query.limit || 20,
        };

        results = await invoke('search_items', { query: searchQuery });
      } else if (items && groups) {
        // フォールバック検索を使用
        results = fallbackSearch(items, groups, query);
      } else {
        throw new Error('フォールバック検索にはアイテムとグループのデータが必要です');
      }
      
      setSearchResults(results);

      // 検索履歴に追加
      const historyItem: SearchHistoryItem = {
        query: query.query,
        timestamp: new Date(),
        resultCount: results.length,
      };

      setSearchHistory(prev => {
        const newHistory = [historyItem, ...prev.slice(0, 9)];
        return newHistory;
      });

    } catch (err) {
      setError(`検索に失敗しました: ${err}`);
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  }, [isInitialized, useTauri]);

  // 検索インデックスをクリア
  const clearIndex = useCallback(async () => {
    if (!isInitialized || !useTauri) return;

    try {
      await invoke('clear_search_index');
      setSearchResults([]);
    } catch (err) {
      console.error('Failed to clear search index:', err);
    }
  }, [isInitialized, useTauri]);

  // 検索統計を取得
  const getSearchStats = useCallback(async () => {
    if (!isInitialized || !useTauri) return null;

    try {
      const stats = await invoke('get_search_stats');
      return stats;
    } catch (err) {
      console.error('Failed to get search stats:', err);
      return null;
    }
  }, [isInitialized, useTauri]);

  // 検索履歴をクリア
  const clearSearchHistory = useCallback(() => {
    setSearchHistory([]);
  }, []);

  // 検索履歴から検索を実行
  const searchFromHistory = useCallback((historyItem: SearchHistoryItem, items?: PhotoItem[], groups?: PostalItemGroup[]) => {
    search({ query: historyItem.query }, items, groups);
  }, [search]);

  // 初期化
  useEffect(() => {
    initializeSearchEngine();
  }, [initializeSearchEngine]);

  return {
    // 状態
    isInitialized,
    isSearching,
    searchResults,
    searchHistory,
    error,
    useTauri,

    // アクション
    search,
    addItemToIndex,
    addGroupToIndex,
    updateItemInIndex,
    deleteItemFromIndex,
    clearIndex,
    getSearchStats,
    clearSearchHistory,
    searchFromHistory,
  };
}; 