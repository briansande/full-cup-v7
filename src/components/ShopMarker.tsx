'use client';
import React from 'react';
import Link from 'next/link';
import { Shop } from '@/src/types';
import { Marker, Popup } from 'react-leaflet';

type ShopMarkerProps = {
  shop: Shop;
  isSelected: boolean;
  onClick: () => void;
  markerRefs: React.MutableRefObject<Record<string, any>>;
  L: any;
  distanceActive: boolean;
  ICONS: Record<string, { iconUrl: string; iconRetinaUrl: string }>;
  shadowUrl: string;
};

export default function ShopMarker({
  shop,
  isSelected,
  onClick,
  markerRefs,
  L,
  distanceActive,
  ICONS,
  shadowUrl
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
      ref={(ref: any) => {
        if (ref) {
          markerRefs.current[shop.id] = ref;
        }
      }}
      eventHandlers={{
        click: () => {
          onClick();
        }
      }}
    >
      <Popup className="rounded-xl overflow-hidden shadow-lg">
        <div className="min-w-[160px] p-3">
          <div className="font-semibold text-[--cottage-primary]">{shop.name ?? "Unnamed shop"}</div>

            {distanceActive && (shop as any)._distanceMiles != null ? (
              <div className="mt-2 text-sm">
                Distance: <strong>{Number((shop as any)._distanceMiles).toFixed(2)} mi</strong>
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