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
 * - Enhanced filtering using includedPrimaryTypes and excludedPrimaryTypes
 * - No explicit "any" types to satisfy ESLint.
 */

import type { GridPoint } from "./grid";
import { INCLUDED_PRIMARY_TYPES, EXCLUDED_PRIMARY_TYPES } from "./coffee-filtering";

/* Enhanced shape for nearby search items we operate on across the app */
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
  primaryType?: string;
  primaryTypeDisplayName?: {
    text: string;
    languageCode?: string;
  };
  businessStatus?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: number;
  currentOpeningHours?: {
    openNow?: boolean;
    periods?: Array<{
      open: {
        day: number;
        hour: number;
        minute: number;
      };
      close?: {
        day: number;
        hour: number;
        minute: number;
      };
    }>;
    weekdayDescriptions?: string[];
  };
  regularOpeningHours?: {
    openNow?: boolean;
    periods?: Array<{
      open: {
        day: number;
        hour: number;
        minute: number;
      };
      close?: {
        day: number;
        hour: number;
        minute: number;
      };
    }>;
    weekdayDescriptions?: string[];
  };
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  shortFormattedAddress?: string;
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
 * Enhanced with proper primary type filtering and comprehensive field requests.
 * Returns unique places (deduped by id), number of API calls made, and hitLimit flag.
 */
export async function nearbySearchWithPagination(params: NearbySearchParams): Promise<NearbySearchResult> {
  const { lat, lng, radius } = params; // maxPages and keyword are ignored
  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) {
    throw new Error("Missing Google Maps API key (GOOGLE_MAPS_API_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)");
  }

  const endpoint = "https://places.googleapis.com/v1/places:searchNearby";

  // Comprehensive field mask for enhanced filtering and data quality
  const fields = [
    // Basic identification
    "places.id",
    "places.name", // Legacy field for compatibility
    "places.displayName",
    "places.formattedAddress",
    "places.shortFormattedAddress",
    
    // Location data
    "places.location",
    
    // Type information (crucial for filtering)
    "places.types",
    "places.primaryType",
    "places.primaryTypeDisplayName",
    
    // Business status and quality indicators
    "places.businessStatus",
    "places.rating",
    "places.userRatingCount",
    "places.priceLevel",
    
    // Operating hours (for coffee shop validation)
    "places.currentOpeningHours",
    "places.regularOpeningHours",
    
    // Contact information
    "places.websiteUri",
    "places.nationalPhoneNumber",
    "places.internationalPhoneNumber"
  ].join(",");

  const aggregatedById = new Map<string, NearbyPlace>();
  let apiCalls = 0;

  try {
    // Enhanced request body using primary types for better filtering
    const body = {
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius,
        },
      },
      // Use includedPrimaryTypes for precise coffee shop targeting
      includedPrimaryTypes: INCLUDED_PRIMARY_TYPES,
      // Exclude types that are definitely not coffee shops
      excludedPrimaryTypes: EXCLUDED_PRIMARY_TYPES,
      maxResultCount: 20, // Maximum allowed by searchNearby endpoint
      // Add ranking preference for better quality results
      rankPreference: "POPULARITY",
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
        
        // Log the request body for debugging API issues
        // eslint-disable-next-line no-console
        console.debug("[density] Request body that failed:", JSON.stringify(body, null, 2));
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

    // Enhanced debug logging with more context
    if (places.length === 0) {
      try {
        // eslint-disable-next-line no-console
        console.info(
          `[density] Debug: empty/missing results — lat=${lat} lng=${lng} radius=${radius} apiCalls=${apiCalls}`
        );
        // eslint-disable-next-line no-console
        console.debug("[density] Request body used:", JSON.stringify(body, null, 2));
        // eslint-disable-next-line no-console
        console.debug("[density] Full Places API response:", json);
      } catch {
        // eslint-disable-next-line no-console
        console.info("[density] Debug: failed to log Places API response");
      }
    } else {
      // Log successful results with type information
      const primaryTypes = places.map(p => p.primaryType).filter(Boolean);
      const uniqueTypes = [...new Set(primaryTypes)];
      // eslint-disable-next-line no-console
      console.info(
        `[density] Found ${places.length} places with primary types: ${uniqueTypes.join(", ")}`
      );
    }

    for (const p of places) {
      // Enhanced ID normalization with better fallbacks
      const pid =
        p.place_id ??
        p.placeId ??
        p.id ??
        p.name ??
        (p.displayName?.text);
        
      if (!pid) {
        // Enhanced fallback to coordinates + name composite
        const latVal =
          (typeof (p.location as { lat?: number } | undefined)?.lat === "number"
            ? (p.location as { lat?: number }).lat
            : (p.geometry?.location?.lat ?? (p.location as { latitude?: number } | undefined)?.latitude)) ?? "";
        const lngVal =
          (typeof (p.location as { lng?: number } | undefined)?.lng === "number"
            ? (p.location as { lng?: number }).lng
            : (p.geometry?.location?.lng ?? (p.location as { longitude?: number } | undefined)?.longitude)) ?? "";
        const displayName = p.displayName?.text ?? p.name ?? "";
        const fallbackId = `unknown-${latVal}-${lngVal}-${displayName}`;
        
        if (!aggregatedById.has(fallbackId)) {
          aggregatedById.set(fallbackId, p);
        }
      } else if (!aggregatedById.has(pid)) {
        aggregatedById.set(pid, p);
      }
    }
  } catch (err) {
    // Enhanced error logging with more context
    // eslint-disable-next-line no-console
    console.error("[density] Error during nearbySearchWithPagination:", err);
    // eslint-disable-next-line no-console
    console.error(`[density] Search context: lat=${lat}, lng=${lng}, radius=${radius}`);
    return { places: Array.from(aggregatedById.values()), apiCalls, hitLimit: false };
  }

  const finalPlaces = Array.from(aggregatedById.values());
  
  // Enhanced logging of results with type analysis
  if (finalPlaces.length > 0) {
    const typeCounts = finalPlaces.reduce((acc, place) => {
      const type = place.primaryType || "unknown";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // eslint-disable-next-line no-console
    console.info(`[density] Result type breakdown:`, typeCounts);
  }
  
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