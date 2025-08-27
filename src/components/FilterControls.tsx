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
    <div
      style={{
        position: "absolute",
        top: 12,
        left: 12,
        zIndex: 1100,
        background: "rgba(255,255,255,0.95)",
        padding: 12,
        borderRadius: 8,
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        display: "flex",
        gap: 8,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <input
        aria-label="Search shops"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        placeholder="Search shops by name"
        style={{
          padding: "8px 10px",
          borderRadius: 6,
          border: "1px solid #d1d5db",
          minWidth: 220,
          outline: "none",
        }}
      />

      {/* Tag selector — searchable, multi-select. Uses AND logic (shop must have all selected tags) */}
      <div style={{ marginLeft: 6 }}>
        <TagSelector selectedTags={selectedTags} setSelectedTags={setSelectedTags} placeholder="Filter by tags…" />
      </div>

      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <button
          onClick={() => setStatusFilter(null)}
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            border: statusFilter === null ? "1px solid #111827" : "1px solid #d1d5db",
            background: statusFilter === null ? "#111827" : "#fff",
            color: statusFilter === null ? "#fff" : "#111827",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          All
        </button>
        <button
          onClick={() => setStatusFilter("want_to_try")}
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            border: statusFilter === "want_to_try" ? "1px solid #3b82f6" : "1px solid #d1d5db",
            background: statusFilter === "want_to_try" ? "#3b82f6" : "#fff",
            color: statusFilter === "want_to_try" ? "#fff" : "#111827",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Want to Try
        </button>
        <button
          onClick={() => setStatusFilter("visited")}
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            border: statusFilter === "visited" ? "1px solid #10b981" : "1px solid #d1d5db",
            background: statusFilter === "visited" ? "#10b981" : "#fff",
            color: statusFilter === "visited" ? "#fff" : "#111827",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Visited
        </button>
        <button
          onClick={() => setStatusFilter("favorite")}
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            border: statusFilter === "favorite" ? "1px solid #ef4444" : "1px solid #d1d5db",
            background: statusFilter === "favorite" ? "#ef4444" : "#fff",
            color: statusFilter === "favorite" ? "#fff" : "#111827",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Favorites
        </button>
      </div>

      {/* Date filter: Show New Shops */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginLeft: 6 }}>
        <div style={{ color: "#666", fontSize: 13, marginRight: 6 }}>Show New Shops</div>
        {DATE_FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.days}
            onClick={() => setDateDays(opt.days)}
            style={{
              padding: "8px 10px",
              borderRadius: 6,
              border: dateDays === opt.days ? "2px solid #111827" : "1px solid #d1d5db",
              background: dateDays === opt.days ? "#111827" : "#fff",
              color: dateDays === opt.days ? "#fff" : "#111827",
              fontWeight: 600,
              cursor: "pointer",
            }}
            aria-pressed={dateDays === opt.days}
          >
            {opt.label}
          </button>
        ))}
        <button
          onClick={() => setDateDays(null)}
          style={{
            padding: "6px 8px",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            background: "#fff",
            color: "#666",
            cursor: "pointer",
          }}
          title="Clear date filter"
        >
          Clear
        </button>
      </div>

      {/* Near Me / Distance filter (dropdown) */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginLeft: 6 }}>
        <div style={{ color: "#666", fontSize: 13 }}>Near Me</div>

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
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            border: distanceActive ? "2px solid #111827" : "1px solid #d1d5db",
            background: "#fff",
            color: "#111827",
            fontWeight: 600,
            cursor: "pointer",
          }}
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
          <div style={{ color: "#b91c1c", fontSize: 13, marginLeft: 6 }}>
            Location denied. <button onClick={() => requestLocation()} style={{ textDecoration: "underline", background: "none", border: "none", color: "#111827", cursor: "pointer" }}>Retry</button>
          </div>
        ) : null}

        {distanceActive && locationPermission === "prompt" ? (
          <div style={{ color: "#666", fontSize: 13, marginLeft: 6 }}>
            Requesting location...
          </div>
        ) : null}

        {distanceActive && locationError ? (
          <div style={{ color: "#b91c1c", fontSize: 13, marginLeft: 6 }}>
            {locationError}
          </div>
        ) : null}
      </div>

      <button
        onClick={clearFilters}
        style={{
          padding: "8px 10px",
          borderRadius: 6,
          border: "1px solid #d1d5db",
          background: "#fff",
          color: "#111827",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Clear Filters
      </button>

      {renderDebugButton ? <div>{renderDebugButton}</div> : null}
    </div>
  );
}