'use client';
import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import useShops from "@/src/hooks/useShops";
import useFilters from "@/src/hooks/useFilters";
import FilterControls from "@/src/components/FilterControls";
import { generateGrid, GridPoint } from "@/src/lib/grid";
import GridDebugOverlay, { DebugToggle } from "@/src/components/GridDebugOverlay";
import { Shop } from "@/src/types";
import ShopSidebar from "@/src/components/ShopSidebar";

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
  
  const [RL, setRL] = useState<{
  MapContainer: any;
  TileLayer: any;
  Marker: any;
  Popup: any;
  L: any;
  useMap: any;
} | null>(null);

  // Map bounds state
  const [mapBounds, setMapBounds] = useState<any>(null);
  
  // Stable callback to prevent infinite re-renders
  const updateMapBounds = useCallback((newBounds: any) => {
    setMapBounds((currentBounds: any) => {
      // Only update if bounds have actually changed
      if (!currentBounds || !newBounds) return newBounds;
      
      // Compare bounds to prevent unnecessary updates
      const currentSW = currentBounds.getSouthWest();
      const currentNE = currentBounds.getNorthEast();
      const newSW = newBounds.getSouthWest();
      const newNE = newBounds.getNorthEast();
      
      const threshold = 0.0001; // Small threshold to prevent micro-updates
      const hasChanged = 
        Math.abs(currentSW.lat - newSW.lat) > threshold ||
        Math.abs(currentSW.lng - newSW.lng) > threshold ||
        Math.abs(currentNE.lat - newNE.lat) > threshold ||
        Math.abs(currentNE.lng - newNE.lng) > threshold;
      
      return hasChanged ? newBounds : currentBounds;
    });
  }, []);

  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isLeftSidebarVisible, setIsLeftSidebarVisible] = useState(true);
  
  // Toggle right sidebar (shop cards)
  const toggleSidebar = () => {
    setIsSidebarVisible(!isSidebarVisible);
  };
  
  // Toggle left sidebar (filters)
  const toggleLeftSidebar = () => {
    setIsLeftSidebarVisible(!isLeftSidebarVisible);
  };
  
  // Toggle left sidebar (filters)
  
  // Refs for map markers and map instance
  const markerRefs = useRef<Record<string, any>>({});
  const mapRef = useRef<any>(null);

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
    // tag filter state
    selectedTags,
    setSelectedTags,
  } = filters;

  // Grid debug overlay state (lazy loaded)
  const [debugVisible, setDebugVisible] = useState<boolean>(false);
  const [debugPoints, setDebugPoints] = useState<GridPoint[] | null>(null);

  // Admin guard for showing debug controls. If no explicit admin check exists,
  // enable toggle only when NEXT_PUBLIC_GRID_DEBUG_ADMIN === "true"
  const showDebugToggle = process.env.NEXT_PUBLIC_GRID_DEBUG_ADMIN === "true";
  
  // Move all useMemo hooks here, before any conditional returns
  const normalizedSearch = useMemo(() => searchText.trim().toLowerCase(), [searchText]);
  
  // Filter shops based on all active filters
  const filteredShops = useMemo(() => {
    if (!shops || shops.length === 0) return [];
    
    return shops.filter((s: Shop) => {
      if (s.latitude == null || s.longitude == null) return false;

      // Tag filter (AND logic): if selectedTags present, require shop.tagIds includes all selected tags
      if (selectedTags && Array.isArray(selectedTags) && selectedTags.length > 0) {
        const shopTagIds: string[] = Array.isArray(s.tagIds) ? s.tagIds.map(String) : [];
        // if shop lacks tags or doesn't include all selected tags, filter out
        if (!shopTagIds || !selectedTags.every((t: string) => shopTagIds.includes(String(t)))) {
          return false;
        }
      }

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
    });
  }, [shops, selectedTags, statusFilter, distanceActive, userLocation, distanceRadiusMiles, normalizedSearch]);

  // Filter shops based on map bounds (what's visible)
  const visibleShops = useMemo(() => {
    // If we don't have map bounds yet, show all filtered shops (initial load)
    if (!filteredShops || filteredShops.length === 0) return [];
    if (!mapBounds) return filteredShops;
    
    return filteredShops.filter((s: Shop) => {
      if (s.latitude == null || s.longitude == null) return false;
      
      // Check if shop is within map bounds
      const lat = s.latitude;
      const lng = s.longitude;
      
      return (
        lat >= mapBounds.getSouthWest().lat &&
        lat <= mapBounds.getNorthEast().lat &&
        lng >= mapBounds.getSouthWest().lng &&
        lng <= mapBounds.getNorthEast().lng
      );
    });
  }, [filteredShops, mapBounds]);

  const filterCountMessage = useMemo(() => {
    const count = filteredShops ? filteredShops.length : 0;
    const statusLabel = statusFilter ? (STATUS_LABEL_MAP[statusFilter] ?? statusFilter) : null;
    const distanceSuffix = distanceActive ? ` within ${distanceRadiusMiles} miles` : "";
    const tagSuffix = selectedTags && selectedTags.length > 0 ? ` filtered by ${selectedTags.length} tag${selectedTags.length > 1 ? 's' : ''}` : '';
    if (dateDays) {
      if (statusLabel) {
        return `Showing ${count} ${statusLabel.toLowerCase()} shops added in last ${dateDays} days${distanceSuffix}${tagSuffix}`;
      }
      return `Showing ${count} shops added in last ${dateDays} days${distanceSuffix}${tagSuffix}`;
    }
    if (statusLabel) {
      return `Showing ${count} ${statusLabel.toLowerCase()} shops${distanceSuffix}${tagSuffix}`;
    }
    return `Showing ${count} shops${distanceSuffix}${tagSuffix}`;
  }, [filteredShops, statusFilter, STATUS_LABEL_MAP, distanceActive, distanceRadiusMiles, selectedTags, dateDays]);
  
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
        useMap: (mod as any).useMap,
      });
    })();

    return () => {
      mounted = false;
      if (link.parentNode) link.parentNode.removeChild(link);
    };
  }, []);

  // MapEvents component to handle map events (fixed to prevent infinite re-renders)
  function MapEvents({ updateBounds }: { updateBounds: (bounds: any) => void }) {
    const map = RL?.useMap();
    
    useEffect(() => {
      if (!map) return;
      
      // Store the map instance for later use
      mapRef.current = map;
      
      // Attach event listeners
      const handleBoundsUpdate = () => {
        if (mapRef.current) {
          const newBounds = mapRef.current.getBounds();
          updateBounds(newBounds);
        }
      };
      
      // Set initial bounds
      handleBoundsUpdate();
      
      map.on('moveend', handleBoundsUpdate);
      map.on('zoomend', handleBoundsUpdate);
      
      // Cleanup
      return () => {
        map.off('moveend', handleBoundsUpdate);
        map.off('zoomend', handleBoundsUpdate);
      };
    }, [map, updateBounds]); // Include updateBounds in dependencies since it's stable
    
    return null;
  }

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
  
  // Handle shop selection from sidebar
  const handleShopSelect = (shop: Shop) => {
    setSelectedShopId(shop.id);
    
    // Open popup for selected shop
    if (markerRefs.current[shop.id]) {
      markerRefs.current[shop.id].openPopup();
    }
    
    // Pan map to selected shop
    if (mapRef.current && shop.latitude !== null && shop.longitude !== null) {
      mapRef.current.setView([shop.latitude, shop.longitude], mapRef.current.getZoom());
    }
  };
  
  // Handle shop selection from map marker click
  const handleMarkerClick = (shop: Shop) => {
    setSelectedShopId(shop.id);
    
    // Pan map to selected shop
    if (mapRef.current && shop.latitude !== null && shop.longitude !== null) {
      mapRef.current.setView([shop.latitude, shop.longitude], mapRef.current.getZoom());
    }
  };
  
  // Close sidebar

  // State for left sidebar visibility

  return (
    <div className="h-[calc(100vh-60px)] w-full fixed top-[60px] left-0 flex">
      {/* Left Filter Sidebar */}
      {isLeftSidebarVisible && (
        <div className="h-full z-[1100] bg-white shadow-lg flex flex-col w-80 cottage-map-container">
          <div className="p-4 border-b border-[--cottage-neutral-light] flex justify-between items-center">
            <h2 className="text-lg font-semibold text-[--cottage-primary]">Filters</h2>
            <button 
              onClick={toggleLeftSidebar}
              className="p-2 rounded-full hover:bg-[--cottage-secondary] transition-colors"
              aria-label="Collapse filter panel"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[--cottage-neutral-dark]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="overflow-y-auto flex-grow p-4">
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
              // Tag filter props
              selectedTags={selectedTags}
              setSelectedTags={setSelectedTags}
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
                  className={`px-3 py-2 rounded-lg font-medium transition-all ${
                    debugVisible 
                      ? 'bg-[--cottage-neutral-dark] text-white border border-[--cottage-neutral-dark]' 
                      : 'bg-white text-[--cottage-neutral-dark] border border-[--cottage-neutral-dark]/30 hover:shadow-md'
                  }`}
                  title="Toggle grid debug overlay (TEST MODE: 6 points)"
                >
                  {debugVisible ? "Hide Debug (TEST MODE: 6 points)" : "Show Debug (TEST MODE: 6 points)"}
                </button>
              ) : null}
            />
          </div>
        </div>
      )}
      
      {/* Collapse/Expand Button - positioned at midpoint of sidebar */}
      <button
        onClick={toggleLeftSidebar}
        className="absolute top-1/2 z-[1200] bg-white shadow-lg rounded-r-xl p-3 transform -translate-y-1/2 hover:bg-[--cottage-secondary] transition-all duration-200 border-l border-t border-b border-[--cottage-neutral-light]"
        aria-label={isLeftSidebarVisible ? "Collapse filter panel" : "Expand filter panel"}
        style={{ left: isLeftSidebarVisible ? '20rem' : '0' }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[--cottage-primary]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isLeftSidebarVisible ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"} />
        </svg>
      </button>
      
      {/* Main Map Area */}
      <div className="h-full flex-grow relative cottage-map-container">
        {/* Filter count message */}
        <div
          className="absolute top-4 left-4 z-[1100] bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg text-sm text-[--cottage-neutral-dark] shadow-md"
        >
          {filterCountMessage}
        </div>
    
        {loading ? (
          <div
            className="absolute top-4 left-4 z-[1000] bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-lg text-sm shadow-md flex items-center gap-2"
          >
            <div className="w-4 h-4 border-2 border-[--cottage-primary] border-t-transparent rounded-full animate-spin"></div>
            Loading shops...
          </div>
        ) : null}
    
        <MapContainer
          center={position}
          zoom={12}
          scrollWheelZoom={true}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {RL && <MapEvents updateBounds={updateMapBounds} />}
    
          {visibleShops && visibleShops.length > 0
            ? visibleShops.map((s: Shop) => {
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
                  shadowSize: [41, 41]
                });
    
                return (
                  <Marker 
                    key={s.id} 
                    position={pos} 
                    icon={icon}
                    ref={(ref: any) => {
                      if (ref) {
                        markerRefs.current[s.id] = ref;
                      }
                    }}
                    eventHandlers={{
                      click: () => {
                        handleMarkerClick(s);
                      }
                    }}
                  >
                    <Popup className="rounded-xl overflow-hidden shadow-lg">
                      <div className="min-w-[160px] p-3">
                        <div className="font-semibold text-[--cottage-primary]">{s.name ?? "Unnamed shop"}</div>
      
                          {distanceActive && (s as any)._distanceMiles != null ? (
                            <div className="mt-2 text-sm">
                              Distance: <strong>{Number((s as any)._distanceMiles).toFixed(2)} mi</strong>
                            </div>
                          ) : null}
      
                          {s.avgRating != null ? (
                            <div className="mt-2">
                              Overall: <strong className="text-yellow-600">{Number(s.avgRating).toFixed(1)} ★</strong>
                            </div>
                          ) : null}
      
                          <div className="mt-2 text-sm space-y-1">
                            {s.avgCoffeeQuality != null ? <div>Coffee: <strong className="text-[--cottage-accent]">{Number(s.avgCoffeeQuality).toFixed(1)} ★</strong></div> : null}
                            {s.avgAtmosphere != null ? <div>Atmosphere: <strong className="text-[--cottage-accent]">{Number(s.avgAtmosphere).toFixed(1)} ★</strong></div> : null}
                            {s.avgNoiseLevel != null ? <div>Noise level: <strong className="text-[--cottage-terracotta]">{Number(s.avgNoiseLevel).toFixed(1)}</strong></div> : null}
                            {s.avgWifiQuality != null ? <div>WiFi: <strong className="text-[--cottage-accent]">{Number(s.avgWifiQuality).toFixed(1)} ★</strong></div> : null}
                            {s.avgWorkFriendliness != null ? <div>Work friendly: <strong className="text-[--cottage-accent]">{Number(s.avgWorkFriendliness).toFixed(1)} ★</strong></div> : null}
                            {s.avgService != null ? <div>Service: <strong className="text-[--cottage-accent]">{Number(s.avgService).toFixed(1)} ★</strong></div> : null}
                          </div>
    
                          {/* Top tags preview (2-3) */}
                          {s.topTags && Array.isArray(s.topTags) && s.topTags.length > 0 ? (
                            <div className="mt-3 flex gap-2 flex-wrap">
                              {s.topTags.slice(0,3).map((t) => (
                                <span key={t.tag_id} className="cottage-tag">
                                  {t.tag_name}{t.total_votes > 0 ? ` +${t.total_votes}` : ''}
                                </span>
                              ))}
                            </div>
                          ) : null}
    
                          <div className="mt-3">
                            <Link 
                              href={`/shop/${s.id}`} 
                              className="text-[--cottage-primary] hover:text-[--cottage-terracotta] font-medium text-sm transition-colors"
                            >
                              View Details
                            </Link>
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
              <Popup className="rounded-lg">
                <div className="min-w-[120px] p-2">
                  <div className="font-semibold">You are here</div>
                  <div className="text-sm text-gray-600">
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
      
      {/* Right Shop Sidebar */}
      <ShopSidebar 
        shops={visibleShops}
        onShopSelect={handleShopSelect}
        isVisible={isSidebarVisible}
        onToggle={toggleSidebar}
        selectedShopId={selectedShopId}
      />
    </div>
  );
}