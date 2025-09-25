'use client';
import React from 'react';
import Link from 'next/link';
import { Shop } from '@/src/types';
import type { Marker as LeafletMarker, LeafletEvent } from 'leaflet';
import type { MarkerProps, PopupProps } from 'react-leaflet';

type ShopMarkerProps = {
  shop: Shop;
  isSelected: boolean;
  onClick: () => void;
  markerRefs: React.MutableRefObject<Record<string, LeafletMarker>>;
 L: typeof import('leaflet');
  distanceActive: boolean;
  ICONS: Record<string, { iconUrl: string; iconRetinaUrl: string }>;
  shadowUrl: string;
  Marker: React.ComponentType<MarkerProps>;
  Popup: React.ComponentType<PopupProps>;
};

export default function ShopMarker({
  shop,
  isSelected,
  onClick,
  markerRefs,
  L,
  distanceActive,
  ICONS,
  shadowUrl,
  Marker,
  Popup
}: ShopMarkerProps) {
  // If shop coordinates are not available, don't render the marker
  if (shop.latitude == null || shop.longitude == null) return null;
  const pos: [number, number] = [shop.latitude, shop.longitude];

  // Pick correct icon for this shop's status
  const statusKey = shop.status ?? "default";
  const iconInfo = ICONS[statusKey] ?? ICONS.default;
  const icon = new L.Icon({
    iconUrl: iconInfo.iconUrl,
    iconRetinaUrl: iconInfo.iconRetinaUrl,
    shadowUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  return (
    <Marker 
      key={shop.id} 
      position={pos} 
      icon={icon}
      eventHandlers={{
        click: () => {
          onClick();
        },
        add: (event: LeafletEvent) => {
          // The target of the event should be the marker instance
          const marker = event.target as LeafletMarker;
          if (marker) {
            markerRefs.current[shop.id] = marker;
          }
        }
      }}
    >
      <Popup className="rounded-xl overflow-hidden shadow-lg">
        <div className="min-w-[160px] p-3">
          <div className="font-semibold text-[--cottage-primary]">{shop.name ?? "Unnamed shop"}</div>

            {distanceActive && (shop as Shop & { _distanceMiles?: number })._distanceMiles != null ? (
              <div className="mt-2 text-sm">
                Distance: <strong>{Number((shop as Shop & { _distanceMiles?: number })._distanceMiles).toFixed(2)} mi</strong>
              </div>
            ) : null}

            {shop.avgRating != null ? (
              <div className="mt-2">
                Overall: <strong className="text-yellow-600">{Number(shop.avgRating).toFixed(1)} ★</strong>
              </div>
            ) : null}

            <div className="mt-2 text-sm space-y-1">
              {shop.avgCoffeeQuality != null ? <div>Coffee: <strong className="text-[--cottage-accent]">{Number(shop.avgCoffeeQuality).toFixed(1)} ★</strong></div> : null}
              {shop.avgAtmosphere != null ? <div>Atmosphere: <strong className="text-[--cottage-accent]">{Number(shop.avgAtmosphere).toFixed(1)} ★</strong></div> : null}
              {shop.avgNoiseLevel != null ? <div>Noise level: <strong className="text-[--cottage-terracotta]">{Number(shop.avgNoiseLevel).toFixed(1)}</strong></div> : null}
              {shop.avgWifiQuality != null ? <div>WiFi: <strong className="text-[--cottage-accent]">{Number(shop.avgWifiQuality).toFixed(1)} ★</strong></div> : null}
              {shop.avgWorkFriendliness != null ? <div>Work friendly: <strong className="text-[--cottage-accent]">{Number(shop.avgWorkFriendliness).toFixed(1)} ★</strong></div> : null}
              {shop.avgService != null ? <div>Service: <strong className="text-[--cottage-accent]">{Number(shop.avgService).toFixed(1)} ★</strong></div> : null}
            </div>

            {/* Top tags preview (2-3) */}
            {shop.topTags && Array.isArray(shop.topTags) && shop.topTags.length > 0 ? (
              <div className="mt-3 flex gap-2 flex-wrap">
                {shop.topTags.slice(0,3).map((t) => (
                  <span key={t.tag_id} className="cottage-tag">
                    {t.tag_name}{t.total_votes > 0 ? ` +${t.total_votes}` : ''}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="mt-3">
              <Link 
                href={`/shop/${shop.id}`} 
                className="text-[--cottage-primary] hover:text-[--cottage-terracotta] font-medium text-sm transition-colors"
              >
                View Details
              </Link>
            </div>
        </div>
      </Popup>
    </Marker>
  );
}