import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Location } from '../types';

interface LocationEditorModalProps {
  initialLocation: Location | null;
  onClose: () => void;
  onSave: (location: Location) => void;
}

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  class: string;
}

const LocationEditorModal: React.FC<LocationEditorModalProps> = ({ initialLocation, onClose, onSave }) => {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(initialLocation);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const map = L.map('location-editor-map').setView(
      initialLocation ? [initialLocation.lat, initialLocation.lon] : [35.6812, 139.7671],
      initialLocation ? 16 : 13
    );

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      updateMarker({ lat, lon: lng, name: 'クリックした場所' });
      setShowResults(false);
    });

    mapRef.current = map;

    if (initialLocation) {
      updateMarker(initialLocation);
    }
    
    return () => {
      map.remove();
    };
  }, []);

  const updateMarker = (location: Location) => {
    setSelectedLocation(location);
    if (markerRef.current) {
      markerRef.current.setLatLng([location.lat, location.lon]);
    } else {
      markerRef.current = L.marker([location.lat, location.lon]).addTo(mapRef.current!);
    }
    markerRef.current.bindPopup(location.name || `緯度: ${location.lat.toFixed(4)}, 経度: ${location.lon.toFixed(4)}`).openPopup();
    mapRef.current?.setView([location.lat, location.lon], 16);
  };
  
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setShowResults(false);
    
    try {
      // より詳細な検索パラメータを追加
      const params = new URLSearchParams({
        format: 'json',
        q: searchQuery,
        limit: '10', // 最大10件の結果
        addressdetails: '1', // 詳細な住所情報を含める
        countrycodes: 'jp', // 日本に限定
        viewbox: '129.0,30.0,146.0,46.0', // 日本の範囲
        bounded: '1'
      });
      
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
      const results = await response.json();

      if (results && results.length > 0) {
        setSearchResults(results);
        setShowResults(true);
      } else {
        alert('場所が見つかりませんでした。別のキーワードで検索してください。');
      }
    } catch (error) {
      console.error('検索エラー:', error);
      alert('検索中にエラーが発生しました。');
    } finally {
      setIsSearching(false);
    }
  };

  const handleResultSelect = (result: SearchResult) => {
    const location: Location = {
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      name: result.display_name,
    };
    updateMarker(location);
    setShowResults(false);
    setSearchQuery(result.display_name);
  };

  const handleSave = () => {
    if (selectedLocation) {
      onSave(selectedLocation);
    }
  };

  const getResultIcon = (result: SearchResult) => {
    switch (result.class) {
      case 'amenity':
        return '🏪';
      case 'shop':
        return '🛍️';
      case 'restaurant':
        return '🍽️';
      case 'cafe':
        return '☕';
      case 'place':
        return '📍';
      default:
        return '📍';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded-lg shadow-xl w-full max-w-4xl h-5/6 flex flex-col">
        <h2 className="text-xl font-bold mb-4">位置情報を編集</h2>
        
        {/* 検索フォーム */}
        <form onSubmit={handleSearch} className="flex mb-2 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="地名や施設名で検索（例：心斎橋 ラーメン、渋谷 スターバックス）..."
            className="flex-grow p-2 border rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button 
            type="submit" 
            disabled={isSearching}
            className="p-2 bg-blue-500 text-white rounded-r-md hover:bg-blue-600 disabled:bg-gray-400"
          >
            {isSearching ? '検索中...' : '検索'}
          </button>
        </form>

        {/* 検索結果 */}
        {showResults && searchResults.length > 0 && (
          <div className="mb-4 max-h-48 overflow-y-auto border rounded-lg">
            {searchResults.map((result, index) => (
              <div
                key={index}
                onClick={() => handleResultSelect(result)}
                className="p-3 border-b cursor-pointer hover:bg-gray-50 last:border-b-0"
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg">{getResultIcon(result)}</span>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{result.display_name}</div>
                    <div className="text-xs text-gray-500">
                      種類: {result.class} - {result.type}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 地図 */}
        <div id="location-editor-map" className="flex-grow rounded border"></div>
        
        {/* 選択された場所の情報 */}
        {selectedLocation && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <h3 className="font-medium text-blue-900">選択された場所:</h3>
            <p className="text-sm text-blue-800">{selectedLocation.name}</p>
            <p className="text-xs text-blue-600">
              緯度: {selectedLocation.lat.toFixed(6)}, 経度: {selectedLocation.lon.toFixed(6)}
            </p>
          </div>
        )}

        {/* 操作ボタン */}
        <div className="mt-4 flex justify-end space-x-2">
          <button onClick={onClose} className="p-2 bg-gray-300 rounded hover:bg-gray-400">
            キャンセル
          </button>
          <button 
            onClick={handleSave} 
            className="p-2 bg-green-500 text-white rounded hover:bg-green-600" 
            disabled={!selectedLocation}
          >
            この場所を保存
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationEditorModal; 