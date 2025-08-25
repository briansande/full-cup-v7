/**
 * Sync helper: fetch full Google Place Details and insert into Supabase.
 *
 * Workflow:
 * 1. Use textSearchPlaces to find a small set of place IDs.
 * 2. For each place_id call getPlaceDetails to obtain rich metadata.
 * 3. Map fields to the recommended schema (google_place_id, name, address,
 *    formatted_address, latitude, longitude, phone, website, google_rating,
 *    price_level, opening_hours, photos, types, status, is_chain_excluded,
 *    date_added, last_updated, created_at, updated_at).
 * 4. Detect available table columns and only insert compatible keys.
 *
 * Returns: { ok: boolean, inserted?: number, error?: string }
 */

import { textSearchPlaces, getPlaceDetails } from "@/src/lib/google-places";
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

    // Step 1: text search to get some place_ids
    const searchResults = await textSearchPlaces("coffee shops in Houston, TX", limit);
    if (!searchResults || searchResults.length === 0) {
      return { ok: true, inserted: 0 };
    }

    // Step 2: fetch place details for each place_id (fall back to basic info if no id)
    const detailsPromises = searchResults.map(async (r) => {
      if (r.place_id) {
        try {
          const d = await getPlaceDetails(r.place_id);
          return d;
        } catch (err) {
          // If details fetch fails, fallback to the text search result
          return {
            place_id: r.place_id ?? null,
            name: r.name,
            formatted_address: r.formatted_address ?? null,
            address: r.formatted_address ?? null,
            latitude: undefined,
            longitude: undefined,
            phone: null,
            website: null,
            rating: r.rating ?? null,
            price_level: null,
            opening_hours: null,
            photos: [],
            types: r.types ?? [],
            business_status: null,
          };
        }
      } else {
        return {
          place_id: r.place_id ?? null,
          name: r.name,
          formatted_address: r.formatted_address ?? null,
          address: r.formatted_address ?? null,
          latitude: undefined,
          longitude: undefined,
          phone: null,
          website: null,
          rating: r.rating ?? null,
          price_level: null,
          opening_hours: null,
          photos: [],
          types: r.types ?? [],
          business_status: null,
        };
      }
    });

    const details = await Promise.all(detailsPromises);

    // Build rows mapping to the requested schema, then filter keys by availableCols
    const rows = details.map((p) => {
      // Normalize fields from PlaceDetails
      const priceLevelRaw = (p as any).price_level;
      const price_level =
        typeof priceLevelRaw === "number" && priceLevelRaw >= 1 && priceLevelRaw <= 4
          ? priceLevelRaw
          : null;

      const photos = Array.isArray((p as any).photos) ? (p as any).photos : [];

      const types = Array.isArray((p as any).types) ? (p as any).types : [];

      const dbStatus = mapBusinessStatusToDbStatus((p as any).business_status ?? null);

      const full = {
        // we don't provide `id` so the DB can default gen_random_uuid()
        google_place_id: p.place_id ?? null,
        name: p.name ?? null,
        address: (p as any).address ?? (p as any).formatted_address ?? null,
        formatted_address: (p as any).formatted_address ?? null,
        latitude:
          typeof (p as any).latitude === "number" ? (p as any).latitude : (p as any).latitude ?? null,
        longitude:
          typeof (p as any).longitude === "number" ? (p as any).longitude : (p as any).longitude ?? null,
        phone: (p as any).phone ?? null,
        website: (p as any).website ?? null,
        google_rating:
          typeof (p as any).rating === "number" ? (p as any).rating : (p as any).rating ?? null,
        price_level: price_level,
        opening_hours: (p as any).opening_hours ?? null,
        photos: photos.length > 0 ? photos : null,
        types: types.length > 0 ? types : null,
        status: dbStatus,
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
        if (availableCols.includes("name")) filtered.name = p.name ?? null;
        else if (availableCols.includes("google_place_id")) filtered.google_place_id = p.place_id ?? null;
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