/**
 * Density utilities for adaptive sync.
 *
 * Exports:
 * - type NearbySearchResult
 * - async function nearbySearchWithPagination(params)
 * - function generateSubdivisionPoints(parent, options)
 *
 * Notes:
 * - Uses Google Places API v1 "searchNearby" for paginated nearby searches:
 *   https://places.googleapis.com/v1/places:searchNearby
 * - We keep pagination to a max of 3 pages (~60 results) and set hitLimit=true conservatively.
 * - No explicit "any" types to satisfy ESLint.
 */

import type { GridPoint } from "./grid";

/* Minimal shape for nearby search items we operate on across the app */
export type NearbyPlace = {
  id?: string;
  place_id?: string;
  placeId?: string;
  name?: string;
  displayName?: {
    text: string;
    languageCode?: string;
  };
  formattedAddress?: string;
  location?:
    | { latitude?: number; longitude?: number } // v1 Places canonical
    | { lat?: number; lng?: number }; // legacy-like shapes if present
  geometry?: {
    location?: {
      lat?: number;
      lng?: number;
    };
  };
  types?: string[];
  businessStatus?: string;
  rating?: number;
  userRatingCount?: number;
};

export type NearbySearchResult = {
  places: NearbyPlace[];
  apiCalls: number;
  hitLimit: boolean;
};

type NearbySearchParams = {
  lat: number;
  lng: number;
  radius: number; // meters
  keyword?: string; // ignored for searchNearby (type-based); retained for compatibility
  maxPages?: number; // max number of pages to fetch (default 3)
};

interface PlacesNearbyResponse {
  places?: NearbyPlace[];
  results?: NearbyPlace[];
  nextPageToken?: string;
  next_page_token?:
    | string
    | {
        token?: string;
      };
}

/**
 * nearbySearchWithPagination
 *
 * Perform a Places "nearby" search using the New Places API v1 searchNearby and handle pagination (up to 3 pages).
 *
 * Returns aggregated unique places (deduped by id), number of API calls made, and hitLimit flag when we conservatively
 * detect the upper bound (~60 results across 3 pages).
 */
export async function nearbySearchWithPagination(params: NearbySearchParams): Promise<NearbySearchResult> {
  const { lat, lng, radius, maxPages = 3 } = params; // keyword intentionally unused
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) {
    throw new Error("Missing Google Maps API key (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)");
  }

  const endpoint = "https://places.googleapis.com/v1/places:searchNearby";

  // Field mask should request displayName (not just name), formattedAddress, id, location, etc.
  const fields = [
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.location",
    "places.types",
    "places.businessStatus",
    "places.rating",
    "places.userRatingCount",
    "nextPageToken"
  ].join(",");

  const aggregatedById = new Map<string, NearbyPlace>();
  let apiCalls = 0;
  let pageToken: string | undefined = undefined;
  let anyNextTokenObserved = false;

  try {
    for (let page = 0; page < Math.min(maxPages, 3); page++) {
      // Request body for Nearby Search (v1)
      const body: {
        locationRestriction: {
          circle: {
            center: { latitude: number; longitude: number };
            radius: number;
          };
        };
        includedTypes?: string[];
        pageSize?: number;
        pageToken?: string;
      } = {
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius,
          },
        },
        // Focus on cafes/coffee shops
        includedTypes: ["cafe"],
        pageSize: 20,
      };
      if (pageToken) {
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
        try {
          const errText = await res.text();
          // eslint-disable-next-line no-console
          console.error(`[density] Places API returned HTTP ${res.status}: ${errText}`);
        } catch {
          // eslint-disable-next-line no-console
          console.error("[density] Places API returned non-OK status and failed to read body.");
        }
        return { places: Array.from(aggregatedById.values()), apiCalls, hitLimit: false };
      }

      const json = (await res.json()) as unknown as PlacesNearbyResponse;

      // Prefer canonical "places", else tolerate "results" if present
      const pagePlaces: NearbyPlace[] = Array.isArray(json.places)
        ? json.places
        : Array.isArray(json.results)
        ? json.results
        : [];

      // Verbose debug when page empty/unexpected shape to aid diagnosis
      if (pagePlaces.length === 0) {
        try {
          // eslint-disable-next-line no-console
          console.info(
            `[density] Debug: empty/missing page — lat=${lat} lng=${lng} radius=${radius} page=${page} pageToken=${pageToken} apiCalls=${apiCalls}`
          );
          // eslint-disable-next-line no-console
          console.debug("[density] Full Places API response:", json);
        } catch {
          // eslint-disable-next-line no-console
          console.info("[density] Debug: failed to log Places API response");
        }
      }

      for (const p of pagePlaces) {
        // Normalize id (prefer place_id, then placeId, then id, then resource "name")
        const pid =
          p.place_id ??
          p.placeId ??
          p.id ??
          p.name;
        if (!pid) {
          // Fallback to coordinates + name composite
          const latVal =
            (typeof (p.location as { lat?: number } | undefined)?.lat === "number"
              ? (p.location as { lat?: number }).lat
              : (p.geometry?.location?.lat ?? (p.location as { latitude?: number } | undefined)?.latitude)) ?? "";
          const lngVal =
            (typeof (p.location as { lng?: number } | undefined)?.lng === "number"
              ? (p.location as { lng?: number }).lng
              : (p.geometry?.location?.lng ?? (p.location as { longitude?: number } | undefined)?.longitude)) ?? "";
          const fallbackId = `unknown-${latVal}-${lngVal}-${p.name ?? ""}`;
          if (!aggregatedById.has(fallbackId)) aggregatedById.set(fallbackId, p);
        } else if (!aggregatedById.has(pid)) {
          aggregatedById.set(pid, p);
        }
      }

      // Next page token (v1: nextPageToken)
      const token =
        json.nextPageToken ??
        (typeof json.next_page_token === "string" ? json.next_page_token : json.next_page_token?.token);
      if (token) {
        anyNextTokenObserved = true;
        pageToken = token;

        const total = aggregatedById.size;
        if (total >= 60) {
          // Upper-bound reached; conservatively claim hitLimit
          return { places: Array.from(aggregatedById.values()), apiCalls, hitLimit: true };
        }

        // Token often needs ~2 seconds before valid; wait before fetching next page
        await new Promise<void>((resolve) => setTimeout(resolve, 2000));
      } else {
        // No further pages
        break;
      }
    }
  } catch (err) {
    // Non-fatal error: return partial results and indicate no hitLimit
    // eslint-disable-next-line no-console
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