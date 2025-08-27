/**
 * Lightweight Google Places (New) API helper for server use.
 *
 * This file provides:
 * - searchNearbyPlaces(query, limit) - uses Text Search (New) to find places
 *
 * NOTE: The project currently stores the API key in NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
 *       In a production app you'd want to use a server-only env var.
 */

export type Place = {
  id: string;
  displayName?: {
    text: string;
    languageCode: string;
  };
  formattedAddress?: string;
  types?: string[];
  location?: {
    latitude: number;
    longitude: number;
  };
  rating?: number;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  regularOpeningHours?: any;
  priceLevel?: string; // e.g., "PRICE_LEVEL_MODERATE"
  userRatingCount?: number;
  businessStatus?: string; // e.g., "OPERATIONAL"
  photos?: {
    name: string; // "places/{place_id}/photos/{photo_reference}"
    widthPx: number;
    heightPx: number;
    authorAttributions: {
      displayName: string;
      uri: string;
      photoUri: string;
    }[];
  }[];
};

export async function searchNearbyPlaces(
  query: string,
  limit = 2
): Promise<Place[]> {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) {
    throw new Error("Missing Google Maps API key (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)");
  }

  const url = "https://places.googleapis.com/v1/places:searchText";

  // These fields fall under "Essentials" and "Pro" SKUs.
  // See: https://developers.google.com/maps/documentation/places/web-service/usage-and-billing
  const fields = [
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.types",
    "places.location",
    "places.rating",
    "places.websiteUri",
    "places.nationalPhoneNumber",
    "places.regularOpeningHours",
    "places.priceLevel",
    "places.userRatingCount",
    "places.businessStatus",
    "places.photos",
  ].join(",");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": fields,
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount: limit,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Google Places API error: ${res.status} ${res.statusText} - ${errorBody}`);
  }

  const json = await res.json();

  if (json.error) {
    // Surface helpful error for debugging (e.g., invalid key, quota)
    throw new Error(`Google Places API error: ${json.error.message}`);
  }

  return (json.places as Place[]) ?? [];
}

/**
 * Fetch place details (v1 Places API) for a single place resource name/id and return the place object.
 * This is a thin helper to retrieve additional fields (e.g., photos) when the nearby search response
 * does not include them.
 *
 * @param placeIdOrResource Either a plain place_id (e.g. "ChIJ...") or a resource name like "places/{place_id}"
 */
export async function getPlaceDetails(placeIdOrResource: string) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) {
    throw new Error("Missing Google Maps API key (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)");
  }

  // Normalize resource name: if plain id provided, prefix with "places/" to form resource name
  const resourceName = placeIdOrResource.startsWith("places/") ? placeIdOrResource : `places/${placeIdOrResource}`;

  const url = `https://places.googleapis.com/v1/${resourceName}`;
  // Request only the photos field (minimal payload)
  const fields = ["places.photos", "places.displayName", "places.name"].join(",");

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": fields,
    },
  });

  if (!res.ok) {
    // Surface a small debug log but do not throw; callers can handle missing details.
    // eslint-disable-next-line no-console
    console.info(`[google-places] getPlaceDetails: HTTP ${res.status} ${res.statusText} for ${resourceName}`);
    return null;
  }

  const json = await res.json();
  return json;
}

/**
 * Given a photo name from the Place object, construct a URL to fetch the image.
 * @param photoName The `name` property of a photo object from the Places API (New).
 * @param maxWidthPx The maximum width of the photo to request.
 * @returns A full URL to the photo.
 */
export function getPhotoUrl(photoName: string, maxWidthPx = 800): string {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) {
    // This function is often called in the client, so we don't throw an error here.
    // An empty string will result in a broken image, which is a visual cue.
    return "";
  }
  return `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=${maxWidthPx}&key=${key}`;
}
