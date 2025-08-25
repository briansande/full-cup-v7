import { NextResponse } from "next/server";
import { searchNearbyPlaces } from "@/src/lib/google-places";

/**
 * GET /api/test-places
 * Returns 1-2 coffee shops in Houston from Google Places Text Search.
 *
 * This endpoint is intentionally small and only used for testing the
 * Google Places API connection. It does not persist any data.
 */
export async function GET() {
  try {
    const raw = await searchNearbyPlaces("coffee shops in Houston, TX", 2);
    const places = (raw ?? []).map((p) => ({
      name: p.displayName?.text ?? null,
      formatted_address: p.formattedAddress ?? null,
      place_id: p.id ?? null,
      rating: p.rating ?? null,
    }));
    return NextResponse.json({ ok: true, places }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}