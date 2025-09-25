'use client';
import React from 'react';
import type { DivIcon, DivIconOptions } from 'leaflet';
import type { MarkerProps, PopupProps } from 'react-leaflet';

type Location = { lat: number; lng: number } | null;

interface UserLocationMarkerProps {
  userLocation: Location;
  L: { DivIcon: new (options: DivIconOptions) => DivIcon };
  locationPermission: 'unknown' | 'prompt' | 'granted' | 'denied';
  Marker: React.ComponentType<MarkerProps>;
  Popup: React.ComponentType<PopupProps>;
}

export default function UserLocationMarker({ 
  userLocation, 
  L,
  locationPermission,
  Marker,
  Popup
}: UserLocationMarkerProps) {
  // If user location is not available, don't render the marker
  if (!userLocation) return null;

  // Icon for user's current location — circular div similar to Google Maps
  const userIcon = new L.DivIcon({
    html: `<div style="width:16px;height:16px;border-radius:50%;background:#1e88e5;box-shadow:0 0 8px rgba(30,136,229,0.6);border:3px solid rgba(255,0.95)"></div>`,
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -11],
  });

  return (
    <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon} zIndexOffset={1000}>
      <Popup className="rounded-lg">
        <div className="min-w-[120px] p-2">
          <div className="font-semibold">You are here</div>
          <div className="text-sm text-gray-600">
            {locationPermission === 'granted' ? 'Location shared' : 'Location'}
          </div>
        </div>
      </Popup>
    </Marker>
  );
}