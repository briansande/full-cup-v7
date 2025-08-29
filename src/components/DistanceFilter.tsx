'use client';
import React from 'react';

type Location = { lat: number; lng: number } | null;

interface DistanceFilterProps {
  distanceActive: boolean;
  setDistanceFilterEnabled: (v: boolean) => void;
  DISTANCE_OPTIONS: ReadonlyArray<number>;
  distanceRadiusMiles: number;
  setDistanceRadiusMiles: (v: number) => void;
  userLocation: Location;
  locationPermission: 'unknown' | 'prompt' | 'granted' | 'denied';
  locationError: string | null;
  requestLocation: () => void;
}

export default function DistanceFilter({
  distanceActive,
  setDistanceFilterEnabled,
  DISTANCE_OPTIONS,
  distanceRadiusMiles,
  setDistanceRadiusMiles,
  userLocation,
  locationPermission,
  locationError,
  requestLocation
}: DistanceFilterProps) {
  // Render the distance filter component
  return (
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
  );
}