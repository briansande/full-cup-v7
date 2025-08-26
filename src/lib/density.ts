/**
 * Density utilities for adaptive sync.
 *
 * Exports:
 * - type NearbySearchResult = { places: any[]; apiCalls: number; hitLimit: boolean }
 * - async function nearbySearchWithPagination(params)
 * - function generateSubdivisionPoints(parent, options)
 *
 * Assumptions & notes:
 * - We use Google's "Places" HTTP API (v1-style / New Places API patterns where possible).
 *   The existing project already uses a v1 Text Search endpoint (`places.googleapis.com/v1/places:searchText`).
 *   For nearby-search style pagination we perform POST requests to `https://places.googleapis.com/v1/places:search`
 *   and follow the common next_page_token pattern (token present -> wait a short delay -> request next page).
 *
 * - Heuristics:
 *   - LAT_DEGREES_PER_KM = 0.009  (approx; used in grid.ts and matched here)
 *   - LNG_DEGREES_PER_KM = LAT_DEGREES_PER_KM / cos(latRadians)
 *   - Default subdivision offsetKm = 1 (approx ~1 km), default radius = 1000 meters.
 *
 * - Pagination logic:
 *   - We will attempt up to maxPages (default 3) pages to match the Places API behaviour (3 pages × ~20 results = ~60 max).
 *   - We conservatively set hitLimit = true when either:
 *       a) aggregated unique results count === 60, OR
 *       b) we observed a next_page_token during paging AND the aggregated unique results reached 60.
 *     This follows the task's request for conservative detection.
 *
 * - Error handling:
 *   - On non-fatal network/parsing errors we return partial results with hitLimit = false and the apiCalls made so far.
 *
 * - Notes on "place id" normalization:
 *   - Different Places endpoints sometimes return `place_id`, `id`, or `name` - we prefer `place_id` when available,
 *     and fall back to `id`. We dedupe aggregated results by that normalized id when possible.
 *
 * Security note:
 * - The project stores the API key in NEXT_PUBLIC_GOOGLE_MAPS_API_KEY. Ideally a server-only key should be used
 *   for web-service calls; we follow the project convention here but callers should be aware of this limitation.
 */

import type { GridPoint } from "./grid";

export type NearbySearchResult = {
  places: any[];
  apiCalls: number;
  hitLimit: boolean;
};

type NearbySearchParams = {
  lat: number;
  lng: number;
  radius: number; // meters
  keyword?: string;
  maxPages?: number; // max number of pages to fetch (default 3)
};

/**
 * nearbySearchWithPagination
 *
 * Perform a Places "nearby"-style search using the New Places API pattern and handle pagination (up to 3 pages).
 *
 * Returns aggregated unique places (deduped by place_id or id), the number of API calls made, and hitLimit boolean.
 */
export async function nearbySearchWithPagination(params: NearbySearchParams): Promise<NearbySearchResult> {
  const { lat, lng, radius, keyword, maxPages = 3 } = params;
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) {
    throw new Error("Missing Google Maps API key (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)");
  }

  // Helper for one-page request. We call a v1-style endpoint with a POST body. If you prefer a different endpoint
  // (e.g., the legacy maps.googleapis.com nearbysearch/json) adjust the URL and parameters here.
  const endpoint = "https://places.googleapis.com/v1/places:search";

  const fields = [
    "places.id",
    "places.name",
    "places.location",
    "places.types",
    "places.businessStatus",
    "places.rating",
    "places.userRatingCount",
  ].join(",");

  const aggregatedById = new Map<string, any>();
  let apiCalls = 0;
  let pageToken: string | undefined = undefined;
  let anyNextTokenObserved = false;

  try {
    for (let page = 0; page < Math.min(maxPages, 3); page++) {
      // Build request body. For the initial page include location + radius; for subsequent pages include pageToken.
      const body: any = {
        // location is consistent with v1 search patterns
        location: { lat, lng },
        radiusMeters: radius,
        pageSize: 20, // attempt to request up to 20 per page (server may cap)
      };
      if (keyword) body.query = keyword;
      if (pageToken) {
        // v1-style page token key (if the API expects query param for legacy endpoints, this will sometimes work differently).
        body.pageToken = pageToken;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": fields,
        },
        body: JSON.stringify(body),
      });

      apiCalls++;

      if (!res.ok) {
        // Non-fatal per task: return partial results with hitLimit=false
        // Surface only the most helpful error in console; return what we've got.
        try {
          const errText = await res.text();
          console.error(`[density] Places API returned HTTP ${res.status}: ${errText}`);
        } catch (e) {
          console.error("[density] Places API returned non-OK status and failed to read body.");
        }
        return { places: Array.from(aggregatedById.values()), apiCalls, hitLimit: false };
      }

      const json = await res.json();

      // Normalize the returned places array from known shapes
      const pagePlaces: any[] = (json.places as any[]) ?? (json.results as any[]) ?? [];

      for (const p of pagePlaces) {
        // Normalize id (prefer place_id if present, otherwise id)
        const pid = (p.place_id as string) ?? (p.placeId as string) ?? (p.id as string) ?? (p.name as string);
        if (!pid) {
          // If absolutely no identifier, attempt to stringify coordinates + name fallback
          const latVal = p.location?.lat ?? p.geometry?.location?.lat ?? "";
          const lngVal = p.location?.lng ?? p.geometry?.location?.lng ?? "";
          const fallbackId = `unknown-${latVal}-${lngVal}-${p.name ?? ""}`;
          if (!aggregatedById.has(fallbackId)) aggregatedById.set(fallbackId, p);
        } else {
          if (!aggregatedById.has(pid)) aggregatedById.set(pid, p);
        }
      }

      // Check for next page token in common shapes
      const token = (json.next_page_token as string) ?? (json.nextPageToken as string) ?? (json.next_page_token?.token as string);
      if (token) {
        anyNextTokenObserved = true;
        pageToken = token;

        // Conservative: when token provided, the token sometimes requires ~2 seconds to become valid.
        // We'll wait a short time before attempting to fetch the next page.
        // However, if we've reached maxPages (or aggregated 60) we'll stop.
        const total = aggregatedById.size;
        if (total >= 60) {
          // reached the known Places upper bound; stop and mark hitLimit per spec
          return { places: Array.from(aggregatedById.values()), apiCalls, hitLimit: true };
        }

        // Wait before next page request (if we will attempt it).
        // The Places API commonly requires ~2 seconds before a next_page_token becomes valid.
        await new Promise((resolve) => setTimeout(resolve, 2000));
        // continue to next iteration to fetch next page
      } else {
        // No token -> no more pages
        break;
      }
    }
  } catch (err) {
    // Non-fatal error: return partial results and indicate no hitLimit
    console.error("[density] Error during nearbySearchWithPagination:", err);
    return { places: Array.from(aggregatedById.values()), apiCalls, hitLimit: false };
  }

  const finalPlaces = Array.from(aggregatedById.values());
  const hitLimit = finalPlaces.length >= 60 || (anyNextTokenObserved && finalPlaces.length >= 60);
  return { places: finalPlaces, apiCalls, hitLimit };
}

/**
 * generateSubdivisionPoints
 *
 * Given a parent GridPoint (id, lat, lng, level) create 4 subdivision GridPoint objects:
 *  - NE, NW, SE, SW
 *
 * Uses approximations:
 *  - LAT_DEGREES_PER_KM = 0.009
 *  - LNG_DEGREES_PER_KM = LAT_DEGREES_PER_KM / cos(latRadians)
 *
 * Default offsetKm = 1 (approx ~1 km) and radius = 1000 (meters)
 */
export function generateSubdivisionPoints(
  parent: { id: string; lat: number; lng: number; level: number },
  options?: { offsetKm?: number; radius?: number }
): GridPoint[] {
  const LAT_DEGREES_PER_KM = 0.009; // matched to grid.ts approximation
  const offsetKm = options?.offsetKm ?? 1;
  const radius = options?.radius ?? 1000; // meters

  const latRad = (parent.lat * Math.PI) / 180;
  const lngDegreesPerKm = LAT_DEGREES_PER_KM / Math.cos(latRad);

  const latDelta = offsetKm * LAT_DEGREES_PER_KM;
  const lngDelta = offsetKm * lngDegreesPerKm;

  const nextLevel = parent.level + 1;

  const points: GridPoint[] = [
    {
      id: `${parent.id}-sub-NE`,
      lat: parent.lat + latDelta,
      lng: parent.lng + lngDelta,
      radius,
      level: nextLevel,
    },
    {
      id: `${parent.id}-sub-NW`,
      lat: parent.lat + latDelta,
      lng: parent.lng - lngDelta,
      radius,
      level: nextLevel,
    },
    {
      id: `${parent.id}-sub-SE`,
      lat: parent.lat - latDelta,
      lng: parent.lng + lngDelta,
      radius,
      level: nextLevel,
    },
    {
      id: `${parent.id}-sub-SW`,
      lat: parent.lat - latDelta,
      lng: parent.lng - lngDelta,
      radius,
      level: nextLevel,
    },
  ];

  return points;
}