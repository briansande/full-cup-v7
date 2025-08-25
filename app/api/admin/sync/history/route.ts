import { NextResponse } from "next/server";
import { supabase } from "@/src/lib/supabase";

/**
 * GET /api/admin/sync/history?limit=10
 * Returns recent sync_history rows (most recent first).
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limitParam = url.searchParams.get("limit");
    const limit = Math.max(1, Math.min(100, Number(limitParam ?? "10")));

    const res = await supabase
      .from("sync_history")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(limit);

    if (res.error) {
      // eslint-disable-next-line no-console
      console.error("Failed to fetch sync_history:", res.error);
      return NextResponse.json({ ok: false, error: String(res.error) }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: res.data ?? [] }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error("Sync history exception:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}