import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { PhotoItem, PostalItemGroup } from '../types';

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

export const useSearch = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 検索エンジンの初期化
  const initializeSearchEngine = useCallback(async () => {
    try {
      await invoke('init_search_engine');
      setIsInitialized(true);
      setError(null);
    } catch (err) {
      setError(`検索エンジンの初期化に失敗しました: ${err}`);
      console.error('Search engine initialization failed:', err);
    }
  }, []);

  // アイテムを検索インデックスに追加
  const addItemToIndex = useCallback(async (item: PhotoItem) => {
    if (!isInitialized) return;

    try {
      const searchableItem = {
        id: item.id,
        ocrText: item.ocrText,
        memo: item.memo,
        tags: item.tags,
        locationName: item.metadata?.location?.name,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        groupTitle: null, // 単体アイテムの場合はnull
        imagePath: item.image,
      };

      await invoke('add_item_to_index', { item: searchableItem });
    } catch (err) {
      console.error('Failed to add item to search index:', err);
    }
  }, [isInitialized]);

  // グループを検索インデックスに追加
  const addGroupToIndex = useCallback(async (group: PostalItemGroup) => {
    if (!isInitialized) return;

    try {
      // グループ内の各写真をインデックスに追加
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
  }, [isInitialized]);

  // アイテムを検索インデックスから更新
  const updateItemInIndex = useCallback(async (item: PhotoItem) => {
    if (!isInitialized) return;

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
  }, [isInitialized]);

  // アイテムを検索インデックスから削除
  const deleteItemFromIndex = useCallback(async (itemId: string) => {
    if (!isInitialized) return;

    try {
      await invoke('delete_item_from_index', { itemId });
    } catch (err) {
      console.error('Failed to delete item from search index:', err);
    }
  }, [isInitialized]);

  // 検索実行
  const search = useCallback(async (query: SearchQuery) => {
    if (!isInitialized) {
      setError('検索エンジンが初期化されていません');
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const searchQuery = {
        query: query.query,
        fields: query.fields,
        dateFrom: query.dateFrom?.toISOString(),
        dateTo: query.dateTo?.toISOString(),
        tags: query.tags,
        limit: query.limit || 20,
      };

      const results: SearchResult[] = await invoke('search_items', { query: searchQuery });
      
      setSearchResults(results);

      // 検索履歴に追加
      const historyItem: SearchHistoryItem = {
        query: query.query,
        timestamp: new Date(),
        resultCount: results.length,
      };

      setSearchHistory(prev => {
        const newHistory = [historyItem, ...prev.slice(0, 9)]; // 最新10件を保持
        return newHistory;
      });

    } catch (err) {
      setError(`検索に失敗しました: ${err}`);
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  }, [isInitialized]);

  // 検索インデックスをクリア
  const clearIndex = useCallback(async () => {
    if (!isInitialized) return;

    try {
      await invoke('clear_search_index');
      setSearchResults([]);
    } catch (err) {
      console.error('Failed to clear search index:', err);
    }
  }, [isInitialized]);

  // 検索統計を取得
  const getSearchStats = useCallback(async () => {
    if (!isInitialized) return null;

    try {
      const stats = await invoke('get_search_stats');
      return stats;
    } catch (err) {
      console.error('Failed to get search stats:', err);
      return null;
    }
  }, [isInitialized]);

  // 検索履歴をクリア
  const clearSearchHistory = useCallback(() => {
    setSearchHistory([]);
  }, []);

  // 検索履歴から検索を実行
  const searchFromHistory = useCallback((historyItem: SearchHistoryItem) => {
    search({ query: historyItem.query });
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