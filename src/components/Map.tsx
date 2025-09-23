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
import MapFilterControls from "@/src/components/MapFilterControls";
import FilterCountMessage from "@/src/components/FilterCountMessage";
import MapLoadingIndicator from "@/src/components/MapLoadingIndicator";
import MapEvents from "@/src/components/MapEvents";
import ShopMarker from "@/src/components/ShopMarker";
import UserLocationMarker from "@/src/components/UserLocationMarker";
import { distanceMiles } from "@/src/lib/distance";
import type { Map as LeafletMap, LatLngBounds, Marker as LeafletMarker } from 'leaflet';
import type { MapContainerProps, TileLayerProps, MarkerProps, PopupProps } from 'react-leaflet';

// Extend Shop interface to include ephemeral _distanceMiles property
interface ShopWithDistance extends Shop {
  _distanceMiles?: number | null;
}

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
    MapContainer: React.ComponentType<MapContainerProps>;
    TileLayer: React.ComponentType<TileLayerProps>;
    Marker: React.ComponentType<MarkerProps>;
    Popup: React.ComponentType<PopupProps>;
    L: typeof import('leaflet');
    useMap: () => LeafletMap;
  } | null>(null);

  // Map bounds state
  const [mapBounds, setMapBounds] = useState<LatLngBounds | null>(null);
  
  // Stable callback to prevent infinite re-renders
  const updateMapBounds = useCallback((newBounds: LatLngBounds | null) => {
    setMapBounds((currentBounds: LatLngBounds | null) => {
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
  
  // Refs for map markers and map instance
 const markerRefs = useRef<Record<string, LeafletMarker<object>>>({});
  const mapRef = useRef<LeafletMap | null>(null);

  // If a shop is extremely close to the user's reported location, hide the shop marker
 // so the user's circular location indicator is the only visible marker. Value is miles.
  // Increased threshold to 0.2 miles (~320 meters) to avoid duplicate markers showing.
  const USER_HIDE_THRESHOLD_MILES = 0.2;

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
    
    return shops.filter((s: ShopWithDistance) => {
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
        (s as ShopWithDistance)._distanceMiles = d;
        if (typeof distanceRadiusMiles === "number" && d > distanceRadiusMiles) return false;
      } else {
        // ensure no stale distance is left
        (s as ShopWithDistance)._distanceMiles = null;
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
    
    return filteredShops.filter((s: ShopWithDistance) => {
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
        MapContainer: mod.MapContainer,
        TileLayer: mod.TileLayer,
        Marker: mod.Marker,
        Popup: mod.Popup,
        L,
        useMap: mod.useMap,
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

  const { MapContainer, TileLayer, Marker, Popup, L, useMap } = RL;
  
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

  return (
    <div className="h-[calc(100vh-60px)] w-full fixed top-[60px] left-0 relative">
      {/* Left Filter Sidebar - positioned absolutely over map */}
      <MapFilterControls
        isLeftSidebarVisible={isLeftSidebarVisible}
        toggleLeftSidebar={toggleLeftSidebar}
        filterChildren={
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
                    : 'bg-white text-[--cottage-neutral-dark] border-[--cottage-neutral-dark]/30 hover:shadow-md'
                }`}
                title="Toggle grid debug overlay (TEST MODE: 6 points)"
              >
                {debugVisible ? "Hide Debug (TEST MODE: 6 points)" : "Show Debug (TEST MODE: 6 points)"}
              </button>
            ) : null}
          />
        }
      />

      {/* Main Map Area - now takes full space */}
      <div className="h-full w-full relative cottage-map-container">
        {/* Filter count message */}
        <FilterCountMessage filterCountMessage={filterCountMessage} />

        {/* Loading indicator */}
        <MapLoadingIndicator loading={loading} />

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

          {RL && <MapEvents updateBounds={updateMapBounds} useMap={useMap} mapRef={mapRef} />}

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

                return (
                  <ShopMarker
                    key={s.id}
                    shop={s}
                    isSelected={selectedShopId === s.id}
                    onClick={() => handleMarkerClick(s)}
                    markerRefs={markerRefs}
                    L={L}
                    distanceActive={distanceActive}
                    ICONS={ICONS}
                    shadowUrl={shadowUrl}
                    Marker={Marker}
                    Popup={Popup}
                  />
                );
              })
            : null}

          {/* User location marker (rendered above other markers) */}
          <UserLocationMarker
            userLocation={userLocation}
            L={L}
            locationPermission={locationPermission}
            Marker={Marker}
            Popup={Popup}
          />

          {debugPoints ? (
            <GridDebugOverlay
              points={debugPoints}
              visible={debugVisible}
              modeLabel="TEST MODE: 6 points"
            />
          ) : null}
        </MapContainer>
      </div>

      {/* Right Shop Sidebar - positioned absolutely over map */}
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