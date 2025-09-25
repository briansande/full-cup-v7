'use client';
import React, { useEffect, useRef, useState } from "react";

/**
 * AdminSyncControls.tsx
 *
 * Client-side admin UI for starting/monitoring/aborting sync runs.
 *
 * Important notes:
 * - This UI talks to /api/admin/sync (GET to poll progress, POST to start/abort).
 * - The server route enforces admin access server-side (supabase session is preferred;
 *   fallback requires header `x-admin-secret` === process.env.ADMIN_SECRET).
 * - The component defaults to "test" mode. Production runs require an explicit confirmation
 *   checkbox and an extra confirm prompt.
 *
 * UX:
 * - Mode toggle (Test / Production)
 * - Start Sync button (production requires confirmation)
 * - Abort Sync button when a run is in progress
 * - Polls progress every 1000ms while mounted and displays a compact progress panel
 *
 * Keep styles inline and minimal to avoid external dependencies.
 */

type ProgressEvent = any;
type ProgressSnapshot = {
  events: ProgressEvent[];
  latestSummary?: {
    totalAreasSearched: number;
    totalPlaces: number;
    apiCalls: number;
    subdivisions: number;
    aborted: boolean;
  };
};

export default function AdminSyncControls() {
  const [mode, setMode] = useState<"test" | "production">("test");
  const [running, setRunning] = useState<boolean>(false);
  const [snapshot, setSnapshot] = useState<ProgressSnapshot | null>(null);
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [lastLine, setLastLine] = useState<string>("");
  const [apiCalls, setApiCalls] = useState<number>(0);
  const [estimated, setEstimated] = useState<number | null>(null);
  const [status, setStatus] = useState<string>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmProduction, setConfirmProduction] = useState<boolean>(false);
  const pollingRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    startPolling();
    return () => {
      mountedRef.current = false;
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startPolling() {
    poll();
    stopPolling();
    pollingRef.current = window.setInterval(() => {
      poll();
    }, 1000);
  }

  function stopPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }

  async function poll() {
    try {
      const res = await fetch("/api/admin/sync", { method: "GET", credentials: "same-origin" });
      if (!res.ok) {
        const text = await res.text();
        setErrorMsg(`Poll failed: ${res.status} ${text}`);
        return;
      }
      const json = await res.json();
      if (!json.ok) {
        // Some implementations return { ok: true, ... } for GET; tolerate but surface message
      }
      const snap = json.snapshot ?? json;
      setSnapshot(snap ?? null);

      // derive running state
      const runningFlag = Boolean(json.running ?? false);
      setRunning(runningFlag);
      setStatus(runningFlag ? "running" : (snap?.latestSummary?.aborted ? "aborted" : "idle"));

      // derive events and metrics
      const evs: ProgressEvent[] = Array.isArray(snap?.events) ? snap.events.slice(-10) : [];
      setEvents(evs);
      setLastLine(renderLastLine(evs));
      setApiCalls(Number(snap?.latestSummary?.apiCalls ?? 0));
      setEstimated(typeof snap?.latestSummary?.totalAreasSearched === "number" ? snap.latestSummary.totalAreasSearched : null);
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Poll exception: ${m}`);
    }
  }

  function renderLastLine(evs: ProgressEvent[]) {
    if (!evs || evs.length === 0) return "";
    const last = evs[evs.length - 1];
    if (!last || typeof last !== "object") return String(last);
    switch (last.type) {
      case "search-complete":
        return `${last.id} — ${last.resultCount} results — api=${last.apiCalls}${last.subdivided ? " — subdivided" : ""}`;
      case "search-start":
        return `start ${last.id}`;
      case "subdivision-created":
        return `subdivision ${last.parentId} → ${Array.isArray(last.children) ? last.children.join(", ") : ""}`;
      case "start":
        return `start (~${last.totalEstimatedSearches ?? "-"})`;
      case "abort":
        return `abort — ${last.reason ?? "unknown"}`;
      case "complete":
        return `complete — ${last.totalAreasSearched ?? "-"}`;
      default:
        return JSON.stringify(last);
    }
  }

  async function handleStart() {
    setErrorMsg(null);

    if (mode === "production") {
      // Require explicit confirmation checkbox and a final confirm dialog.
      if (!confirmProduction) {
        setErrorMsg("Please confirm you understand this will use many API calls.");
        return;
      }
      const ok = window.confirm("This will use ~200+ API calls. Continue?");
      if (!ok) return;
    }

    try {
      // POST start
      const body = { action: "start", mode, options: {} as any };
      // For safety, when production leave options empty; for advanced use we could include maxApiCalls.
      const res = await fetch("/api/admin/sync", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "x-admin-secret": process.env.NEXT_PUBLIC_ADMIN_SECRET ?? "" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        const err = json?.error ?? `HTTP ${res.status}`;
        setErrorMsg(`Start failed: ${err}`);
        return;
      }
      if (json.started) {
        setStatus("running");
        setRunning(true);
        setErrorMsg(null);
        // immediate poll to update UI quickly
        poll();
      } else {
        setErrorMsg(`Start response: ${JSON.stringify(json)}`);
      }
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Start exception: ${m}`);
    }
  }

  async function handleAbort() {
    setErrorMsg(null);
    try {
      const res = await fetch("/api/admin/sync", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "abort" }),
      });
      const json = await res.json();
      if (!res.ok) {
        const err = json?.error ?? `HTTP ${res.status}`;
        setErrorMsg(`Abort failed: ${err}`);
        return;
      }
      if (json.aborted) {
        setStatus("aborted");
        setRunning(false);
        // quick poll to reflect abort event
        poll();
      } else {
        setErrorMsg(`Abort response: ${JSON.stringify(json)}`);
      }
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Abort exception: ${m}`);
    }
  }

  // Derived UI bits
  const recent = events ?? [];
  const processedLabel = snapshot?.latestSummary?.totalAreasSearched ?? "-";
  const estimatedLabel = estimated ?? "-";

  return (
    <div style={{ display: "block", maxWidth: 640 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#374151", marginBottom: 4 }}>Mode</label>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setMode("test")}
              disabled={running}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: `1px solid ${mode === "test" ? "#10B981" : "#D1D5DB"}`,
                background: mode === "test" ? "#ECFDF5" : "#fff",
                cursor: running ? "not-allowed" : "pointer",
                fontWeight: 700,
              }}
            >
              Test
            </button>
            <button
              onClick={() => setMode("production")}
              disabled={running}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: `1px solid ${mode === "production" ? "#F59E0B" : "#D1D5DB"}`,
                background: mode === "production" ? "#FFFBEB" : "#fff",
                cursor: running ? "not-allowed" : "pointer",
                fontWeight: 700,
              }}
            >
              Production
            </button>
          </div>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            onClick={handleStart}
            disabled={running || (mode === "production" && !confirmProduction)}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "none",
              background: running ? "#9CA3AF" : "#6B7280",
              color: "#fff",
              fontWeight: 700,
              cursor: running ? "not-allowed" : "pointer",
            }}
            title={mode === "production" ? "Production runs require confirmation" : "Start a test sync"}
          >
            {running ? "Running..." : `Start ${mode === "test" ? "Test" : "Production"} Sync`}
          </button>

          {running ? (
            <button
              onClick={handleAbort}
              style={{
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid #EF4444",
                background: "#FFF1F2",
                color: "#B91C1C",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Abort Sync
            </button>
          ) : null}
        </div>
      </div>

      {/* Production confirmation checkbox and safety note */}
      {mode === "production" ? (
        <div style={{ marginBottom: 8, display: "flex", gap: 8, alignItems: "center" }}>
          <input
            id="confirm-production"
            type="checkbox"
            checked={confirmProduction}
            onChange={(e) => setConfirmProduction(e.target.checked)}
            disabled={running}
          />
          <label htmlFor="confirm-production" style={{ fontSize: 13 }}>
            I understand this will use many API calls (estimate: ~200+). Enable to start.
          </label>
        </div>
      ) : null}

      {/* Progress panel */}
      <div
        style={{
          border: "1px solid #E5E7EB",
          padding: 10,
          borderRadius: 8,
          background: "#fff",
          color: "#111827",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ fontWeight: 700 }}>Sync Progress</div>
          <div style={{ fontSize: 13, color: "#6B7280" }}>{status}</div>
        </div>

        <div style={{ fontSize: 13, marginBottom: 6 }}>
          Mode: <strong>{mode}</strong> — Processed: <strong>{processedLabel}</strong> / <strong>{estimatedLabel}</strong>
        </div>

        <div style={{ fontSize: 13, marginBottom: 6 }}>API calls used (so far): <strong>{apiCalls}</strong></div>

        <div style={{ marginBottom: 6, fontSize: 13 }}>
          Last event: <span style={{ fontWeight: 700 }}>{lastLine || "—"}</span>
        </div>

        <div style={{ maxHeight: 160, overflow: "auto", borderTop: "1px dashed #E5E7EB", paddingTop: 6 }}>
          {recent.length === 0 ? (
            <div style={{ color: "#6B7280", fontSize: 13 }}>No events yet.</div>
          ) : (
            recent
              .slice()
              .reverse()
              .map((ev, idx) => (
                <div key={idx} style={{ fontSize: 12, padding: "6px 0", borderBottom: idx === recent.length - 1 ? "none" : "1px solid #F3F4F6" }}>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>
                    {ev.type ?? "(event)"}
                  </div>
                  <div style={{ color: "#374151", fontSize: 12 }}>
                    {renderLastLine([ev])}
                  </div>
                </div>
              ))
          )}
        </div>

        {errorMsg ? <div style={{ color: "#B91C1C", marginTop: 8 }}>{errorMsg}</div> : null}
      </div>
    </div>
  );
}