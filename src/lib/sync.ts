/**
 * Sync helper: fetch rich Google Place data and insert into Supabase.
 *
 * Workflow:
 * 1. Use nearbySearchWithPagination to find a set of places with all necessary fields.
 * 2. Map fields to the recommended schema (google_place_id, name, address,
 *    formatted_address, latitude, longitude, phone, website, google_rating,
 *    price_level, opening_hours, photos, types, status, is_chain_excluded,
 *    date_added, last_updated, created_at, updated_at).
 * 3. Detect available table columns and only insert compatible keys.
 *
 * Returns: { ok: boolean, inserted?: number, updated?: number, error?: string }
 */

import { nearbySearchWithPagination } from "@/src/lib/density";
import { supabase } from "@/src/lib/supabase";
import { getPhotoUrl } from "@/src/lib/google-places";
import { applyCoffeeShopFilters } from "@/src/lib/coffee-filtering";

function nowIso() {
  return new Date().toISOString();
}

function mapBusinessStatusToDbStatus(b?: string | null) {
  // Google business_status values: "OPERATIONAL", "CLOSED_TEMPORARILY", "CLOSED_PERMANENTLY"
  // DB allowed values: 'active', 'closed', 'temporarily_closed'
  if (!b) return "active";
  const normalized = String(b).toUpperCase();
  if (normalized === "OPERATIONAL") return "active";
  if (normalized === "CLOSED_TEMPORARILY") return "temporarily_closed";
  if (normalized === "CLOSED_PERMANENTLY") return "closed";
  return "active";
}

function mapPriceLevel(priceLevel?: number): number | null {
  if (typeof priceLevel !== "number") return null;
  // Google Maps API price levels are 0-4
  if (priceLevel >= 0 && priceLevel <= 4) return priceLevel;
  return null;
}

/**
 * syncHoustonCoffeeShops
 * - Builds payloads from Google Places using the adaptive search system
 * - Detects which google_place_id values already exist in the DB
 * - For existing rows => perform an update (do not overwrite created_at/date_added)
 * - For new rows => insert full payload including created_at/date_added
 *
 * Returns { ok: boolean, inserted?: number, updated?: number, error?: string }
 */
export async function syncHoustonCoffeeShops(limit = 8) {
  try {
    // Detect available columns by selecting one row (if any).
    const detectRes = await supabase.from("coffee_shops").select().limit(1);
    if (detectRes.error) {
      const msg =
        (detectRes.error && (detectRes.error as { message?: string }).message) ??
        JSON.stringify(detectRes.error);
      return { ok: false, error: String(msg) };
    }

    const sampleRow =
      Array.isArray(detectRes.data) && detectRes.data.length > 0 ? detectRes.data[0] : null;
    const availableCols = sampleRow ? Object.keys(sampleRow) : [];

    // If table empty or unknown, assume common target columns (optimistic)
    if (availableCols.length === 0) {
      availableCols.push(
        "id",
        "google_place_id",
        "name",
        "address",
        "formatted_address",
        "latitude",
        "longitude",
        "phone",
        "website",
        "google_rating",
        "google_user_ratings_total",
        "price_level",
        "opening_hours",
        "photos",
        // Photo-related columns (optimistic: include when table is empty)
        "google_photo_reference",
        "main_photo_url",
        "photo_attribution",
        "types",
        "status",
        "is_chain_excluded",
        "date_added",
        "last_updated",
        "created_at",
        "updated_at",
        "sync_metadata"
      );
    }

    // Step 1: Use nearby search with pagination to get rich place data
    // We'll search in the center of Houston with a reasonable radius
    const searchResult = await nearbySearchWithPagination({
      lat: 29.7604, // Downtown Houston
      lng: -95.3698,
      radius: 5000, // 5km radius
      maxPages: limit
    });
    
    // Apply coffee shop filtering
    const filteredPlaces = applyCoffeeShopFilters(searchResult.places);
    const places = filteredPlaces.filtered;
    
    if (!places || places.length === 0) {
      return { ok: true, inserted: 0, updated: 0 };
    }

    // Collect google_place_ids to detect existing rows
    const placeIds = places.map((p) => p.id || p.place_id || p.placeId).filter(Boolean) as string[];

    // Query existing rows to know which ids already exist
    let existingIds = new Set<string>();
    if (placeIds.length > 0) {
      const existingRes = await supabase
        .from("coffee_shops")
        .select("google_place_id")
        .in("google_place_id", placeIds);
      if (!existingRes.error && Array.isArray(existingRes.data)) {
        for (const row of existingRes.data) {
          const id = (row as any).google_place_id;
          if (id) existingIds.add(String(id));
        }
      }
      // If the select errors, we'll treat as if no rows exist and let upsert handle uniqueness.
    }

    // Build two payload types:
    // - inserts: include created_at/date_added (if available in table) so newly-created rows get timestamps
    // - updates: exclude created_at/date_added and exclude null values so we don't clobber good data
    const inserts: Record<string, unknown>[] = [];
    const updates: Record<string, unknown>[] = [];

    for (const p of places) {
      // Determine main photo (first available) and preserve attribution information.
      const photosArray = Array.isArray(p.photos) ? p.photos : [];
      const mainPhoto = photosArray.length > 0 ? photosArray[0] : null;
  
      const photos = photosArray.length > 0
        ? photosArray.map((photo: any) => {
            // Handle both legacy and v1 photo shapes
            const photoName = photo.name || photo.photo_reference;
            return photoName ? getPhotoUrl(photoName) : null;
          }).filter(Boolean)
        : null;
  
      // Store the Places API photo "name" (e.g. "places/{place_id}/photos/{photo_reference}")
      // so we can reconstruct media URLs later with getPhotoUrl(photoName).
      const google_photo_reference = mainPhoto ? (mainPhoto.name || mainPhoto.photo_reference) : null;
      const main_photo_url = google_photo_reference ? getPhotoUrl(google_photo_reference) : null;
      // Preserve authorAttributions as a JSON string so the UI can render required attribution.
      const photo_attribution =
        mainPhoto && Array.isArray(mainPhoto.authorAttributions) && mainPhoto.authorAttributions.length > 0
          ? JSON.stringify(mainPhoto.authorAttributions)
          : null;
  
      // Extract name, handling both legacy and v1 shapes
      const name = p.displayName?.text || p.name || null;
      
      // Extract location, handling multiple shapes
      let latitude: number | null = null;
      let longitude: number | null = null;
      if (p.location) {
        // Check if it's the v1 shape with latitude/longitude
        if ('latitude' in p.location && typeof p.location.latitude === "number" && 
            'longitude' in p.location && typeof p.location.longitude === "number") {
          latitude = p.location.latitude;
          longitude = p.location.longitude;
        } 
        // Check if it's the legacy shape with lat/lng
        else if ('lat' in p.location && typeof (p.location as { lat?: number }).lat === "number" && 
                 'lng' in p.location && typeof (p.location as { lng?: number }).lng === "number") {
          latitude = (p.location as { lat?: number }).lat ?? null;
          longitude = (p.location as { lng?: number }).lng ?? null;
        }
      }
      if ((!latitude && !longitude) && p.geometry?.location) {
        latitude = p.geometry.location.lat ?? null;
        longitude = p.geometry.location.lng ?? null;
      }
      
      // Extract address
      const formatted_address = p.formattedAddress || null;
      const address = p.vicinity || p.address || formatted_address;
      
      // Extract contact info
      const phone = p.formatted_phone_number || p.nationalPhoneNumber || null;
      const website = p.websiteUri || null;
      
      // Extract ratings and pricing
      const google_rating = typeof p.rating === "number" ? p.rating : null;
      const google_user_ratings_total = typeof p.userRatingCount === "number" ? p.userRatingCount : null;
      const price_level = mapPriceLevel(typeof p.priceLevel === "number" ? p.priceLevel : undefined);
      
      // Extract business status
      const businessStatus = p.businessStatus || "OPERATIONAL";
      
      // Extract types
      const types = Array.isArray(p.types) ? p.types : null;
      
      const full = {
        google_place_id: p.id || p.place_id || p.placeId || null,
        name: name,
        address: address,
        formatted_address: formatted_address,
        latitude: latitude,
        longitude: longitude,
        phone: phone,
        website: website,
        google_rating: google_rating,
        google_user_ratings_total: google_user_ratings_total,
        price_level: price_level,
        opening_hours: p.regularOpeningHours || p.currentOpeningHours || null,
        photos: photos,
        // New photo-related fields
        google_photo_reference: google_photo_reference,
        main_photo_url: main_photo_url,
        photo_attribution: photo_attribution,
        types: types,
        status: mapBusinessStatusToDbStatus(businessStatus),
        is_chain_excluded: false,
        date_added: nowIso(),
        last_updated: nowIso(),
        created_at: nowIso(),
        updated_at: nowIso(),
      } as Record<string, unknown>;

      // Build insert payload: include available columns and include creation timestamps
      const insertPayload: Record<string, unknown> = {};
      for (const k of Object.keys(full)) {
        if (!availableCols.includes(k)) continue;
        // For insert we include the value even if null so DB columns are explicitly set
        insertPayload[k] = full[k];
      }

      // Build update payload: exclude creation timestamps and skip nulls to avoid clobbering existing DB data
      const updatePayload: Record<string, unknown> = {};
      for (const k of Object.keys(full)) {
        if (!availableCols.includes(k)) continue;
        if (k === "created_at" || k === "date_added") continue; // preserve originals
        const val = full[k];
        if (val === null || typeof val === "undefined") continue; // do not overwrite with null
        updatePayload[k] = val;
      }

      // Ensure there's an identifier for updates/inserts
      if (insertPayload.google_place_id || updatePayload.google_place_id) {
        if (existingIds.has(String(full.google_place_id))) {
          // Ensure updatePayload contains google_place_id so upsert can match on it
          updatePayload.google_place_id = full.google_place_id;
          updates.push(updatePayload);
        } else {
          // For inserts, ensure google_place_id exists
          insertPayload.google_place_id = full.google_place_id;
          inserts.push(insertPayload);
        }
      }
    }

    const insertedCount = inserts.length;
    const updatedCount = updates.length;

    // Combine payloads for a single upsert (updates will update columns, inserts will be created)
    const combined = [...inserts, ...updates];

    if (combined.length === 0) {
      return { ok: true, inserted: 0, updated: 0 };
    }

    // Upsert rows, using google_place_id as the conflict target.
    // Because we omitted created_at/date_added from update payloads, those fields will be preserved on updates.
    const { error } = await supabase.from("coffee_shops").upsert(combined, { onConflict: "google_place_id" });

    if (error) {
      const e = error as unknown as { message?: string };
      const message = e && e.message ? e.message : JSON.stringify(error);
      return { ok: false, error: String(message) };
    }

    return { ok: true, inserted: insertedCount, updated: updatedCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    return { ok: false, error: String(message) };
  }
}
