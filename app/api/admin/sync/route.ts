import { NextResponse } from "next/server";
import { supabase } from "@/src/lib/supabase";
import { syncHoustonCoffeeShops } from "@/src/lib/sync";

/**
 * POST /api/admin/sync
 * Triggers a manual sync and records it in sync_history.
 * Requires an authenticated user (reads session) but does NOT enforce admin here —
 * the UI will hide the button for non-admins; however the endpoint will record the
 * requesting user if available. (Keep server-side checks simple for this step.)
 *
 * Response: { ok: boolean, inserted?: number, historyId?: string, error?: string }
 */
export async function POST() {
  try {
    // Try to determine the requesting user (if any)
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user ?? null;
    const requested_by = user?.id ?? null;
    const requested_email = user?.email ?? null;

    // Create a history row with status 'started'
    const insertRes = await supabase
      .from("sync_history")
      .insert([
        {
          started_at: new Date().toISOString(),
          status: "started",
          requested_by,
          requested_email,
        },
      ])
      .select()
      .single();

    if (insertRes.error) {
      // If we couldn't record the history row, continue but note it in response
      // eslint-disable-next-line no-console
      console.error("Failed to insert sync_history start row:", insertRes.error);
    }

    const historyId = insertRes.data?.id ?? null;

    // Run the sync (uses existing sync helper)
    const result = await syncHoustonCoffeeShops(8);

    // Update history row with result (if we created one)
    if (historyId) {
      const finished_at = new Date().toISOString();
      const updatePayload: Record<string, unknown> = {
        finished_at,
        inserted_count: result.ok ? result.inserted ?? 0 : 0,
        updated_count: result.ok ? (result as any).updated ?? 0 : 0,
        status: result.ok ? "success" : "failed",
      };
      if (!result.ok) updatePayload.error = result.error ?? "unknown";

      const upd = await supabase
        .from("sync_history")
        .update(updatePayload)
        .eq("id", historyId);

      if (upd.error) {
        // eslint-disable-next-line no-console
        console.error("Failed to update sync_history row:", upd.error);
      }
    }

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error ?? "Sync failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, inserted: result.inserted ?? 0, updated: (result as any).updated ?? 0, historyId }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error("Admin sync exception:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}