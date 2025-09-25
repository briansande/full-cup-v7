'use client';

import React from 'react';
import { useShopFilters, DISTANCE_OPTIONS, DATE_FILTER_OPTIONS } from '@/src/hooks';
import FilterControls from './FilterControls';

export default function ShopFilterControls() {
  const {
    filters,
    setSearchText,
    setStatusFilter,
    setDateDays,
    setDistanceFilterEnabled,
    setDistanceRadiusMiles,
    setSelectedTags,
    requestLocation,
    clearFilters
 } = useShopFilters();

  return (
    <FilterControls
      searchText={filters.searchText}
      setSearchText={setSearchText}
      statusFilter={filters.statusFilter}
      setStatusFilter={setStatusFilter}
      dateDays={filters.dateDays}
      setDateDays={setDateDays}
      DATE_FILTER_OPTIONS={[...DATE_FILTER_OPTIONS]}
      distanceActive={filters.distanceActive}
      setDistanceFilterEnabled={setDistanceFilterEnabled}
      DISTANCE_OPTIONS={DISTANCE_OPTIONS}
      distanceRadiusMiles={filters.distanceRadiusMiles}
      setDistanceRadiusMiles={setDistanceRadiusMiles}
      userLocation={filters.userLocation}
      locationPermission={filters.locationPermission}
      locationError={filters.locationError}
      requestLocation={requestLocation}
      clearFilters={clearFilters}
      selectedTags={filters.selectedTags}
      setSelectedTags={setSelectedTags}
    />
  );
}