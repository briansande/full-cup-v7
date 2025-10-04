'use client';

import { useEffect, useState } from 'react';

export type Location = { lat: number; lng: number } | null;

export const DATE_FILTER_OPTIONS = [
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
  { label: '60 days', days: 60 },
];

export const DISTANCE_OPTIONS = [1, 3, 5, 10] as const;

export const STATUS_LABEL_MAP: Record<string, string> = {
  want_to_try: "Want to Try",
  visited: "Visited",
  favorite: "Favorites",
  not_interested: "Not Interested",
  potential: "Potential",
};

type UseFiltersOptions = {
  initialDateDays?: number | null;
  initialStatus?: string | null;
  initialDistanceRadiusMiles?: number;
  initialDistanceActive?: boolean;
  initialSearchText?: string;
  // initial selected tags (array of tag ids)
  initialSelectedTags?: string[];
};

type DBFilterParams = {
  dateCutoff?: string | null;
  status?: string | null;
  distance?: { lat: number; lng: number; radiusMiles: number } | null;
  searchText?: string | null;
  tags?: string[] | null;
};

/**
 * Shared filter hook used by multiple pages (Map, NewShops, etc.)
 * - Manages searchText, status, date range, and "near me" distance filters
 * - Provides validation and a helper to convert filters into DB-query-friendly params
 *
 * Important: this hook intentionally does NOT couple directly to any DB library.
 */
export default function useFilters(opts?: UseFiltersOptions) {
  const {
    initialDateDays = null,
    initialStatus = null,
    initialDistanceRadiusMiles = 3,
    initialDistanceActive = false,
    initialSearchText = '',
    initialSelectedTags = [],
  } = opts || {};

  const [searchText, setSearchText] = useState<string>(initialSearchText);
  const [statusFilter, setStatusFilterRaw] = useState<string | null>(initialStatus);
  const [dateDays, setDateDaysRaw] = useState<number | null>(initialDateDays);

  // Show not interested state - defaults to false to hide not interested shops by default
  const [showNotInterested, setShowNotInterested] = useState<boolean>(false);

  // Tag filter (array of tag ids). AND logic - shops must contain all selected tags.
  const [selectedTags, setSelectedTagsRaw] = useState<string[]>(initialSelectedTags);

  // Distance / "Near Me" filter state
  const [distanceActive, setDistanceActive] = useState<boolean>(initialDistanceActive);
  const [distanceRadiusMiles, setDistanceRadiusMilesRaw] = useState<number>(initialDistanceRadiusMiles);
  const [userLocation, setUserLocation] = useState<Location>(null);
  const [locationPermission, setLocationPermission] = useState<'unknown' | 'prompt' | 'granted' | 'denied'>('unknown');
  const [locationError, setLocationError] = useState<string | null>(null);

  // Generic validation / error state for the filter system
  const [filterError, setFilterError] = useState<string | null>(null);

  // Helpers: validation/coercion
  function isValidDateDays(v: number | null | undefined) {
    if (v == null) return true;
    return DATE_FILTER_OPTIONS.some((o) => o.days === v);
  }

  function isValidDistanceMiles(v: number | null | undefined) {
    if (v == null) return false;
    const numeric = Number(v);
    return DISTANCE_OPTIONS.some((n) => n === numeric);
  }

  function setDateDays(value: number | null) {
    if (!isValidDateDays(value)) {
      setFilterError("Invalid date range selected.");
      setDateDaysRaw(null);
    } else {
      setFilterError(null);
      setDateDaysRaw(value);
    }
  }

  function setStatusFilter(value: string | null) {
    // allow null or one of keys in STATUS_LABEL_MAP
    if (value == null) {
      setStatusFilterRaw(null);
      setFilterError(null);
      return;
    }
    const allowed = new Set(Object.keys(STATUS_LABEL_MAP));
    if (!allowed.has(value)) {
      setFilterError("Invalid status selected.");
      setStatusFilterRaw(null);
    } else {
      setFilterError(null);
      setStatusFilterRaw(value);
    }
  }

  function setDistanceRadiusMiles(value: number) {
    if (!isValidDistanceMiles(value)) {
      setFilterError("Invalid distance selected.");
      setDistanceRadiusMilesRaw(3);
    } else {
      setFilterError(null);
      setDistanceRadiusMilesRaw(value);
    }
  }

  // Set selected tags (replace entire array). Pass null/undefined to clear.
  function setSelectedTags(value: string[] | null) {
    if (!value || value.length === 0) {
      setSelectedTagsRaw([]);
    } else {
      // normalize to strings
      setSelectedTagsRaw(value.map((v) => String(v)));
    }
  }

  // Geolocation helpers
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

  function clearFilters() {
    setSearchText("");
    setStatusFilterRaw(null);
    setDateDaysRaw(null);
    setSelectedTagsRaw([]); // clear tag filters as part of Clear All Filters
    setDistanceActive(false);
    setUserLocation(null);
    setLocationError(null);
    setLocationPermission("unknown");
    setFilterError(null);
    setShowNotInterested(false); // reset show not interested state when clearing filters
  }

  // Validate the current filter state and return any error messages
  function validateFilters(): string[] {
    const errs: string[] = [];
    if (!isValidDateDays(dateDays)) errs.push("Date range is invalid.");
    if (distanceActive && !isValidDistanceMiles(distanceRadiusMiles)) errs.push("Distance selection is invalid.");
    if (distanceActive && !userLocation && locationPermission === "denied") errs.push("Location permission denied.");
    return errs;
  }

  // Convert filters to DB-conscious parameters. Useful for constructing queries.
  function getDBFilterParams(): DBFilterParams {
    const params: DBFilterParams = {};
    if (dateDays && isValidDateDays(dateDays)) {
      const cutoff = new Date(Date.now() - dateDays * 24 * 60 * 60 * 1000).toISOString();
      params.dateCutoff = cutoff;
    } else {
      params.dateCutoff = null;
    }

    params.status = statusFilter ?? null;

    if (distanceActive && userLocation && isValidDistanceMiles(distanceRadiusMiles)) {
      params.distance = {
        lat: userLocation.lat,
        lng: userLocation.lng,
        radiusMiles: distanceRadiusMiles,
      };
    } else {
      params.distance = null;
    }

    params.searchText = (searchText && searchText.trim().length > 0) ? searchText.trim() : null;
    params.tags = selectedTags.length > 0 ? selectedTags.slice() : null;

    return params;
  }

  // Keep filterError in sync with validateFilters
  useEffect(() => {
    const errs = validateFilters();
    setFilterError(errs.length > 0 ? errs.join(" ") : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateDays, distanceActive, distanceRadiusMiles, userLocation, locationPermission]);

  return {
    // state
    searchText,
    statusFilter,
    dateDays,
    distanceActive,
    distanceRadiusMiles,
    userLocation,
    locationPermission,
    locationError,
    filterError,
    selectedTags,
    showNotInterested,

    // constants / options
    DATE_FILTER_OPTIONS,
    DISTANCE_OPTIONS,
    STATUS_LABEL_MAP,

    // setters / actions
    setSearchText,
    setStatusFilter,
    setDateDays,
    setDistanceRadiusMiles,
    setDistanceFilterEnabled,
    requestLocation,
    clearFilters,
    setSelectedTags,
    setShowNotInterested,

    // helpers
    validateFilters,
    getDBFilterParams,
  };
}