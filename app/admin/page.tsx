"use client";

import React, { useEffect, useState } from "react";
import Auth from "@/src/components/Auth";
import { supabase } from "@/src/lib/supabase";
import AdminSyncControls from "@/src/components/AdminSyncControls";

/**
 * Basic Admin dashboard
 *
 * Features:
 * - Shows signed-in user id/email
 * - Shows whether the user is admin (reads public.user_profiles.is_admin)
 * - Manual "Trigger Sync" button which calls /api/admin/sync
 * - Shows total coffee_shops count (fresh from Supabase)
 * - Shows recent sync history (calls /api/admin/sync/history)
 *
 * Note: The user must manually set themselves as admin in the database by
 * toggling public.user_profiles.is_admin = true for their auth user id.
 */

type SyncRow = {
  id: string;
  started_at: string | null;
  finished_at: string | null;
  inserted_count: number | null;
  updated_count: number | null;
  status: "started" | "success" | "failed" | string;
  error: string | null;
  requested_by: string | null;
  requested_email: string | null;
};

export default function AdminPage() {
  const [sessionUser, setSessionUser] = useState<{ id: string; email?: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [shopsCount, setShopsCount] = useState<number | null>(null);
  const [history, setHistory] = useState<SyncRow[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData?.session?.user ?? null;
        if (!mounted) return;

        if (user) {
          setSessionUser({ id: user.id, email: user.email ?? undefined });
          // Query user_profiles to check admin flag (if table exists)
          try {
            const res = await supabase
              .from("user_profiles")
              .select("is_admin")
              .eq("id", user.id)
              .limit(1)
              .single();

            if (!mounted) return;
            if (!res.error && res.data) {
              setIsAdmin(Boolean((res.data as any).is_admin));
            } else {
              // If table missing or no row, default to false
              setIsAdmin(false);
            }
          } catch {
            setIsAdmin(false);
          }
        } else {
          setSessionUser(null);
          setIsAdmin(false);
        }
      } catch {
        setSessionUser(null);
        setIsAdmin(false);
      }

      await Promise.all([fetchStats(), fetchHistory()]);
    }

    bootstrap();

    // Listen for sync events to refresh stats/history
    const handler = () => {
      fetchStats();
      fetchHistory();
    };
    window.addEventListener("fullcup:sync", handler);

    return () => {
      mounted = false;
      window.removeEventListener("fullcup:sync", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchStats() {
    setLoadingStats(true);
    setMessage(null);
    try {
      // Use head:true + count exact to get total count
      const res = await supabase.from("coffee_shops").select("*", { count: "exact", head: true });
      if (res.error) {
        console.error("Failed to fetch coffee_shops count:", res.error);
        setShopsCount(null);
        setMessage("Failed to load stats");
      } else {
        
        const cnt = (res as any).count;
        setShopsCount(typeof cnt === "number" ? cnt : null);
      }
    } catch (err) {
      setShopsCount(null);
      setMessage("Failed to load stats");
    } finally {
      setLoadingStats(false);
    }
  }

  async function fetchHistory() {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/admin/sync/history?limit=10");
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json?.error ?? `HTTP ${res.status}`);
      }
      // Normalize data to ensure fields exist
      const norm = (json.data ?? []).map((r: any) => ({
        id: r.id,
        started_at: r.started_at ?? null,
        finished_at: r.finished_at ?? null,
        inserted_count: typeof r.inserted_count === "number" ? r.inserted_count : null,
        updated_count: typeof r.updated_count === "number" ? r.updated_count : null,
        status: r.status ?? "started",
        error: r.error ?? null,
        requested_by: r.requested_by ?? null,
        requested_email: r.requested_email ?? null,
      })) as SyncRow[];
      setHistory(norm);
    } catch (err: unknown) {
      setHistory([]);
      const m = err instanceof Error ? err.message : String(err);
      console.error("Failed to load sync history:", m);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function handleTriggerSync() {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json?.error ?? `HTTP ${res.status}`);
      }
      const inserted = json.inserted ?? 0;
      const updated = json.updated ?? 0;
      setMessage(`Sync complete — inserted ${inserted} shops, updated ${updated} shops.`);
      // Refresh local stats & history
      await Promise.all([fetchStats(), fetchHistory()]);

      // Notify other components that listen to sync events
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("fullcup:sync"));
      }
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : String(err);
      setMessage(`Sync failed: ${m}`);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Admin Dashboard</h1>

      <div className="mb-6">
        <p>
          This page provides simple sync management: trigger a manual Google Places sync and view recent syncs.
        </p>
      </div>

      <section className="mb-6 border p-4 rounded">
        <h2 className="font-semibold mb-2">Authentication</h2>
        <div className="mb-3">
          <Auth />
        </div>

        {/* Admin sync controls (client component) */}
        <div id="sync-controls" className="mb-4">
          <AdminSyncControls />
        </div>

        <div>
          <div className="text-sm text-gray-600">
            Signed in user:
            {sessionUser ? (
              <span className="ml-2 font-medium">
                {sessionUser.email ?? "(no email)"} ({sessionUser.id})
              </span>
            ) : (
              <span className="ml-2 font-medium">Not signed in</span>
            )}
          </div>

          <div className="mt-2 text-sm">
            Admin enabled:
            <span className="ml-2 font-medium">{isAdmin ? "Yes" : "No"}</span>
          </div>

          {!isAdmin && sessionUser ? (
            <div className="mt-2 text-sm text-yellow-700">
              To enable admin features for your account, set your row in{" "}
              <code>public.user_profiles</code> with <code>is_admin = true</code> for id ={" "}
              <strong>{sessionUser.id}</strong>. I will ask you to run that manually in the database.
            </div>
          ) : null}
        </div>
      </section>

      <section className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="border p-4 rounded">
          <h3 className="font-semibold">Total coffee shops</h3>
          <div className="mt-3 text-3xl font-bold">
            {loadingStats ? "…" : shopsCount ?? "N/A"}
          </div>
        </div>

        <div className="border p-4 rounded">
          <h3 className="font-semibold">Manual sync</h3>
          <div className="mt-3">
            <button
              onClick={handleTriggerSync}
              disabled={syncing || !sessionUser}
              className="px-4 py-2 rounded bg-[var(--coffee-brown)] text-[var(--cream)] font-semibold"
            >
              {syncing ? "Syncing..." : "Trigger Sync"}
            </button>
            <div className="mt-2 text-sm">{message}</div>
            {!sessionUser ? <div className="mt-2 text-sm">Sign in to trigger a sync.</div> : null}
          </div>
        </div>
      </section>

      <section className="border p-4 rounded">
        <h3 className="font-semibold mb-3">Recent sync history</h3>
        {loadingHistory ? (
          <div>Loading…</div>
        ) : history.length === 0 ? (
          <div className="text-sm text-gray-600">No recent syncs</div>
        ) : (
          <div className="space-y-3">
            {history.map((row) => (
              <div key={row.id} className="p-3 border rounded">
                <div className="text-sm text-gray-600">
                  Started: {row.started_at ? new Date(row.started_at).toLocaleString() : "—"}
                </div>
                <div className="text-sm text-gray-600">
                  Finished: {row.finished_at ? new Date(row.finished_at).toLocaleString() : "—"}
                </div>
                <div className="mt-1">
                  Status: <span className="font-medium">{row.status}</span>
                  {(typeof row.inserted_count === "number" || typeof row.updated_count === "number") ? (
                    <>
                      {typeof row.inserted_count === "number" ? <span className="ml-3">Inserted: {row.inserted_count}</span> : null}
                      {typeof row.updated_count === "number" ? <span className="ml-3">Updated: {row.updated_count}</span> : null}
                    </>
                  ) : null}
                </div>
                {row.requested_email ? (
                  <div className="mt-1 text-sm text-gray-600">Requested by: {row.requested_email}</div>
                ) : null}
                {row.error ? <div className="mt-2 text-sm text-red-600">Error: {row.error}</div> : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}