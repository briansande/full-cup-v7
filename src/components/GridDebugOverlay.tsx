'use client';
import React, { useEffect, useState } from "react";
import type { GridPoint } from "@/src/lib/grid";

/**
 * GridDebugOverlay
 * - Renders grid points (primary level === 0) as blue Circle + CircleMarker with Popup.
 * - Only renders when `visible === true`.
 * - Dynamically imports react-leaflet primitives at runtime to avoid SSR issues.
 */
type Props = {
  points: GridPoint[];
  visible: boolean;
  modeLabel?: string;
  counts?: Record<string, number>;
};

export default function GridDebugOverlay({ points, visible, modeLabel, counts }: Props) {
  const [RL, setRL] = useState<any | null>(null); // lazy-loaded react-leaflet components

  useEffect(() => {
    if (!visible) return;
    let mounted = true;

    (async () => {
      const mod = await import("react-leaflet");
      if (!mounted) return;
      setRL({
        Circle: (mod as any).Circle,
        CircleMarker: (mod as any).CircleMarker,
        Popup: (mod as any).Popup,
        Tooltip: (mod as any).Tooltip,
      });
    })();

    return () => {
      mounted = false;
    };
  }, [visible]);

  // Do not render anything unless visible and components loaded
  if (!visible) return null;
  if (!RL) return null;

  const { Circle, CircleMarker, Popup } = RL;
 
  return (
    <>
      {/* Primary points (level === 0) - unchanged behavior */}
      {points
        .filter((p) => p.level === 0)
        .map((p) => (
          <React.Fragment key={p.id}>
            {/* Large radius circle (meters). Use semi-transparent fill and non-interactive so it doesn't block map events */}
            <Circle
              center={[p.lat, p.lng]}
              radius={p.radius}
              pathOptions={{
                color: "#2563EB",
                fillColor: "#2563EB",
                fillOpacity: 0.12,
                weight: 1,
              }}
              interactive={false}
            />
 
            {/* Small visible marker (circle marker) with popup */}
            <CircleMarker
              center={[p.lat, p.lng]}
              radius={6}
              pathOptions={{ color: "#1D4ED8", fillColor: "#1D4ED8", fillOpacity: 1 }}
            >
              <Popup>
                <div style={{ minWidth: 220 }}>
                  <div style={{ fontWeight: 600 }}>{modeLabel ?? "GRID DEBUG"}</div>
                  <div style={{ marginTop: 6 }}>id: {p.id}</div>
                  <div>lat: {p.lat.toFixed(6)}, lng: {p.lng.toFixed(6)}</div>
                  <div>radius: {p.radius}</div>
                  <div>level: {p.level}</div>
                </div>
              </Popup>

              {/* Render per-grid count label when provided (small tooltip near marker).
                  This is optional and only shown when `visible === true` and `counts` prop supplied. */}
              {RL?.Tooltip && typeof counts !== "undefined" && counts[p.id] !== undefined && (
                <RL.Tooltip direction="top" offset={[0, -10]} interactive={false}>
                  <div
                    style={{
                      background: "rgba(17,24,39,0.9)",
                      color: "#fff",
                      padding: "2px 6px",
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {counts[p.id]}
                  </div>
                </RL.Tooltip>
              )}
            </CircleMarker>
          </React.Fragment>
        ))}
 
      {/* Subdivision points (level > 0) - distinct styling (orange/red) */}
      {points
        .filter((p) => p.level > 0)
        .map((p) => (
          <React.Fragment key={p.id}>
            {/* Slightly more prominent red/orange fill for subdivision coverage */}
            <Circle
              center={[p.lat, p.lng]}
              radius={p.radius}
              pathOptions={{
                color: "#DC2626", // red border
                fillColor: "#F97316", // orange fill
                fillOpacity: 0.14,
                weight: 1,
              }}
              interactive={false}
            />
 
            {/* Small visible marker (circle marker) with popup - orange */}
            <CircleMarker
              center={[p.lat, p.lng]}
              radius={6}
              pathOptions={{ color: "#EA580C", fillColor: "#EA580C", fillOpacity: 1 }}
            >
              <Popup>
                <div style={{ minWidth: 220 }}>
                  <div style={{ fontWeight: 600 }}>{modeLabel ?? "GRID DEBUG (SUB)"}</div>
                  <div style={{ marginTop: 6 }}>id: {p.id}</div>
                  <div>lat: {p.lat.toFixed(6)}, lng: {p.lng.toFixed(6)}</div>
                  <div>radius: {p.radius}</div>
                  <div>level: {p.level}</div>
                </div>
              </Popup>
            </CircleMarker>
          </React.Fragment>
        ))}
    </>
  );
}

/**
 * Optional small toggle UI component you can embed elsewhere.
 * Map.tsx currently uses its own button, but we export this for reuse.
 */
export function DebugToggle({
  visible,
  setVisible,
  isAdmin = false,
  modeLabel,
}: {
  visible: boolean;
  setVisible: (v: boolean) => void;
  isAdmin?: boolean;
  modeLabel?: string;
}) {
  if (!isAdmin) return null;
  return (
    <button
      onClick={() => setVisible(!visible)}
      title={modeLabel ?? "Grid Debug Toggle"}
      style={{
        padding: "6px 8px",
        borderRadius: 6,
        border: "1px solid #d1d5db",
        background: visible ? "#111827" : "#fff",
        color: visible ? "#fff" : "#111827",
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {visible ? `Hide Debug (${modeLabel ?? "TEST MODE: 6 points"})` : `Show Debug (${modeLabel ?? "TEST MODE: 6 points"})`}
    </button>
  );
}