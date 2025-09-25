'use client';

import React from 'react';
import TagSelector from '../layout/TagSelector';
import SearchFilter from './SearchFilter';
import StatusFilter from './StatusFilter';
import DateFilter from './DateFilter';
import DistanceFilter from './DistanceFilter';
import ClearFiltersButton from './ClearFiltersButton';

type Location = { lat: number; lng: number } | null;

type Props = {
  searchText: string;
  setSearchText: (v: string) => void;
  statusFilter: string | null;
  setStatusFilter: (v: string | null) => void;
  dateDays: number | null;
  setDateDays: (v: number | null) => void;
  DATE_FILTER_OPTIONS: { label: string; days: number }[];
  distanceActive: boolean;
  setDistanceFilterEnabled: (v: boolean) => void;
  // Accept readonly distance options from shared hook
  DISTANCE_OPTIONS: ReadonlyArray<number>;
  distanceRadiusMiles: number;
  setDistanceRadiusMiles: (v: number) => void;
  userLocation: Location;
  locationPermission: 'unknown' | 'prompt' | 'granted' | 'denied';
  locationError: string | null;
  requestLocation: () => void;
  clearFilters: () => void;
  renderDebugButton?: React.ReactNode;

  // Tag filter integration
  selectedTags: string[];
  setSelectedTags: (v: string[] | null) => void;
};

export default function FilterControls(props: Props) {
  const {
    searchText,
    setSearchText,
    statusFilter,
    setStatusFilter,
    dateDays,
    setDateDays,
    DATE_FILTER_OPTIONS,
    distanceActive,
    setDistanceFilterEnabled,
    DISTANCE_OPTIONS,
    distanceRadiusMiles,
    setDistanceRadiusMiles,
    userLocation,
    locationPermission,
    locationError,
    requestLocation,
    clearFilters,
    renderDebugButton,
    selectedTags,
    setSelectedTags,
  } = props;

  // Destructure props for easier access

  return (
    <div className="bg-white/90 backdrop-blur-sm p-3 rounded-xl shadow-md flex gap-2 items-center flex-wrap max-w-[90vw] w-full">
      <SearchFilter searchText={searchText} setSearchText={setSearchText} />

      {/* Tag selector — searchable, multi-select. Uses AND logic (shop must have all selected tags) */}
      <div className="ml-1">
        <TagSelector selectedTags={selectedTags} setSelectedTags={setSelectedTags} placeholder="Filter by tags…" />
      </div>

      <StatusFilter statusFilter={statusFilter} setStatusFilter={setStatusFilter} />

      {/* Date filter: Show New Shops */}
      <DateFilter 
        dateDays={dateDays} 
        setDateDays={setDateDays} 
        DATE_FILTER_OPTIONS={DATE_FILTER_OPTIONS} 
      />

      {/* Near Me / Distance filter (dropdown) */}
      <DistanceFilter
        distanceActive={distanceActive}
        setDistanceFilterEnabled={setDistanceFilterEnabled}
        DISTANCE_OPTIONS={DISTANCE_OPTIONS}
        distanceRadiusMiles={distanceRadiusMiles}
        setDistanceRadiusMiles={setDistanceRadiusMiles}
        userLocation={userLocation}
        locationPermission={locationPermission}
        locationError={locationError}
        requestLocation={requestLocation}
      />

      <ClearFiltersButton clearFilters={clearFilters} />

      {renderDebugButton ? <div>{renderDebugButton}</div> : null}
    </div>
  );
}