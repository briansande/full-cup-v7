'use client';

import React from 'react';
import TagSelector from './TagSelector';

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

  return (
    <div className="bg-white/90 backdrop-blur-sm p-3 rounded-xl shadow-md flex gap-2 items-center flex-wrap max-w-[90vw] w-full">
      <input
        aria-label="Search shops"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        placeholder="Search shops by name"
        className="cottage-input min-w-[200px]"
      />

      {/* Tag selector — searchable, multi-select. Uses AND logic (shop must have all selected tags) */}
      <div className="ml-1">
        <TagSelector selectedTags={selectedTags} setSelectedTags={setSelectedTags} placeholder="Filter by tags…" />
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        <button
          onClick={() => setStatusFilter(null)}
          className={`cottage-button px-3 py-2 ${
            statusFilter === null 
              ? 'bg-[--cottage-primary] text-white border-[--cottage-primary]' 
              : 'hover:bg-[--cottage-secondary]/50'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setStatusFilter("want_to_try")}
          className={`cottage-button px-3 py-2 ${
            statusFilter === "want_to_try" 
              ? 'bg-blue-500 text-white border-blue-500' 
              : 'hover:bg-blue-50'
          }`}
        >
          Want to Try
        </button>
        <button
          onClick={() => setStatusFilter("visited")}
          className={`cottage-button px-3 py-2 ${
            statusFilter === "visited" 
              ? 'bg-green-500 text-white border-green-500' 
              : 'hover:bg-green-50'
          }`}
        >
          Visited
        </button>
        <button
          onClick={() => setStatusFilter("favorite")}
          className={`cottage-button px-3 py-2 ${
            statusFilter === "favorite" 
              ? 'bg-red-500 text-white border-red-500' 
              : 'hover:bg-red-50'
          }`}
        >
          Favorites
        </button>
      </div>

      {/* Date filter: Show New Shops */}
      <div className="flex gap-2 items-center flex-wrap ml-1">
        <div className="text-[--cottage-neutral-dark]/70 text-sm">Show New Shops</div>
        {DATE_FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.days}
            onClick={() => setDateDays(opt.days)}
            className={`cottage-button px-3 py-2 ${
              dateDays === opt.days 
                ? 'bg-[--cottage-neutral-dark] text-white border-[--cottage-neutral-dark]' 
                : 'hover:bg-[--cottage-secondary]/50'
            }`}
            aria-pressed={dateDays === opt.days}
          >
            {opt.label}
          </button>
        ))}
        <button
          onClick={() => setDateDays(null)}
          className="cottage-button px-2 py-1.5 text-[--cottage-neutral-dark]/70 hover:bg-[--cottage-secondary]/50"
          title="Clear date filter"
        >
          Clear
        </button>
      </div>

      {/* Near Me / Distance filter (dropdown) */}
      <div className="flex gap-2 items-center flex-wrap ml-1">
        <div className="text-[--cottage-neutral-dark]/70 text-sm">Near Me</div>

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
          className={`cottage-input ${
            distanceActive 
              ? 'border-2 border-[--cottage-neutral-dark]' 
              : ''
          }`}
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
          <div className="text-red-600 text-sm ml-1 flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Location denied. 
            <button 
              onClick={() => requestLocation()} 
              className="underline bg-none border-none text-[--cottage-neutral-dark] cursor-pointer hover:text-[--cottage-primary]"
            >
              Retry
            </button>
          </div>
        ) : null}

        {distanceActive && locationPermission === "prompt" ? (
          <div className="text-[--cottage-neutral-dark]/70 text-sm ml-1 flex items-center gap-1">
            <div className="w-3 h-3 border-2 border-[--cottage-primary] border-t-transparent rounded-full animate-spin"></div>
            Requesting location...
          </div>
        ) : null}

        {distanceActive && locationError ? (
          <div className="text-red-600 text-sm ml-1 flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {locationError}
          </div>
        ) : null}
      </div>

      <button
        onClick={clearFilters}
        className="cottage-button px-3 py-2 hover:bg-[--cottage-secondary]/50"
      >
        Clear Filters
      </button>

      {renderDebugButton ? <div>{renderDebugButton}</div> : null}
    </div>
  );
}