import React from 'react';
import { Location } from '../types';
import { getNavigationOptions, getCurrentLocation, calculateDistance, formatDistance } from '../utils/navigation';

interface NavigationModalProps {
  destination: Location;
  onClose: () => void;
}

const NavigationModal: React.FC<NavigationModalProps> = ({ destination, onClose }) => {
  const [currentLocation, setCurrentLocation] = React.useState<{ lat: number; lon: number } | null>(null);
  const [distance, setDistance] = React.useState<string>('');
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchCurrentLocation = async () => {
      try {
        const location = await getCurrentLocation();
        setCurrentLocation(location);
        
        // 距離を計算
        const dist = calculateDistance(
          location.lat, 
          location.lon, 
          destination.lat, 
          destination.lon
        );
        setDistance(formatDistance(dist));
      } catch (error) {
        console.error('現在地の取得に失敗:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCurrentLocation();
  }, [destination]);

  const navigationOptions = getNavigationOptions(destination);

  const handleNavigation = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">ここへ行く</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {/* 目的地情報 */}
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <h3 className="font-medium text-blue-900">目的地</h3>
          <p className="text-sm text-blue-800">{destination.name || '指定された場所'}</p>
          {distance && (
            <p className="text-xs text-blue-600">現在地から約 {distance}</p>
          )}
        </div>

        {/* ナビゲーションオプション */}
        <div className="space-y-2">
          {navigationOptions.map((option, index) => (
            <button
              key={index}
              onClick={() => handleNavigation(option.action)}
              className="w-full p-3 text-left border rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3"
            >
              <span className="text-2xl">{option.icon}</span>
              <span className="font-medium">{option.name}</span>
            </button>
          ))}
        </div>

        {/* 現在地取得中の表示 */}
        {isLoading && (
          <div className="mt-4 text-center text-sm text-gray-500">
            現在地を取得中...
          </div>
        )}

        {/* 現在地が取得できない場合のメッセージ */}
        {!isLoading && !currentLocation && (
          <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
            <p className="text-sm text-yellow-800">
              現在地を取得できませんでした。位置情報の利用を許可してください。
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NavigationModal; 