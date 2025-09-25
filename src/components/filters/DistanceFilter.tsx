'use client';
import React from 'react';
import StatusMessage from '../ui/StatusMessage';
import FilterBase from './FilterBase';

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
    <FilterBase label="Near Me">
      <div className="flex gap-2 items-center flex-wrap">
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
              ? 'border-primary shadow-md bg-secondary/30'
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
          <StatusMessage
            type="error"
            message="Location denied."
            actions={[{
              label: "Retry",
              onClick: requestLocation,
              variant: "outline"
            }]}
            className="ml-1"
          />
        ) : null}

        {distanceActive && locationPermission === "prompt" ? (
          <StatusMessage
            type="loading"
            message="Requesting location..."
            className="ml-1"
          />
        ) : null}

        {distanceActive && locationError ? (
          <StatusMessage
            type="error"
            message={locationError}
            className="ml-1"
          />
        ) : null}
      </div>
    </FilterBase>
  );
}