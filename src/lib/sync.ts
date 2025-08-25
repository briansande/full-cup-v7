/**
 * Sync helper: fetch rich Google Place data and insert into Supabase.
 *
 * Workflow:
 * 1. Use searchNearbyPlaces to find a set of places with all necessary fields.
 * 2. Map fields to the recommended schema (google_place_id, name, address,
 *    formatted_address, latitude, longitude, phone, website, google_rating,
 *    price_level, opening_hours, photos, types, status, is_chain_excluded,
 *    date_added, last_updated, created_at, updated_at).
 * 3. Detect available table columns and only insert compatible keys.
 *
 * Returns: { ok: boolean, inserted?: number, updated?: number, error?: string }
 */

import { searchNearbyPlaces, getPhotoUrl } from "@/src/lib/google-places";
import { supabase } from "@/src/lib/supabase";

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

function mapPriceLevel(priceLevel?: string): number | null {
  if (!priceLevel) return null;
  switch (priceLevel) {
    case "PRICE_LEVEL_FREE":
      return 0;
    case "PRICE_LEVEL_INEXPENSIVE":
      return 1;
    case "PRICE_LEVEL_MODERATE":
      return 2;
    case "PRICE_LEVEL_EXPENSIVE":
      return 3;
    case "PRICE_LEVEL_VERY_EXPENSIVE":
      return 4;
    default:
      return null;
  }
}

/**
 * syncHoustonCoffeeShops
 * - Builds payloads from Google Places
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
        "types",
        "status",
        "is_chain_excluded",
        "date_added",
        "last_updated",
        "created_at",
        "updated_at"
      );
    }

    // Step 1: Use new Text Search to get rich place data
    const places = await searchNearbyPlaces("coffee shops in Houston, TX", limit);
    if (!places || places.length === 0) {
      return { ok: true, inserted: 0, updated: 0 };
    }

    // Collect google_place_ids to detect existing rows
    const placeIds = places.map((p) => p.id).filter(Boolean) as string[];

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
      const photos =
        Array.isArray(p.photos) && p.photos.length > 0
          ? p.photos.map((photo) => getPhotoUrl(photo.name))
          : null;

      const full = {
        google_place_id: p.id ?? null,
        name: p.displayName?.text ?? null,
        address: p.formattedAddress ?? null,
        formatted_address: p.formattedAddress ?? null,
        latitude: p.location?.latitude ?? null,
        longitude: p.location?.longitude ?? null,
        phone: p.nationalPhoneNumber ?? null,
        website: p.websiteUri ?? null,
        google_rating: p.rating ?? null,
        google_user_ratings_total: p.userRatingCount ?? null,
        price_level: mapPriceLevel(p.priceLevel),
        opening_hours: p.regularOpeningHours ?? null,
        photos: photos,
        types: p.types && p.types.length > 0 ? p.types : null,
        status: mapBusinessStatusToDbStatus(p.businessStatus),
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
