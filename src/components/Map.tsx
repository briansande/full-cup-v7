'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import useShops from "@/src/hooks/useShops";
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
  const [dateDays, setDateDays] = useState<number | null>(null);
  const { shops, loading } = useShops(dateDays);
  
  const [RL, setRL] = useState<any | null>(null); // eslint-disable-line @typescript-eslint/no-explicit-any

  // Distance / "Near Me" filter state
  const [distanceActive, setDistanceActive] = useState<boolean>(false);
  const [distanceRadiusMiles, setDistanceRadiusMiles] = useState<number>(3); // default to 3 miles
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationPermission, setLocationPermission] = useState<'unknown' | 'prompt' | 'granted' | 'denied'>('unknown');
  const [locationError, setLocationError] = useState<string | null>(null);

  const DISTANCE_OPTIONS = [1, 3, 5, 10];
  
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

  function requestLocation() {
    if (!("geolocation" in navigator)) {
      setLocationError("Geolocation not supported by your browser.");
      setLocationPermission("denied");
      return;
    }
    setLocationError(null);
    setLocationPermission("prompt");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationPermission("granted");
      },
      (err) => {
        console.warn("Geolocation error:", err);
        setLocationError(err?.message ?? "Unable to retrieve location");
        setLocationPermission("denied");
        setUserLocation(null);
      },
      { enableHighAccuracy: false, maximumAge: 60 * 1000, timeout: 10000 }
    );
  }

  // Toggle distance filter: when enabling, request location immediately
  function setDistanceFilterEnabled(enabled: boolean) {
    setDistanceActive(enabled);
    if (enabled) {
      requestLocation();
    } else {
      // clear ephemeral user location when disabled
      setUserLocation(null);
      setLocationError(null);
      setLocationPermission("unknown");
    }
  }
  // Search and filter state
  const [searchText, setSearchText] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null); // null = All
  const DATE_FILTER_OPTIONS = [
    { label: '7 days', days: 7 },
    { label: '14 days', days: 14 },
    { label: '30 days', days: 30 },
    { label: '60 days', days: 60 },
  ];
  const STATUS_LABEL_MAP: Record<string, string> = {
    want_to_try: "Want to Try",
    visited: "Visited",
    favorite: "Favorites",
  };

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
  
  function clearFilters() {
    setSearchText("");
    setStatusFilter(null);
    setDateDays(null);
  }
  return (
    <div style={{ height: '100vh', width: '100%', position: 'relative' }}>
      {/* Controls overlay */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 1100,
          background: "rgba(255,255,255,0.95)",
          padding: 12,
          borderRadius: 8,
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <input
          aria-label="Search shops"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search shops by name"
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            minWidth: 220,
            outline: "none",
          }}
        />
  
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => setStatusFilter(null)}
            style={{
              padding: "8px 10px",
              borderRadius: 6,
              border: statusFilter === null ? "1px solid #111827" : "1px solid #d1d5db",
              background: statusFilter === null ? "#111827" : "#fff",
              color: statusFilter === null ? "#fff" : "#111827",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter("want_to_try")}
            style={{
              padding: "8px 10px",
              borderRadius: 6,
              border: statusFilter === "want_to_try" ? "1px solid #3b82f6" : "1px solid #d1d5db",
              background: statusFilter === "want_to_try" ? "#3b82f6" : "#fff",
              color: statusFilter === "want_to_try" ? "#fff" : "#111827",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Want to Try
          </button>
          <button
            onClick={() => setStatusFilter("visited")}
            style={{
              padding: "8px 10px",
              borderRadius: 6,
              border: statusFilter === "visited" ? "1px solid #10b981" : "1px solid #d1d5db",
              background: statusFilter === "visited" ? "#10b981" : "#fff",
              color: statusFilter === "visited" ? "#fff" : "#111827",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Visited
          </button>
          <button
            onClick={() => setStatusFilter("favorite")}
            style={{
              padding: "8px 10px",
              borderRadius: 6,
              border: statusFilter === "favorite" ? "1px solid #ef4444" : "1px solid #d1d5db",
              background: statusFilter === "favorite" ? "#ef4444" : "#fff",
              color: statusFilter === "favorite" ? "#fff" : "#111827",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Favorites
          </button>
        </div>

        {/* Date filter: Show New Shops */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginLeft: 6 }}>
          <div style={{ color: "#666", fontSize: 13, marginRight: 6 }}>Show New Shops</div>
          {DATE_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              onClick={() => setDateDays(opt.days)}
              style={{
                padding: "8px 10px",
                borderRadius: 6,
                border: dateDays === opt.days ? "2px solid #111827" : "1px solid #d1d5db",
                background: dateDays === opt.days ? "#111827" : "#fff",
                color: dateDays === opt.days ? "#fff" : "#111827",
                fontWeight: 600,
                cursor: "pointer",
              }}
              aria-pressed={dateDays === opt.days}
            >
              {opt.label}
            </button>
          ))}
          <button
            onClick={() => setDateDays(null)}
            style={{
              padding: "6px 8px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              background: "#fff",
              color: "#666",
              cursor: "pointer",
            }}
            title="Clear date filter"
          >
            Clear
          </button>
        </div>

        {/* Near Me / Distance filter (dropdown) */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginLeft: 6 }}>
          <div style={{ color: "#666", fontSize: 13 }}>Near Me</div>

          <select
            aria-label="Distance filter"
            value={distanceActive ? String(distanceRadiusMiles) : "off"}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "off") {
                setDistanceFilterEnabled(false);
              } else {
                const miles = Number(val);
                setDistanceRadiusMiles(miles);
                setDistanceFilterEnabled(true);
                if (!userLocation) requestLocation();
              }
            }}
            style={{
              padding: "8px 10px",
              borderRadius: 6,
              border: distanceActive ? "2px solid #111827" : "1px solid #d1d5db",
              background: "#fff",
              color: "#111827",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <option value="off">Off</option>
            {DISTANCE_OPTIONS.map((m) => (
              <option key={m} value={String(m)}>
                {m} mi
              </option>
            ))}
          </select>

          {/* Permission / status message */}
          {distanceActive && locationPermission === "denied" ? (
            <div style={{ color: "#b91c1c", fontSize: 13, marginLeft: 6 }}>
              Location denied. <button onClick={() => requestLocation()} style={{ textDecoration: "underline", background: "none", border: "none", color: "#111827", cursor: "pointer" }}>Retry</button>
            </div>
          ) : null}

          {distanceActive && locationPermission === "prompt" ? (
            <div style={{ color: "#666", fontSize: 13, marginLeft: 6 }}>
              Requesting location...
            </div>
          ) : null}

          {distanceActive && locationError ? (
            <div style={{ color: "#b91c1c", fontSize: 13, marginLeft: 6 }}>
              {locationError}
            </div>
          ) : null}
        </div>
  
        <button
          onClick={clearFilters}
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            background: "#fff",
            color: "#111827",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Clear Filters
        </button>
 
        {showDebugToggle ? (
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
      </div>

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