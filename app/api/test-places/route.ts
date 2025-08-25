import { NextResponse } from "next/server";
import { textSearchPlaces } from "@/src/lib/google-places";

/**
 * GET /api/test-places
 * Returns 1-2 coffee shops in Houston from Google Places Text Search.
 *
 * This endpoint is intentionally small and only used for testing the
 * Google Places API connection. It does not persist any data.
 */
export async function GET() {
  try {
    const places = await textSearchPlaces("coffee shops in Houston, TX", 2);
    return NextResponse.json({ ok: true, places }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}