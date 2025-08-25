'use client';
import React, { useEffect, useState } from 'react';
import useShops from "@/src/hooks/useShops";

/**
 * Lazy-load react-leaflet at runtime and set Leaflet marker image URLs to CDN,
 * preventing server-side import of Leaflet (which references `window`) and ensuring
 * default marker icons load correctly in the browser.
 */
export default function Map() {
  const position: [number, number] = [29.7604, -95.3698];
  const { shops, loading } = useShops();

  const [RL, setRL] = useState<any | null>(null); // eslint-disable-line @typescript-eslint/no-explicit-any

  useEffect(() => {
    let mounted = true;

    // Insert Leaflet CSS client-side from CDN
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);

    // Dynamically import react-leaflet and leaflet on the client
    (async () => {
      const mod = await import("react-leaflet");
      const L = await import("leaflet");

      // Configure default icon URLs to point to CDN so marker images load correctly
      try {
        // mergeOptions available on Icon.Default
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        });
      } catch (e) {
        // ignore if mergeOptions not available for some reason
      }

      if (!mounted) return;
      setRL({
        MapContainer: (mod as any).MapContainer,
        TileLayer: (mod as any).TileLayer,
        Marker: (mod as any).Marker,
        Popup: (mod as any).Popup,
      });
    })();

    return () => {
      mounted = false;
      if (link.parentNode) link.parentNode.removeChild(link);
    };
  }, []);

  if (!RL) {
    return (
      <div style={{ height: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>Loading map...</div>
      </div>
    );
  }

  const { MapContainer, TileLayer, Marker, Popup } = RL;

  return (
    <div style={{ height: '100vh', width: '100%', position: 'relative' }}>
      {loading ? (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            zIndex: 1000,
            background: 'rgba(255,255,255,0.9)',
            padding: '6px 8px',
            borderRadius: 6,
            fontSize: 12,
          }}
        >
          Loading shops...
        </div>
      ) : null}

      <MapContainer
        center={position}
        zoom={12}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {shops && shops.length > 0
          ? shops.map((s: any) => {
              if (s.latitude == null || s.longitude == null) return null;
              const pos: [number, number] = [s.latitude, s.longitude];
              return (
                <Marker key={s.id} position={pos}>
                  <Popup>{s.name ?? "Unnamed shop"}</Popup>
                </Marker>
              );
            })
          : null}
      </MapContainer>
    </div>
  );
}