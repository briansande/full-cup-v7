'use client';
import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import useShops from '@/src/hooks/useShops';
import FilterControls from '@/src/components/filters/FilterControls';
import useFilters from '@/src/hooks/useFilters';
import { supabase } from '@/src/lib/supabase';

// Move SlotSpinner out to top-level so React preserves its identity across Page re-renders.
// Keeping it file-local (but top-level) avoids remounting which caused the UI to fall
// back to the initial shop name after the parent updated state.
type SimpleShop = { id: string; name?: string | null };

function SlotSpinner({
  shops,
  excludeId,
  duration = 1800,
  onFinish,
}: {
  shops: SimpleShop[];
  excludeId?: string | null;
  duration?: number;
  onFinish: (id: string | null) => void;
}) {
  const [display, setDisplay] = useState<string>('');
  const [spinning, setSpinning] = useState(false);
  const [finalName, setFinalName] = useState<string | null>(null);
  const animationRef = useRef<number | null>(null);
  // keep final id stable when chosen so re-renders don't affect it
  const finalIdRef = useRef<string | null>(null);

  const getRandomCandidate = () => {
    if (!shops || shops.length === 0) return null;
    if (shops.length === 1) return shops[0].id;
    let tries = 0;
    while (tries < 10) {
      const idx = Math.floor(Math.random() * shops.length);
      const id = shops[idx].id;
      if (id !== excludeId) return id;
      tries++;
    }
    return shops[Math.floor(Math.random() * shops.length)].id;
  };

  const start = () => {
    if (!shops || !shops.length || spinning) return;
    setSpinning(true);
    setFinalName(null);

    // Immediately begin fast text cycling
    const startTime = Date.now();
    let lastIdx = -1;
    animationRef.current = window.setInterval(() => {
      if (!shops || shops.length === 0) return;
      let idx = Math.floor(Math.random() * shops.length);
      if (shops.length > 1 && idx === lastIdx) idx = (idx + 1) % shops.length;
      lastIdx = idx;
      setDisplay(shops[idx].name ?? 'Unnamed');

      if (Date.now() - startTime >= duration) {
        if (animationRef.current) {
          clearInterval(animationRef.current);
          animationRef.current = null;
        }

        const finalId = getRandomCandidate();
        finalIdRef.current = finalId;
        const finalShop = shops.find((s) => s.id === finalId) ?? null;
        const finalShopName = finalShop ? finalShop.name ?? 'Unnamed' : 'Unnamed';

        setDisplay(finalShopName);
        setFinalName(finalShopName);
        setSpinning(false);

        setTimeout(() => {
          onFinish(finalIdRef.current ?? finalId);
        }, 120);
      }
    }, 70);
  };

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
    };
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div
        aria-live="polite"
        style={{
          width: 320,
          maxWidth: '70vw',
          height: 56,
          borderRadius: 10,
          border: '2px solid #eee',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fff',
          boxShadow: spinning ? '0 6px 18px rgba(0,0,0,0.12)' : '0 4px 8px rgba(0,0,0,0.06)',
          transition: 'box-shadow 220ms ease, transform 220ms ease',
          transform: spinning ? 'translateY(-2px)' : 'none',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: spinning ? '#333' : '#0b5',
            padding: '4px 8px',
            transition: 'color 200ms ease, transform 220ms ease',
            transform: finalName ? 'scale(1.02)' : 'none',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
          }}
        >
          {
            display !== ''
              ? display
              : (finalName
                  ?? (shops && shops.length
                      ? (shops.find((s) => s.id === finalIdRef.current)?.name ?? shops[0].name ?? 'Unnamed')
                      : 'No shops'))
          }
        </div>

        <div
          aria-hidden
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 10,
            height: 10,
            borderRadius: 6,
            background: spinning ? '#06f' : finalName ? '#0b5' : '#ccc',
            boxShadow: spinning ? '0 0 12px rgba(6,92,255,0.35)' : finalName ? '0 0 10px rgba(10,200,100,0.2)' : 'none',
            transition: 'background 220ms ease, box-shadow 220ms ease',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={start}
          aria-pressed={spinning}
          disabled={spinning || !shops || !shops.length}
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            border: 'none',
            background: spinning ? '#888' : '#2563eb',
            color: '#fff',
            fontWeight: 600,
            cursor: spinning ? 'not-allowed' : 'pointer',
            boxShadow: spinning ? 'none' : '0 6px 18px rgba(37,99,235,0.18)',
            transition: 'transform 120ms ease, box-shadow 120ms ease',
            minWidth: 96,
          }}
        >
          {spinning ? 'Spinning…' : 'Spin'}
        </button>
      </div>
    </div>
  );
}
export default function Page() {
  const {
    searchText,
    statusFilter,
    dateDays,
    distanceActive,
    distanceRadiusMiles,
    userLocation,
    locationPermission,
    locationError,
    filterError,
    DATE_FILTER_OPTIONS,
    DISTANCE_OPTIONS,
    STATUS_LABEL_MAP,
    setSearchText,
    setStatusFilter,
    setDateDays,
    setDistanceRadiusMiles,
    setDistanceFilterEnabled,
    requestLocation,
    clearFilters,
    // tag filter state
    selectedTags,
    setSelectedTags,
    getDBFilterParams,
  } = useFilters();

  const { shops, loading, error } = useShops(dateDays);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  type ShopDetail = {
    id: string;
    name?: string | null;
    address?: string | null;
    formatted_address?: string | null;
    phone?: string | null;
    website?: string | null;
    google_rating?: number | null;
    price_level?: number | null;
    // opening_hours can be heterogeneous from Google Places; keep as unknown and use type guards below
    opening_hours?: unknown | null;
    photos?: string[] | null;
  };

  // Type guards for opening_hours shape
  function isOpeningHoursWithWeekdayText(v: unknown): v is { weekday_text: string[] } {
    if (!v || typeof v !== 'object') return false;
    const val = (v as Record<string, unknown>)['weekday_text'];
    return Array.isArray(val) && val.every((item) => typeof item === 'string');
  }

  function isOpeningHoursWithOpenNow(v: unknown): v is { open_now: boolean } {
    if (!v || typeof v !== 'object') return false;
    const val = (v as Record<string, unknown>)['open_now'];
    return typeof val === 'boolean';
  }
  const [detail, setDetail] = useState<ShopDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const shopList = shops ?? [];

  // Haversine distance helper (miles)
  function computeDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 3958.8; // Earth radius in miles
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  const filteredShops = shopList.filter((s) => {
    if (!s) return false;

    // Tag filter (AND logic): require shop to have all selected tags
    if (selectedTags && Array.isArray(selectedTags) && selectedTags.length > 0) {
      const shopTagIds: string[] = Array.isArray((s as any).tagIds) ? (s as any).tagIds.map(String) : [];
      if (!selectedTags.every((t) => shopTagIds.includes(String(t)))) return false;
    }

    // Status filter
    if (statusFilter && s.status !== statusFilter) return false;

    // Search text (name)
    if (searchText && searchText.trim().length > 0) {
      const name = (s.name ?? '').toLowerCase();
      if (!name.includes(searchText.trim().toLowerCase())) return false;
    }

    // Distance filter
    if (distanceActive) {
      // If user opted into distance filter but we don't have a userLocation yet,
      // treat as no match until location is available (mirrors map UX).
      if (!userLocation) return false;
      if (s.latitude == null || s.longitude == null) return false;
      const dist = computeDistanceMiles(userLocation.lat, userLocation.lng, s.latitude, s.longitude);
      if (dist > distanceRadiusMiles) return false;
    }

    return true;
  });

  function pickRandom(excludeId?: string | null) {
    if (!filteredShops.length) return null;
    if (filteredShops.length === 1) return filteredShops[0].id;
    let tries = 0;
    while (tries < 10) {
      const idx = Math.floor(Math.random() * filteredShops.length);
      const id = filteredShops[idx].id;
      if (id !== excludeId) return id;
      tries++;
    }
    // fallback to any random
    return filteredShops[Math.floor(Math.random() * filteredShops.length)].id;
  }


  const handleSpinnerFinish = (id: string | null) => {
    setSelectedId(id);
  };

  // Try Another uses the same spinner animation but excludes current selection
  // Render a temporary spinner when user requests "Try Another" so it uses same animation logic.
  const spinnerRef = useRef<HTMLDivElement | null>(null);
  const [tryAnotherActive, setTryAnotherActive] = useState(false);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 12 }}>
        <Link href="/">← Back to Map</Link>
      </div>

      <h1 style={{ marginTop: 0 }}>Random Shop</h1>

      {loading ? (
        <div>Loading shops…</div>
      ) : error ? (
        <div style={{ color: 'red' }}>Error loading shops: {error}</div>
      ) : !shopList.length ? (
        <div>No shops available.</div>
      ) : (
        <div>
          {/* Shared filter controls (reused from Map) */}
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
            // Tag filter props
            selectedTags={selectedTags}
            setSelectedTags={setSelectedTags}
            clearFilters={() => {
              clearFilters();
              setSelectedId(null);
            }}
          />

          <div style={{ marginTop: 8, marginBottom: 18 }}>
            <div style={{ color: '#666', marginBottom: 6 }}>
              {filteredShops.length > 0 ? (
                <>
                  {`Random from ${filteredShops.length}`}
                  {statusFilter ? ` ${STATUS_LABEL_MAP[statusFilter] ?? statusFilter}` : ''}
                  {distanceActive && userLocation ? ` within ${distanceRadiusMiles} miles` : ''}
                </>
              ) : (
                'No shops match the active filters.'
              )}
            </div>

            {/* Primary Slot Spinner */}
            <SlotSpinner key="primary-slot-spinner" shops={filteredShops} excludeId={null} onFinish={handleSpinnerFinish} />

            {/* Try Another: show a temporary SlotSpinner when active so the same animation plays */}
            <div style={{ marginTop: 12 }}>
              {tryAnotherActive ? (
                <SlotSpinner
                  shops={filteredShops}
                  excludeId={selectedId}
                  duration={1300}
                  onFinish={(id) => {
                    setSelectedId(id);
                    setTryAnotherActive(false);
                  }}
                />
              ) : (
                <button
                  onClick={() => setTryAnotherActive(true)}
                  disabled={!selectedId}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #e6e6e6',
                    background: '#fff',
                    cursor: selectedId ? 'pointer' : 'not-allowed',
                  }}
                >
                  Try Another
                </button>
              )}
            </div>
          </div>

          {selectedId == null ? (
            <div style={{ color: '#666' }}>Click the Spin button to see an engaging selection.</div>
          ) : detailLoading ? (
            <div>Loading shop details…</div>
          ) : detailError ? (
            <div style={{ color: 'red' }}>Error loading details: {detailError}</div>
          ) : detail ? (
            <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 6, maxWidth: 720 }}>
              <h2 style={{ margin: '4px 0' }}>{detail.name ?? 'Unnamed shop'}</h2>
              <div style={{ color: '#555', marginBottom: 8 }}>
                {detail.formatted_address ?? detail.address ?? 'Address not available'}
              </div>
              <div style={{ marginBottom: 8 }}>
                {detail.google_rating != null ? (
                  <div>Google rating: <strong>{detail.google_rating} ★</strong></div>
                ) : null}
                {detail.price_level != null ? (
                  <div>Price level: <strong>{'$'.repeat(Math.max(1, detail.price_level))}</strong></div>
                ) : null}
                {detail.phone ? (
                  <div>Phone: <a href={`tel:${detail.phone}`}>{detail.phone}</a></div>
                ) : null}
                {detail.website ? (
                  <div>Website: <a href={detail.website} target="_blank" rel="noreferrer">{detail.website}</a></div>
                ) : null}

                {detail.opening_hours ? (
                  isOpeningHoursWithWeekdayText(detail.opening_hours) ? (
                    <div style={{ marginTop: 6 }}>
                      <strong>Hours:</strong>
                      <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                        {detail.opening_hours.weekday_text.map((line: string, i: number) => (
                          <li key={i} style={{ fontSize: 13 }}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  ) : isOpeningHoursWithOpenNow(detail.opening_hours) ? (
                    <div style={{ marginTop: 6 }}>
                      Currently: <strong>{detail.opening_hours.open_now ? 'Open' : 'Closed'}</strong>
                    </div>
                  ) : (
                    <div style={{ marginTop: 6 }}>
                      <strong>Hours:</strong>
                      <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{JSON.stringify(detail.opening_hours)}</pre>
                    </div>
                  )
                ) : null}
              </div>

              <div style={{ marginTop: 8 }}>
                <Link href={`/shop/${detail.id}`}>View full details</Link>
              </div>
            </div>
          ) : null}
        </div>
      )}
      {/* Minimal styles for accessibility and small animation touches */}
      <style>{`
        @media (max-width: 480px) {
          .slot-button { padding: 12px 16px; min-width: 120px; }
        }
      `}</style>
    </div>
  );
}