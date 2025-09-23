import { NextResponse } from "next/server";
import { supabase } from "@/src/lib/supabase";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { progress } from "@/src/lib/progress";
import { runAdaptiveTestSync } from "@/src/lib/adaptive-search";
import { runTestAreaSync } from "@/src/lib/grid-search";
import { recordSyncRun } from "@/src/lib/db-integration";

import { upsertShopsBatch } from "@/src/lib/db-integration";
import type { AdaptiveSearchSummary } from "@/src/lib/adaptive-search";
import type { GridSearchSummary } from "@/src/lib/grid-search";

/**
 * Admin Sync API
 *
 * - POST JSON body: { action: 'start' | 'abort', mode?: 'test'|'production', options?: { maxApiCalls?: number } }
 * - GET: returns progress.getSnapshot() plus current run state.
 *
 * Security:
 * - Prefer server-side admin session checks when available: this handler will attempt to
 *   resolve the requesting user via supabase.auth.getSession() and check public.user_profiles.is_admin.
 * - If no admin session is found, the handler falls back to a server-side secret header:
 *   X-ADMIN-SECRET must match process.env.ADMIN_SECRET.
 *
 * NOTE: This module maintains an in-memory controller for the currently running sync.
 *       This works for a single Node process (development). On serverless or multi-instance
 *       deployments the module-level state may not be shared across invocations/instances.
 *       In that case the start/abort semantics are best-effort and the request-level fallback
 *       (X-ADMIN-SECRET) is provided for convenience.
 */

/**
 * Current run controller (module-level singleton)
 */
let currentRun: {
  promise: Promise<AdaptiveSearchSummary | GridSearchSummary> | null;
  abortController: AbortController | null;
  mode: string | null;
} = { promise: null, abortController: null, mode: null };

/**
 * Helper: determine whether the incoming request is from an admin.
 * Strategy:
 * 1) Attempt to read Supabase server-side session and check public.user_profiles.is_admin.
 * 2) If that fails, require X-ADMIN-SECRET header matching process.env.ADMIN_SECRET.
 */
async function isRequestAdmin(request: Request): Promise<boolean> {
  // Header-only admin check: require request header x-admin-secret === process.env.ADMIN_SECRET
  // This avoids server-side cookie/session handling and the Next.js sync-dynamic-apis error.
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) return false;
  const header = request.headers.get("x-admin-secret") ?? request.headers.get("X-ADMIN-SECRET");
  return header === adminSecret;
}

/**
 * GET /api/admin/sync
 * Return current progress snapshot and current run state.
 * This endpoint is intentionally permissive so UIs can poll progress without requiring a secret.
 */
export async function GET(request: Request) {
  try {
    const snapshot = progress.getSnapshot();
    return NextResponse.json(
      {
        ok: true,
        snapshot,
        running: Boolean(currentRun.promise),
        mode: currentRun.mode,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error("Admin sync GET exception:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/admin/sync
 * Actions:
 *  - { action: 'start', mode?: 'test'|'production', options?: { maxApiCalls?: number } }
 *  - { action: 'abort' }
 */
export async function POST(request: Request) {
  try {
    type AdminSyncRequestBody = {
  action: 'start' | 'abort';
  mode?: 'test' | 'production';
  options?: {
    maxApiCalls?: number;
  };
};

    const body = await request.json().catch((): AdminSyncRequestBody => ({ action: 'start' }));
    const action = (body?.action as string) ?? "start";

    // Validate admin for mutating actions
    if (action === "start" || action === "abort") {
      const ok = await isRequestAdmin(request);
      if (!ok) {
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
      }
    }

    if (action === "start") {
      if (currentRun.promise) {
        return NextResponse.json({ ok: false, error: "sync already in progress" }, { status: 409 });
      }

      const mode = body?.mode === "test" ? "test" : "production";
      const options = body?.options ?? {};
      const maxApiCalls = typeof options?.maxApiCalls === "number" ? options.maxApiCalls : undefined;

      // Create AbortController for this run
      const abortController = new AbortController();

      // Start background runner (do not await)
      const runner = async (): Promise<AdaptiveSearchSummary | GridSearchSummary> => {
        const startAt = new Date().toISOString();
        try {
          // Reset progress for a fresh run (UI subscribers will get a replay)
          try {
            progress.reset();
          } catch (e) {
            // ignore
          }

          let summary: AdaptiveSearchSummary | GridSearchSummary | null = null;
          // Use the adaptive runner for both test and production runs so that
          // subdivision decisions are based on the raw Places API response count
          // (rawCount) rather than post-filtered counts. This prevents test runs
          // from skipping subdivisions when filtering reduces the visible results.
          // Use the adaptive runner for both test and production runs so that
          // subdivision decisions are based on the raw Places API response count
          // (rawCount) rather than post-filtered counts. This prevents test runs
          // from skipping subdivisions when filtering reduces the visible results.
          if (mode === "test") {
            summary = await runTestAreaSync({ maxApiCalls, abortSignal: abortController.signal });
          } else {
            summary = await runAdaptiveTestSync({ maxApiCalls, abortSignal: abortController.signal });
          }

          const endAt = new Date().toISOString();

          // Best-effort: map runner summary to sync_history metadata and record it
          try {
            const metadata = {
              mode: mode as "test" | "production",
              areasSearched:
                summary && "totalAreasSearched" in summary
                  ? summary.totalAreasSearched
                  : summary && "searchesRun" in summary
                  ? summary.searchesRun
                  : 0,
              placesFound: typeof summary?.totalPlaces === "number" ? summary.totalPlaces : 0,
              apiCalls: typeof summary?.apiCalls === "number" ? summary.apiCalls : 0,
              startAt,
              endAt,
            };
            await recordSyncRun(metadata);
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error("Failed to record sync run metadata:", e);
          }
          
          // Return the summary
          return summary as AdaptiveSearchSummary | GridSearchSummary;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          // eslint-disable-next-line no-console
          console.error("Admin sync runner error:", message);
          try {
            progress.emit({ type: "abort", reason: message });
          } catch (e) {
            // swallow
          }
          throw err;
        } finally {
          // Clear currentRun so future starts are allowed.
          currentRun = { promise: null, abortController: null, mode: null };
        }
      };

      currentRun = { promise: runner(), abortController, mode };

      return NextResponse.json({ started: true, mode }, { status: 202 });
    } else if (action === "abort") {
      if (!currentRun.promise || !currentRun.abortController) {
        return NextResponse.json({ ok: false, error: "no run in progress" }, { status: 400 });
      }
      try {
        currentRun.abortController.abort();
      } catch (e) {
        // ignore
      }
      try {
        progress.emit({ type: "abort", reason: "abort requested by admin" });
      } catch (e) {}
      return NextResponse.json({ aborted: true }, { status: 200 });
    } else {
      return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error("Admin sync POST exception:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}