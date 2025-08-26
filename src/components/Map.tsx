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
  
  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredShops = shops && shops.length > 0
    ? shops.filter((s: any) => {
        if (s.latitude == null || s.longitude == null) return false;
        // If a status filter is active, only include matching statuses (treat null as 'default' which won't match)
        if (statusFilter) {
          if ((s.status ?? "default") !== statusFilter) return false;
        }
        if (!normalizedSearch) return true;
        return (s.name ?? "").toLowerCase().includes(normalizedSearch);
      })
    : [];

  const filterCountMessage = (() => {
    const count = filteredShops ? filteredShops.length : 0;
    const statusLabel = statusFilter ? (STATUS_LABEL_MAP[statusFilter] ?? statusFilter) : null;
    if (dateDays) {
      if (statusLabel) {
        return `Showing ${count} ${statusLabel.toLowerCase()} shops added in last ${dateDays} days`;
      }
      return `Showing ${count} shops added in last ${dateDays} days`;
    }
    if (statusLabel) {
      return `Showing ${count} ${statusLabel.toLowerCase()} shops`;
    }
    return `Showing ${count} shops`;
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