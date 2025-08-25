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
 * Returns: { ok: boolean, inserted?: number, error?: string }
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
      return { ok: true, inserted: 0 };
    }

    // Build rows mapping to the requested schema, then filter keys by availableCols
    const rows = places.map((p) => {
      const photos =
        Array.isArray(p.photos) && p.photos.length > 0
          ? p.photos.map((photo) => getPhotoUrl(photo.name))
          : null;

      const full = {
        // we don't provide `id` so the DB can default gen_random_uuid()
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

      const filtered: Record<string, unknown> = {};
      for (const k of Object.keys(full)) {
        if (availableCols.includes(k)) {
          filtered[k] = full[k];
        }
      }
      // Ensure at least `name` or `google_place_id` is present
      if (Object.keys(filtered).length === 0) {
        if (availableCols.includes("name")) filtered.name = p.displayName?.text ?? null;
        else if (availableCols.includes("google_place_id")) filtered.google_place_id = p.id ?? null;
      }
      return filtered;
    });

    // If nothing compatible to insert, fail early
    if (rows.every((r) => Object.keys(r).length === 0)) {
      return { ok: false, error: "No compatible columns available for insert into coffee_shops" };
    }

    // Insert rows
    const { error } = await supabase.from("coffee_shops").insert(rows);

    if (error) {
      const e = error as unknown as { message?: string };
      const message = e && e.message ? e.message : JSON.stringify(error);
      return { ok: false, error: String(message) };
    }

    return { ok: true, inserted: rows.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    return { ok: false, error: String(message) };
  }
}
