import { Location } from '../types';

export interface NavigationOptions {
  destination: Location;
  mode?: 'driving' | 'walking' | 'transit' | 'bicycling';
  avoid?: 'tolls' | 'highways' | 'ferries';
}

export interface CurrentLocation {
  lat: number;
  lon: number;
  accuracy?: number;
}

// 現在地を取得する関数
export const getCurrentLocation = (): Promise<CurrentLocation> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation APIがサポートされていません'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      (error) => {
        let errorMessage = '位置情報の取得に失敗しました';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = '位置情報の利用が許可されていません';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = '位置情報を取得できませんでした';
            break;
          case error.TIMEOUT:
            errorMessage = '位置情報の取得がタイムアウトしました';
            break;
        }
        reject(new Error(errorMessage));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
};

// Google Mapsでの経路ナビゲーション
export const openGoogleMapsNavigation = (options: NavigationOptions) => {
  const { destination, mode = 'driving' } = options;
  const url = `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lon}&travelmode=${mode}`;
  window.open(url, '_blank');
};

// Apple Mapsでの経路ナビゲーション（iOS/macOS）
export const openAppleMapsNavigation = (options: NavigationOptions) => {
  const { destination, mode = 'driving' } = options;
  const url = `http://maps.apple.com/?daddr=${destination.lat},${destination.lon}&dirflg=${mode === 'walking' ? 'w' : mode === 'transit' ? 'r' : 'd'}`;
  window.open(url, '_blank');
};

// 汎用的なナビゲーション（デバイスに応じて最適なアプリを選択）
export const openNavigation = async (options: NavigationOptions) => {
  try {
    // 現在地を取得
    const currentLocation = await getCurrentLocation();
    
    // デバイスを検出
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isMac = /Mac/.test(navigator.userAgent);
    
    if (isIOS || isMac) {
      // iOS/macOSの場合はApple Mapsを優先
      openAppleMapsNavigation(options);
    } else {
      // その他の場合はGoogle Maps
      openGoogleMapsNavigation(options);
    }
  } catch (error) {
    console.error('ナビゲーションエラー:', error);
    // フォールバック: Google Mapsを使用
    openGoogleMapsNavigation(options);
  }
};

// 複数のナビゲーションアプリから選択できるモーダル用のオプション
export const getNavigationOptions = (destination: Location) => {
  return [
    {
      name: 'Google Maps',
      icon: '🗺️',
      action: () => openGoogleMapsNavigation({ destination })
    },
    {
      name: 'Apple Maps',
      icon: '🍎',
      action: () => openAppleMapsNavigation({ destination })
    },
    {
      name: '徒歩で',
      icon: '🚶',
      action: () => openGoogleMapsNavigation({ destination, mode: 'walking' })
    },
    {
      name: '公共交通機関',
      icon: '🚇',
      action: () => openGoogleMapsNavigation({ destination, mode: 'transit' })
    },
    {
      name: '自転車',
      icon: '🚲',
      action: () => openGoogleMapsNavigation({ destination, mode: 'bicycling' })
    }
  ];
};

// 距離を計算する関数（簡易版）
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // 地球の半径（km）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// 距離を人間が読みやすい形式でフォーマット
export const formatDistance = (distance: number): string => {
  if (distance < 1) {
    return `${Math.round(distance * 1000)}m`;
  } else {
    return `${distance.toFixed(1)}km`;
  }
}; 