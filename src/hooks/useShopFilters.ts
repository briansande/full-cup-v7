import { useState, useEffect } from 'react';

type Location = { lat: number; lng: number } | null;

interface ShopFilters {
  searchText: string;
  statusFilter: string | null;
  dateDays: number | null;
  distanceActive: boolean;
 distanceRadiusMiles: number;
  selectedTags: string[];
  userLocation: Location;
  locationPermission: 'unknown' | 'prompt' | 'granted' | 'denied';
  locationError: string | null;
}

interface ShopFiltersReturn {
  filters: ShopFilters;
  setSearchText: (value: string) => void;
  setStatusFilter: (value: string | null) => void;
  setDateDays: (value: number | null) => void;
  setDistanceFilterEnabled: (value: boolean) => void;
  setDistanceRadiusMiles: (value: number) => void;
  setSelectedTags: (value: string[] | null) => void;
  requestLocation: () => void;
  clearFilters: () => void;
}

const DISTANCE_OPTIONS = [0.25, 0.5, 1, 2, 5, 10] as const;
const DATE_FILTER_OPTIONS = [
  { label: 'Last 24h', days: 1 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
] as const;

export default function useShopFilters(): ShopFiltersReturn {
  const [searchText, setSearchText] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [dateDays, setDateDays] = useState<number | null>(null);
  const [distanceActive, setDistanceActive] = useState<boolean>(false);
  const [distanceRadiusMiles, setDistanceRadiusMiles] = useState<number>(1);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [userLocation, setUserLocation] = useState<Location>(null);
  const [locationPermission, setLocationPermission] = useState<'unknown' | 'prompt' | 'granted' | 'denied'>('unknown');
  const [locationError, setLocationError] = useState<string | null>(null);

  // Request location access
  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      setLocationPermission('denied');
      return;
    }

    setLocationPermission('prompt');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationPermission('granted');
        setLocationError(null);
      },
      (error) => {
        setLocationError(error.message);
        setLocationPermission('denied');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      }
    );
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchText('');
    setStatusFilter(null);
    setDateDays(null);
    setDistanceActive(false);
    setDistanceRadiusMiles(1);
    setSelectedTags([]);
  };

  return {
    filters: {
      searchText,
      statusFilter,
      dateDays,
      distanceActive,
      distanceRadiusMiles,
      selectedTags,
      userLocation,
      locationPermission,
      locationError,
    },
    setSearchText,
    setStatusFilter,
    setDateDays,
    setDistanceFilterEnabled: setDistanceActive,
    setDistanceRadiusMiles,
    setSelectedTags: (value: string[] | null) => setSelectedTags(value || []),
    requestLocation,
    clearFilters,
  };
}

// Export constants for use in components
export { DISTANCE_OPTIONS, DATE_FILTER_OPTIONS };