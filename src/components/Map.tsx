'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import useShops from "@/src/hooks/useShops";
import useFilters from "@/src/hooks/useFilters";
import FilterControls from "@/src/components/FilterControls";
import { generateGrid, GridPoint } from "@/src/lib/grid";
import GridDebugOverlay, { DebugToggle } from "@/src/components/GridDebugOverlay";

/**
 * Lazy-load react-leaflet at runtime and set Leaflet marker image URLs to CDN,
 * preventing server-side import of Leaflet (which references `window`) and ensuring
 * default marker icons load correctly in the browser.
 *
 * Additionally create color variants for markers based on user's status:
 * - want_to_try -> blue
 * - visited -> green
 * - favorite -> red
 * - default (no status) -> grey
 */
export default function Map() {
  const position: [number, number] = [29.7604, -95.3698];
  const filters = useFilters();
  const { shops, loading } = useShops(filters.dateDays);
  
  const [RL, setRL] = useState<any | null>(null); // eslint-disable-line @typescript-eslint/no-explicit-any

  
  // If a shop is extremely close to the user's reported location, hide the shop marker
  // so the user's circular location indicator is the only visible marker. Value is miles.
  // Increased threshold to 0.2 miles (~320 meters) to avoid duplicate markers showing.
  const USER_HIDE_THRESHOLD_MILES = 0.2;

  // Haversine formula to compute distance in miles between two lat/lng pairs
  function distanceMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371e3; // metres
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1);
    const Δλ = toRad(lon2 - lon1);

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const meters = R * c;
    const miles = meters / 1609.344;
    return miles;
  }

  // Location and distance filter logic moved to shared useFilters hook.
  // Shared filter hook state & actions
  const {
    searchText,
    setSearchText,
    statusFilter,
    setStatusFilter,
    dateDays,
    setDateDays,
    DATE_FILTER_OPTIONS,
    DISTANCE_OPTIONS,
    distanceActive,
    setDistanceFilterEnabled,
    distanceRadiusMiles,
    setDistanceRadiusMiles,
    userLocation,
    locationPermission,
    locationError,
    requestLocation,
    clearFilters,
    STATUS_LABEL_MAP,
  } = filters;

  // Grid debug overlay state (lazy loaded)
  const [debugVisible, setDebugVisible] = useState<boolean>(false);
  const [debugPoints, setDebugPoints] = useState<GridPoint[] | null>(null);

  // Admin guard for showing debug controls. If no explicit admin check exists,
  // enable toggle only when NEXT_PUBLIC_GRID_DEBUG_ADMIN === "true"
  const showDebugToggle = process.env.NEXT_PUBLIC_GRID_DEBUG_ADMIN === "true";
  
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
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        });
      } catch (e) {
        // ignore if mergeOptions not available for some reason
      }

      if (!mounted) return;

      // Provide react-leaflet components and the leaflet module (L) for icon creation
      setRL({
        MapContainer: (mod as any).MapContainer,
        TileLayer: (mod as any).TileLayer,
        Marker: (mod as any).Marker,
        Popup: (mod as any).Popup,
        L,
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

  const { MapContainer, TileLayer, Marker, Popup, L } = RL;
  
  // Icon sources for colored markers (from pointhi/leaflet-color-markers)
  const ICONS: Record<string, { iconUrl: string; iconRetinaUrl: string }> = {
    default: {
      iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-grey.png",
      iconRetinaUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png",
    },
    want_to_try: {
      iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png",
      iconRetinaUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
    },
    visited: {
      iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
      iconRetinaUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
    },
    favorite: {
      iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
      iconRetinaUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
    },
  };
  
  const shadowUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png";

  // Icon for user's current location — circular div similar to Google Maps
  const userIcon = new L.DivIcon({
    html: `<div style="width:16px;height:16px;border-radius:50%;background:#1e88e5;box-shadow:0 0 8px rgba(30,136,229,0.6);border:3px solid rgba(255,255,255,0.95)"></div>`,
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -11],
  });
  
  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredShops = shops && shops.length > 0
    ? shops.filter((s: any) => {
        if (s.latitude == null || s.longitude == null) return false;
        // If a status filter is active, only include matching statuses (treat null as 'default' which won't match)
        if (statusFilter) {
          if ((s.status ?? "default") !== statusFilter) return false;
        }

        // If distance filter is enabled and we have a user location, compute distance and filter accordingly.
        if (distanceActive) {
          if (!userLocation) {
            // If userLocation not available yet, exclude until location is resolved.
            return false;
          }
          const d = distanceMiles(userLocation.lat, userLocation.lng, s.latitude, s.longitude);
          // attach ephemeral distance for display in popups
          (s as any)._distanceMiles = d;
          if (typeof distanceRadiusMiles === "number" && d > distanceRadiusMiles) return false;
        } else {
          // ensure no stale distance is left
          (s as any)._distanceMiles = null;
        }

        if (!normalizedSearch) return true;
        return (s.name ?? "").toLowerCase().includes(normalizedSearch);
      })
    : [];

  const filterCountMessage = (() => {
    const count = filteredShops ? filteredShops.length : 0;
    const statusLabel = statusFilter ? (STATUS_LABEL_MAP[statusFilter] ?? statusFilter) : null;
    const distanceSuffix = distanceActive ? ` within ${distanceRadiusMiles} miles` : "";
    if (dateDays) {
      if (statusLabel) {
        return `Showing ${count} ${statusLabel.toLowerCase()} shops added in last ${dateDays} days${distanceSuffix}`;
      }
      return `Showing ${count} shops added in last ${dateDays} days${distanceSuffix}`;
    }
    if (statusLabel) {
      return `Showing ${count} ${statusLabel.toLowerCase()} shops${distanceSuffix}`;
    }
    return `Showing ${count} shops${distanceSuffix}`;
  })();
  
  return (
    <div style={{ height: '100vh', width: '100%', position: 'relative' }}>
      {/* Controls overlay */}
      <FilterControls
        searchText={searchText}
        setSearchText={setSearchText}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        dateDays={dateDays}
        setDateDays={setDateDays}
        DATE_FILTER_OPTIONS={DATE_FILTER_OPTIONS}
        distanceActive={distanceActive}
        setDistanceFilterEnabled={setDistanceFilterEnabled}
        DISTANCE_OPTIONS={DISTANCE_OPTIONS}
        distanceRadiusMiles={distanceRadiusMiles}
        setDistanceRadiusMiles={setDistanceRadiusMiles}
        userLocation={userLocation}
        locationPermission={locationPermission}
        locationError={locationError}
        requestLocation={requestLocation}
        clearFilters={clearFilters}
        renderDebugButton={showDebugToggle ? (
          <button
            onClick={async () => {
              const next = !debugVisible;
              setDebugVisible(next);
              // Lazy-generate grid points only when turning the overlay ON for the first time
              if (next && !debugPoints) {
                const pts = generateGrid('test');
                setDebugPoints(pts);
                // Log the required boundaries message when overlay is enabled
                console.log('GridDebug: TEST MODE: 6 points — boundaries: north=29.78, south=29.74, east=-95.35, west=-95.39');
              }
            }}
            style={{
              padding: "8px 10px",
              borderRadius: 6,
              border: debugVisible ? "1px solid #111827" : "1px solid #d1d5db",
              background: debugVisible ? "#111827" : "#fff",
              color: debugVisible ? "#fff" : "#111827",
              fontWeight: 600,
              cursor: "pointer",
            }}
            title="Toggle grid debug overlay (TEST MODE: 6 points)"
          >
            {debugVisible ? "Hide Debug (TEST MODE: 6 points)" : "Show Debug (TEST MODE: 6 points)"}
          </button>
        ) : null}
      />

      {/* Filter count message */}
      <div
        style={{
          position: "absolute",
          top: 76,
          left: 12,
          zIndex: 1100,
          background: "rgba(255,255,255,0.95)",
          padding: "6px 10px",
          borderRadius: 6,
          fontSize: 12,
          color: "#333",
        }}
      >
        {filterCountMessage}
      </div>
  
      {loading ? (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            zIndex: 1000,
            background: "rgba(255,255,255,0.9)",
            padding: "6px 8px",
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
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
  
        {filteredShops && filteredShops.length > 0
          ? filteredShops.map((s: any) => {
              if (s.latitude == null || s.longitude == null) return null;
              const pos: [number, number] = [s.latitude, s.longitude];

              // If a shop is effectively at the user's location, skip rendering the shop marker
              // so we don't show a duplicate marker beneath the user marker.
              if (userLocation) {
                try {
                  // If exact coordinates match, hide the shop marker immediately.
                  if (s.latitude === userLocation.lat && s.longitude === userLocation.lng) return null;

                  const dToUser = distanceMiles(userLocation.lat, userLocation.lng, s.latitude, s.longitude);
                  // hide shops extremely close to user's marker (threshold in USER_HIDE_THRESHOLD_MILES)
                  if (dToUser < USER_HIDE_THRESHOLD_MILES) return null;
                } catch {
                  // ignore distance computation errors and continue rendering
                }
              }
  
              // Pick correct icon for this shop's status
              const statusKey = s.status ?? "default";
              const iconInfo = ICONS[statusKey] ?? ICONS.default;
              const icon = new L.Icon({
                iconUrl: iconInfo.iconUrl,
                iconRetinaUrl: iconInfo.iconRetinaUrl,
                shadowUrl,
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41],
              });
  
              return (
                <Marker key={s.id} position={pos} icon={icon}>
                  <Popup>
                    <div style={{ minWidth: 160 }}>
                      <div style={{ fontWeight: 600 }}>{s.name ?? "Unnamed shop"}</div>
  
                      {distanceActive && (s as any)._distanceMiles != null ? (
                        <div style={{ marginTop: 6 }}>
                          Distance: <strong>{Number((s as any)._distanceMiles).toFixed(2)} mi</strong>
                        </div>
                      ) : null}
  
                      {s.avgRating != null ? (
                        <div style={{ marginTop: 6 }}>
                          Average rating: <strong>{Number(s.avgRating).toFixed(1)} ★</strong>
                        </div>
                      ) : null}
                      <div style={{ marginTop: 6 }}>
                        <Link href={`/shop/${s.id}`}>View Details</Link>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })
          : null}

        {/* User location marker (rendered above other markers) */}
        {userLocation ? (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon} zIndexOffset={1000}>
            <Popup>
              <div style={{ minWidth: 120 }}>
                <div style={{ fontWeight: 600 }}>You are here</div>
                <div style={{ fontSize: 13, color: '#666' }}>
                  {locationPermission === 'granted' ? 'Location shared' : 'Location'}
                </div>
              </div>
            </Popup>
          </Marker>
        ) : null}

        {debugPoints ? (
          <GridDebugOverlay
            points={debugPoints}
            visible={debugVisible}
            modeLabel="TEST MODE: 6 points"
          />
        ) : null}
      </MapContainer>
    </div>
  );
}