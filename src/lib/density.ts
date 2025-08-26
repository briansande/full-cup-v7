/**
 * Density utilities for adaptive sync.
 *
 * Exports:
 * - type NearbySearchResult
 * - async function nearbySearchWithPagination(params)
 * - function generateSubdivisionPoints(parent, options)
 *
 * Notes:
 * - Uses Google Places API v1 "searchNearby" for nearby searches:
 *   https://places.googleapis.com/v1/places:searchNearby
 * - searchNearby doesn't support pagination - max 20 results per call
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
  maxPages?: number; // ignored since searchNearby doesn't support pagination
};

interface PlacesNearbyResponse {
  places?: NearbyPlace[];
  results?: NearbyPlace[];
}

/**
 * nearbySearchWithPagination
 *
 * Perform a Places "nearby" search using the New Places API v1 searchNearby.
 * Note: Despite the name, this function no longer supports pagination as the 
 * searchNearby endpoint doesn't support it. Returns up to 20 results max.
 *
 * Returns unique places (deduped by id), number of API calls made, and hitLimit flag.
 */
export async function nearbySearchWithPagination(params: NearbySearchParams): Promise<NearbySearchResult> {
  const { lat, lng, radius } = params; // maxPages and keyword are ignored
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
    "places.userRatingCount"
  ].join(",");

  const aggregatedById = new Map<string, NearbyPlace>();
  let apiCalls = 0;

  try {
    // Request body for Nearby Search (v1) - single request only
    const body = {
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius,
        },
      },
      // Focus on cafes/coffee shops
      includedTypes: ["cafe"],
      maxResultCount: 20, // Maximum allowed by searchNearby endpoint
    };

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
    const places: NearbyPlace[] = Array.isArray(json.places)
      ? json.places
      : Array.isArray(json.results)
      ? json.results
      : [];

    // Verbose debug when empty/unexpected shape to aid diagnosis
    if (places.length === 0) {
      try {
        // eslint-disable-next-line no-console
        console.info(
          `[density] Debug: empty/missing results — lat=${lat} lng=${lng} radius=${radius} apiCalls=${apiCalls}`
        );
        // eslint-disable-next-line no-console
        console.debug("[density] Full Places API response:", json);
      } catch {
        // eslint-disable-next-line no-console
        console.info("[density] Debug: failed to log Places API response");
      }
    }

    for (const p of places) {
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
  } catch (err) {
    // Non-fatal error: return partial results and indicate no hitLimit
    // eslint-disable-next-line no-console
    console.error("[density] Error during nearbySearchWithPagination:", err);
    return { places: Array.from(aggregatedById.values()), apiCalls, hitLimit: false };
  }

  const finalPlaces = Array.from(aggregatedById.values());
  // Since searchNearby doesn't support pagination, we can only get max 20 results
  // Set hitLimit to true if we got exactly 20 results (indicating there might be more)
  const hitLimit = finalPlaces.length === 20;
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