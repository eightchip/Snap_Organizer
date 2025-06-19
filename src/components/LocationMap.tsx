import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PhotoItem, PostalItemGroup, Location } from '../types';

interface LocationMapProps {
  items: PhotoItem[];
  groups: PostalItemGroup[];
  onItemClick?: (itemId: string) => void;
  onGroupClick?: (groupId: string) => void;
  className?: string;
}

export const LocationMap: React.FC<LocationMapProps> = ({
  items,
  groups,
  onItemClick,
  onGroupClick,
  className = 'h-96'
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const currentLocationMarkerRef = useRef<L.Marker | null>(null);
  const [isMapInitialized, setIsMapInitialized] = useState(false);

  // 現在地を取得して表示する関数
  const showCurrentLocation = () => {
    const map = mapRef.current;
    if (!map) return;

    if ("geolocation" in navigator) {
      // 位置情報取得中の表示
      const loadingPopup = L.popup()
        .setLatLng(map.getCenter())
        .setContent('位置情報を取得中...')
        .openOn(map);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          console.log('現在地を取得:', latitude, longitude);
          
          // 現在地マーカーを更新
          if (currentLocationMarkerRef.current) {
            currentLocationMarkerRef.current.remove();
          }
          
          const icon = L.divIcon({
            className: 'current-location-marker',
            html: '<div class="ping"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });
          
          currentLocationMarkerRef.current = L.marker([latitude, longitude], { icon })
            .bindPopup('現在地')
            .addTo(map);

          // 地図を現在地にズーム
          map.setView([latitude, longitude], 15, {
            animate: true,
            duration: 1
          });
          
          loadingPopup.remove();
        },
        (error) => {
          console.error('位置情報の取得に失敗しました:', error);
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
          loadingPopup.setContent(errorMessage);
          setTimeout(() => loadingPopup.remove(), 3000);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } else {
      console.error('Geolocation APIがサポートされていません');
      const popup = L.popup()
        .setLatLng(map.getCenter())
        .setContent('お使いのブラウザは位置情報の取得に対応していません')
        .openOn(map);
      setTimeout(() => popup.remove(), 3000);
    }
  };

  // 地図の初期化
  useEffect(() => {
    if (!isMapInitialized && !mapRef.current) {
      // Leafletのデフォルトアイコンを設定
      L.Marker.prototype.options.icon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });

      // 地図を初期化（初期位置は東京）
      mapRef.current = L.map('map', {
        zoomControl: true,
        attributionControl: true
      }).setView([35.6812, 139.7671], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        crossOrigin: 'anonymous'
      }).addTo(mapRef.current);

      markersRef.current = L.layerGroup().addTo(mapRef.current);

      // 現在地表示ボタンを追加
      const locationControl = L.Control.extend({
        onAdd: function() {
          const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
          div.innerHTML = `
            <a href="#" title="現在地を表示" style="
              width: 30px;
              height: 30px;
              line-height: 30px;
              display: block;
              text-align: center;
              text-decoration: none;
              color: black;
              background-color: white;
              border-radius: 4px;
              box-shadow: 0 1px 5px rgba(0,0,0,0.65);
            ">
              📍
            </a>
          `;
          div.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            showCurrentLocation();
          };
          return div;
        }
      });

      new locationControl({ position: 'bottomright' }).addTo(mapRef.current);
      
      // 初期表示時に現在地を表示（少し遅延を入れて地図の初期化を待つ）
      setTimeout(showCurrentLocation, 1000);
      
      setIsMapInitialized(true);
    }
  }, [isMapInitialized]);

  // マーカーの更新
  useEffect(() => {
    if (!mapRef.current || !markersRef.current) return;

    // マーカーグループをクリア
    markersRef.current.clearLayers();

    // 位置情報を持つアイテムを収集
    const locations: Array<{ location: Location; type: 'item' | 'group'; id: string; title?: string }> = [];

    // 単体アイテムの位置情報を収集
    items.forEach(item => {
      if (item.metadata?.location) {
        locations.push({
          location: item.metadata.location,
          type: 'item',
          id: item.id,
          title: item.ocrText.slice(0, 30) + (item.ocrText.length > 30 ? '...' : '')
        });
      }
    });

    // グループの位置情報を収集
    groups.forEach(group => {
      group.photos.forEach(photo => {
        if (photo.metadata?.location) {
          locations.push({
            location: photo.metadata.location,
            type: 'group',
            id: group.id,
            title: group.title
          });
        }
      });
    });

    // マーカーを作成
    locations.forEach(({ location, type, id, title }) => {
      try {
        if (!isValidLocation(location)) {
          console.warn('無効な位置情報をスキップ:', location);
          return;
        }

        const marker = L.marker([location.lat, location.lon])
          .bindPopup(
            `<div class="p-2">
              <div class="font-bold">${type === 'group' ? 'グループ' : '写真'}</div>
              <div class="text-sm">${title || '無題'}</div>
            </div>`
          )
          .on('click', () => {
            if (type === 'item' && onItemClick) {
              onItemClick(id);
            } else if (type === 'group' && onGroupClick) {
              onGroupClick(id);
            }
          });

        marker.addTo(markersRef.current!);
      } catch (error) {
        console.error('マーカーの作成に失敗しました:', error);
      }
    });

    // 地図の表示範囲を調整
    if (locations.length > 0) {
      const validLatLngs = locations
        .filter(l => isValidLocation(l.location))
        .map(l => L.latLng(l.location.lat, l.location.lon));
      
      if (validLatLngs.length > 0) {
        const bounds = L.latLngBounds(validLatLngs);
        mapRef.current.fitBounds(bounds, { 
          padding: [50, 50],
          maxZoom: 15,
          animate: true,
          duration: 1
        });
      }
    }
  }, [items, groups, onItemClick, onGroupClick]);

  // 位置情報の妥当性チェック
  const isValidLocation = (location: Location): boolean => {
    return (
      location &&
      typeof location.lat === 'number' &&
      typeof location.lon === 'number' &&
      !isNaN(location.lat) &&
      !isNaN(location.lon) &&
      location.lat >= -90 &&
      location.lat <= 90 &&
      location.lon >= -180 &&
      location.lon <= 180
    );
  };

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      if (currentLocationMarkerRef.current) {
        currentLocationMarkerRef.current = null;
      }
      setIsMapInitialized(false);
    };
  }, []);

  return (
    <>
      <div id="map" className={className} />
      <style>{`
        .current-location-marker {
          position: relative;
        }
        .ping {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(38, 126, 255, 0.4);
          border: 2px solid #267EFF;
          animation: ping 1.5s ease-in-out infinite;
        }
        @keyframes ping {
          0% {
            transform: scale(0.8);
            opacity: 1;
          }
          70% {
            transform: scale(1.5);
            opacity: 0.3;
          }
          100% {
            transform: scale(0.8);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}; 