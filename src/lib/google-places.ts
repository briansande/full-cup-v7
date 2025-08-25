/**
 * Lightweight Google Places helper for server use.
 *
 * This file provides:
 * - textSearchPlaces(query, limit) - uses Text Search to find places (small result)
 * - getPlaceDetails(placeId) - uses Place Details to fetch richer metadata
 *
 * NOTE: The project currently stores the API key in NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
 *       In a production app you'd want to use a server-only env var.
 */

export type PlaceResult = {
  name: string;
  formatted_address?: string;
  place_id?: string;
  types?: string[];
  rating?: number;
};

export type PlaceDetails = {
  place_id: string;
  name: string;
  formatted_address?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  website?: string;
  rating?: number;
  price_level?: number;
  opening_hours?: any;
  photos?: string[]; // URLs
  types?: string[];
  business_status?: string | null;
};

export async function textSearchPlaces(
  query: string,
  limit = 2
): Promise<PlaceResult[]> {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) {
    throw new Error("Missing Google Maps API key (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)");
  }

  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
    query
  )}&key=${key}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Google Places API error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();

  if (json.error_message) {
    // Surface helpful error for debugging (e.g., invalid key, quota)
    throw new Error(`Google Places API error: ${json.error_message}`);
  }

  const results = Array.isArray(json.results) ? json.results : [];

  return results.slice(0, limit).map((r: any) => ({
    name: r.name,
    formatted_address: r.formatted_address ?? r.vicinity,
    place_id: r.place_id,
    types: r.types,
    rating: r.rating,
  }));
}

/**
 * Fetch Place Details for a single place_id and return a normalized object.
 * This uses the Place Details endpoint and maps a few useful fields.
 */
export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) {
    throw new Error("Missing Google Maps API key (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)");
  }

  const fields = [
    "place_id",
    "name",
    "formatted_address",
    "geometry",
    "formatted_phone_number",
    "website",
    "rating",
    "price_level",
    "opening_hours",
    "photos",
    "types",
    "business_status",
  ].join(",");

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
    placeId
  )}&fields=${encodeURIComponent(fields)}&key=${key}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Google Place Details error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();

  if (json.error_message) {
    throw new Error(`Google Place Details error: ${json.error_message}`);
  }

  const result = json.result ?? {};

  const photos: string[] = Array.isArray(result.photos)
    ? result.photos.map((p: any) => {
        const ref = p.photo_reference;
        // Build a stable photo URL using the Google Place Photo endpoint
        return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${encodeURIComponent(
          ref
        )}&key=${key}`;
      })
    : [];

  const latitude = result.geometry?.location?.lat;
  const longitude = result.geometry?.location?.lng;

  return {
    place_id: result.place_id,
    name: result.name,
    formatted_address: result.formatted_address ?? null,
    address: result.formatted_address ?? null,
    latitude: typeof latitude === "number" ? latitude : latitude ? Number(latitude) : undefined,
    longitude: typeof longitude === "number" ? longitude : longitude ? Number(longitude) : undefined,
    phone: result.formatted_phone_number ?? null,
    website: result.website ?? null,
    rating: result.rating ?? null,
    price_level: typeof result.price_level === "number" ? result.price_level : null,
    opening_hours: result.opening_hours ?? null,
    photos: photos,
    types: Array.isArray(result.types) ? result.types : [],
    business_status: result.business_status ?? null,
  };
}