import { NextResponse } from "next/server";
import { syncHoustonCoffeeShops } from "@/src/lib/sync";

/**
 * POST /api/sync
 * Triggers a small sync from Google Places into the `coffee_shops` table.
 * Keeps response minimal: { ok: boolean, inserted?: number, error?: string }
 */
export async function POST() {
  try {
    const result = await syncHoustonCoffeeShops(8);
    if (!result.ok) {
      const message = result.error ?? "Unknown error";
      // Log server-side for debugging
      // eslint-disable-next-line no-console
      console.error("Sync error:", message);
      return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
    // eslint-disable-next-line no-console
    console.log("Sync success, inserted:", result.inserted ?? 0);
    return NextResponse.json({ ok: true, inserted: result.inserted ?? 0 }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error("Sync exception:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}