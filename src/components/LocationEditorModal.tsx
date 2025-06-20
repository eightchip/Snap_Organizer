import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Location } from '../types';

interface LocationEditorModalProps {
  initialLocation: Location | null;
  onClose: () => void;
  onSave: (location: Location) => void;
}

const LocationEditorModal: React.FC<LocationEditorModalProps> = ({ initialLocation, onClose, onSave }) => {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(initialLocation);
  const [searchQuery, setSearchQuery] = useState('');

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
      updateMarker({ lat, lon: lng, name: 'Custom Location' });
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
    markerRef.current.bindPopup(location.name || `Lat: ${location.lat.toFixed(4)}, Lon: ${location.lon.toFixed(4)}`).openPopup();
    mapRef.current?.setView([location.lat, location.lon], 16);
  };
  
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
    const results = await response.json();

    if (results && results.length > 0) {
      const bestResult = results[0];
      const location: Location = {
        lat: parseFloat(bestResult.lat),
        lon: parseFloat(bestResult.lon),
        name: bestResult.display_name,
      };
      updateMarker(location);
    } else {
      alert('場所が見つかりませんでした。');
    }
  };

  const handleSave = () => {
    if (selectedLocation) {
      onSave(selectedLocation);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded-lg shadow-xl w-full max-w-2xl h-4/5 flex flex-col">
        <h2 className="text-xl font-bold mb-4">位置情報を編集</h2>
        <form onSubmit={handleSearch} className="flex mb-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="地名や施設名で検索..."
            className="flex-grow p-2 border rounded-l-md"
          />
          <button type="submit" className="p-2 bg-blue-500 text-white rounded-r-md">検索</button>
        </form>
        <div id="location-editor-map" className="flex-grow rounded"></div>
        <div className="mt-4 flex justify-end space-x-2">
          <button onClick={onClose} className="p-2 bg-gray-300 rounded">キャンセル</button>
          <button onClick={handleSave} className="p-2 bg-green-500 text-white rounded" disabled={!selectedLocation}>
            この場所を保存
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationEditorModal; 