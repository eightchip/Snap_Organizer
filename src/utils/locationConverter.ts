interface LocationArea {
  name: string;
  lat_min: number;
  lat_max: number;
  lon_min: number;
  lon_max: number;
}

// 簡易地名辞書
const locationDictionary: LocationArea[] = [
  {
    name: "東京都港区",
    lat_min: 35.63,
    lat_max: 35.68,
    lon_min: 139.72,
    lon_max: 139.78
  },
  {
    name: "東京都渋谷区",
    lat_min: 35.64,
    lat_max: 35.69,
    lon_min: 139.68,
    lon_max: 139.73
  },
  // 他の地域も同様に追加可能
];

export const coordinatesToLocationName = (lat: number, lon: number): string | null => {
  const matchingArea = locationDictionary.find(area => 
    lat >= area.lat_min && lat <= area.lat_max &&
    lon >= area.lon_min && lon <= area.lon_max
  );
  
  return matchingArea?.name || null;
};

// 地名辞書の動的ロード用関数
export const loadLocationDictionary = async (url: string): Promise<void> => {
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (Array.isArray(data)) {
      // 型チェック
      const isValidLocationArea = (item: any): item is LocationArea => {
        return typeof item.name === 'string' &&
          typeof item.lat_min === 'number' &&
          typeof item.lat_max === 'number' &&
          typeof item.lon_min === 'number' &&
          typeof item.lon_max === 'number';
      };
      
      if (data.every(isValidLocationArea)) {
        // グローバル辞書を更新
        locationDictionary.length = 0;
        locationDictionary.push(...data);
      }
    }
  } catch (error) {
    console.error('Failed to load location dictionary:', error);
  }
};

// Nominatimのレスポンスから地名・ランドマークを優先的に抽出
export function extractDisplayLocationName(nominatimResult: any): string | null {
  if (!nominatimResult) return null;
  const address = nominatimResult.address || {};
  // 優先順: attraction, building, landmark, tourism, leisure, shop, amenity, road, suburb, city, town, village, state, country
  const candidates = [
    address.attraction,
    address.building,
    address.landmark,
    address.tourism,
    address.leisure,
    address.shop,
    address.amenity,
    address.road,
    address.neighbourhood,
    address.suburb,
    address.city,
    address.town,
    address.village,
    address.state,
    address.country
  ];
  // 最初に見つかったものを返す
  for (const c of candidates) {
    if (c && typeof c === 'string') return c;
  }
  // それでもなければdisplay_nameの先頭部分（カンマ区切りの最初）
  if (nominatimResult.display_name) {
    return nominatimResult.display_name.split(',')[0];
  }
  return null;
} 