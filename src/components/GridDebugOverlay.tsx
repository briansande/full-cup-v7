'use client';
import React, { useEffect, useState } from "react";
import type { GridPoint } from "@/src/lib/grid";
import { progress, type ProgressEvent } from "@/src/lib/progress";

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
  duplicates?: Record<string, number>; // optional map gridId -> duplicate count (for debug badges)
  dbStatus?: Record<string, { newCount?: number; updatedCount?: number; verifiedCount?: number }>;
  adminMode?: boolean; // optional prop to enable admin quick-link
};

export default function GridDebugOverlay({ points, visible, modeLabel, counts, duplicates, dbStatus, adminMode = false }: Props) {
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
  
  // Progress UI state
  const [processedCount, setProcessedCount] = useState<number>(0);
  const [totalEstimated, setTotalEstimated] = useState<number | undefined>(undefined);
  const [apiCalls, setApiCalls] = useState<number>(0);
  const [lastEvent, setLastEvent] = useState<ProgressEvent | null>(null);
  const [recentEvents, setRecentEvents] = useState<ProgressEvent[]>([]);
  
  // Subscribe to in-process progress tracker (client-only).
  // Progress tracker replays recent events synchronously on subscribe, so state will initialize.
  useEffect(() => {
    if (typeof window === "undefined") return; // ensure client-only
    if (!visible) return;
  
    const handler = (ev: ProgressEvent) => {
      // Update aggregates conservatively based on events seen
      if (ev.type === "start") {
        setTotalEstimated(ev.totalEstimatedSearches);
      } else if (ev.type === "search-complete") {
        setProcessedCount((c) => c + 1);
        setApiCalls((a) => a + (ev.apiCalls ?? 0));
      } else if (ev.type === "complete") {
        setProcessedCount(ev.totalAreasSearched);
        setApiCalls(ev.apiCalls);
        setTotalEstimated(ev.totalAreasSearched ?? ev.totalAreasSearched);
      } else if (ev.type === "abort") {
        // no-op other than recording last event
      } else if (ev.type === "subdivision-created") {
        // Adjust totalEstimated if we had an estimate — add children to live estimate
        setTotalEstimated((t) => (typeof t === "number" ? t + ev.children.length : t));
      }
  
      // maintain last event and recent events (cap 5)
      setLastEvent(ev);
      setRecentEvents((prev) => {
        const next = [...prev, ev].slice(-5);
        return next;
      });
    };
  
    const unsubscribe = progress.subscribe(handler);
    return () => {
      unsubscribe();
    };
  }, [visible]);

  // Do not render anything unless visible and components loaded
  if (!visible) return null;
  if (!RL) return null;
  
  const { Circle, CircleMarker, Popup } = RL;
  
  return (
    <>
      {/* Minimal top-right progress panel (only when overlay visible) */}
      <div
        style={{
          position: "absolute",
          right: 12,
          top: 12,
          zIndex: 6000,
          minWidth: 220,
          background: "rgba(17,24,39,0.85)",
          color: "#fff",
          padding: "8px 10px",
          borderRadius: 8,
          fontSize: 12,
          boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
          pointerEvents: "auto",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6 }}>
          {modeLabel ? `${modeLabel}` : "TEST MODE"}
          {typeof totalEstimated === "number" ? `: ${totalEstimated} points` : ""}
        </div>
        <div style={{ fontSize: 12, opacity: 0.95 }}>
          Processed: {processedCount} / {typeof totalEstimated === "number" ? totalEstimated : "-"}
        </div>
        <div style={{ fontSize: 12, opacity: 0.95 }}>API calls: {apiCalls}</div>
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>
          Last:{" "}
          {lastEvent
            ? lastEvent.type === "search-complete"
              ? `${lastEvent.id} — ${lastEvent.resultCount} results — apiCalls=${lastEvent.apiCalls}${
                  lastEvent.subdivided ? " — subdivided" : ""
                }`
              : lastEvent.type === "search-start"
              ? `start ${lastEvent.id}`
              : lastEvent.type === "subdivision-created"
              ? `subdivision ${lastEvent.parentId} → ${lastEvent.children.join(", ")}`
              : lastEvent.type === "start"
              ? `start (${lastEvent.totalEstimatedSearches ?? "-"})`
              : lastEvent.type === "abort"
              ? `abort — ${lastEvent.reason}`
              : lastEvent.type === "complete"
              ? `complete — ${lastEvent.totalAreasSearched} areas`
              : JSON.stringify(lastEvent)
            : "—"}
        </div>
  
        {/* Recent events (compact) */}
        <div style={{ marginTop: 8, maxHeight: 120, overflow: "auto" }}>
          {recentEvents.map((ev, idx) => (
            <div
              key={idx}
              style={{
                fontSize: 11,
                opacity: 0.85,
                borderTop: idx === 0 ? "none" : "1px solid rgba(255,255,255,0.04)",
                paddingTop: idx === 0 ? 0 : 6,
                paddingBottom: 4,
              }}
            >
              {ev.type === "search-complete"
                ? `${ev.id} — ${ev.resultCount} — api=${ev.apiCalls}${ev.subdivided ? " — sub" : ""}`
                : ev.type === "search-start"
                ? `start ${ev.id}`
                : ev.type === "subdivision-created"
                ? `sub ${ev.parentId} → ${ev.children.length}`
                : ev.type === "start"
                ? `start (~${ev.totalEstimatedSearches ?? "-"})`
                : ev.type === "abort"
                ? `abort — ${ev.reason}`
                : ev.type === "complete"
                ? `complete — ${ev.totalAreasSearched}`
                : ev.type}
            </div>
          ))}
        </div>
      </div>
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

              {/* Optional duplicate-badge: shows number of duplicate occurrences this grid contributed (if > 0).
                  Uses a permanent, non-interactive tooltip styled as a small red badge. We use pointerEvents: 'none'
                  to ensure it doesn't block clicks/popups. Only rendered when `duplicates` is supplied and > 0. */}
              {RL?.Tooltip && typeof duplicates !== "undefined" && duplicates[p.id] !== undefined && duplicates[p.id] > 0 && (
                <RL.Tooltip direction="right" offset={[10, 0]} permanent interactive={false}>
                  <div
                    style={{
                      background: "#DC2626",
                      color: "#fff",
                      padding: "2px 6px",
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 800,
                      lineHeight: "12px",
                      minWidth: 20,
                      textAlign: "center",
                      pointerEvents: "none", // ensure badge does not intercept pointer events (popups/markers remain interactive)
                      boxShadow: "0 1px 2px rgba(0,0,0,0.35)",
                    }}
                  >
                    {duplicates[p.id]}
                  </div>
                </RL.Tooltip>
              )}

              {/* DB-status badges (non-interactive). Shows counts for new inserts (+N), updates (~M),
                  and a small verified check when verifiedCount > 0. Rendered only when overlay visible
                  and dbStatus prop is provided. Styling is lightweight and pointerEvents: 'none'. */}
              {RL?.Tooltip && typeof dbStatus !== "undefined" && dbStatus?.[p.id] && (
                <RL.Tooltip direction="left" offset={[-10, 0]} permanent interactive={false}>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                      pointerEvents: "none",
                    }}
                  >
                    {typeof dbStatus[p.id]?.newCount === "number" && dbStatus[p.id].newCount! > 0 && (
                      <div
                        style={{
                          background: "#16A34A", // green
                          color: "#fff",
                          padding: "2px 6px",
                          borderRadius: 12,
                          fontSize: 11,
                          fontWeight: 800,
                          minWidth: 24,
                          textAlign: "center",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
                          pointerEvents: "none",
                        }}
                      >
                        +{dbStatus[p.id].newCount}
                      </div>
                    )}

                    {typeof dbStatus[p.id]?.updatedCount === "number" && dbStatus[p.id].updatedCount! > 0 && (
                      <div
                        style={{
                          background: "#2563EB", // blue
                          color: "#fff",
                          padding: "2px 6px",
                          borderRadius: 12,
                          fontSize: 11,
                          fontWeight: 800,
                          minWidth: 24,
                          textAlign: "center",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
                          pointerEvents: "none",
                        }}
                      >
                        ~{dbStatus[p.id].updatedCount}
                      </div>
                    )}

                    {typeof dbStatus[p.id]?.verifiedCount === "number" && dbStatus[p.id].verifiedCount! > 0 && (
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          background: "#10B981",
                          borderRadius: 8,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          fontSize: 11,
                          fontWeight: 700,
                          boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
                          pointerEvents: "none",
                        }}
                      >
                        ✓
                      </div>
                    )}
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