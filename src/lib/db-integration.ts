/**
 * db-integration.ts
 *
 * Server-side style helpers to integrate discovered places into the existing
 * Supabase schema (public.coffee_shops) and record sync runs.
 *
 * Assumptions & notes:
 * - The project defines a Supabase client at `full-cup/src/lib/supabase.ts` which
 *   exports `supabase`. That client appears to be the public (NEXT_PUBLIC) client.
 *   We reuse that client here. If you have a server-only service key you'd prefer,
 *   replace the imported client with a server-key-backed client.
 *
 * - The primary shops table is `public.coffee_shops` (see migrations).
 *   The unique key is `google_place_id` (text UNIQUE NOT NULL). We use that as the
 *   dedupe/upsert onConflict column.
 *
 * - The migration does not include a dedicated `metadata` or `last_verified`
 *   column. We map `last_verified` -> `last_updated` (best-effort), and for
 *   metadata we perform a best-effort merge into `opening_hours` jsonb:
 *     - If the place provides `opening_hours` we preserve it and attach a `_sync`
 *       key containing sync metadata (sourceGridId, gridRadius, searchLevel, raw).
 *     - If no opening_hours provided we store metadata under `opening_hours` as:
 *         { "_sync": { ... } }
 *   This is intentionally conservative and documented so future schema changes
 *   can add a dedicated JSONB metadata column if desired.
 *
 * - Functions are resilient: they catch errors and return structured result
 *   objects rather than throwing for normal error paths.
 *
 * - All row payloads include google_place_id (never null); when a place lacks a
 *   `place_id` we synthesize one deterministically from name+lat+lng prefixed by
 *   "local:" so it's stable across runs.
 *
 * - These helpers perform batched upserts. To approximate inserted vs updated
 *   counts we query existing rows for the batch's google_place_id values before
 *   upserting.
 */

import { supabase } from "./supabase";
import { getPhotoUrl } from "./google-places";

/**
 * Options for upsertShopsBatch
 */
type UpsertOptions = {
  batchSize?: number;
  upsertColumns?: string[];
};

/**
 * Input shape for upsert items
 */
type UpsertItem = {
  place: any;
  sourceGridId?: string;
  gridRadius?: number;
  searchLevel?: number;
};

/**
 * Chunk an array into sized pieces
 */
function chunkArray<T>(arr: T[], size = 50): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/**
 * Create a stable synthetic id when place.place_id is missing.
 * Supports v1 Places shapes (displayName/location) as a fallback.
 */
function synthesizePlaceId(place: any) {
  const name =
    (typeof place?.name === "string" ? place.name : place?.displayName?.text) ??
    "unknown";
  const lat =
    place?.geometry?.location?.lat ??
    place?.lat ??
    place?.location?.latitude ??
    place?.location?.lat ??
    "0";
  const lng =
    place?.geometry?.location?.lng ??
    place?.lng ??
    place?.location?.longitude ??
    place?.location?.lng ??
    "0";
  return `local:${String(name).replace(/\s+/g, "_")}:${lat}:${lng}`;
}

/**
 * upsertShopsBatch
 *
 * - items: array of { place, sourceGridId?, gridRadius?, searchLevel? }
 * - options.batchSize default 50
 * - options.upsertColumns: optional array of columns to update on conflict; defaults to common columns
 *
 * Returns: { inserted: number; updated: number; errors: any[] }
 */
export async function upsertShopsBatch(
  items: UpsertItem[],
  options: UpsertOptions = {}
): Promise<{ inserted: number; updated: number; errors: any[] }> {
  const batchSize = options.batchSize ?? 50;
  const upsertColumns =
    options.upsertColumns ??
    [
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
      "last_updated",
      "updated_at",
    ];

  const batches = chunkArray(items, batchSize);
  let totalInserted = 0;
  let totalUpdated = 0;
  const errors: any[] = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    try {
      // Build payload rows and gather google_place_id list
      const rows = batch.map((it) => {
        const place = it.place ?? {};

        // Prefer v1/new Places identifiers when present.
        // Guard against receiving a resource name in `place.name` like "places/{place_id}".
        // If we do see that form, extract the trailing id. Otherwise prefer explicit ids.
        let placeId =
          place.place_id ??
          place.placeId ??
          place.id ??
          null;
        if (!placeId && typeof place?.name === "string" && place.name.startsWith("places/")) {
          // Resource-style name: "places/{place_id}" -> extract the id portion
          const parts = place.name.split("/");
          placeId = parts[parts.length - 1] ?? null;
        }
        // Fallback to name-based synthetic id only when no place identifier is available
        placeId = placeId ?? (typeof place?.name === "string" ? place.name : null) ?? synthesizePlaceId(place);

        // Location extraction: support legacy and v1/new Places shapes
        const lat =
          place?.geometry?.location?.lat ??
          place?.lat ??
          place?.location?.latitude ??
          place?.location?.lat ??
          null;

        const lng =
          place?.geometry?.location?.lng ??
          place?.lng ??
          place?.location?.longitude ??
          place?.location?.lng ??
          null;

        // Name/address mapping with v1 fields.
        // Prefer displayName.text when available (v1/new Places). If the legacy `place.name`
        // contains a resource identifier like "places/...", treat it as not a human-readable name.
        const name: string | null =
          typeof place?.displayName?.text === "string"
            ? place.displayName.text
            : typeof place?.name === "string" && !place.name.startsWith("places/")
            ? place.name
            : null;

        const formatted_address: string | null =
          place?.formatted_address ?? place?.formattedAddress ?? null;

        const address: string | null =
          place?.vicinity ?? place?.address ?? formatted_address;

        // Contact/web (often unavailable in nearby search)
        const phone: string | null =
          place?.formatted_phone_number ?? place?.nationalPhoneNumber ?? place?.phone ?? null;

        const website: string | null = place?.website ?? place?.websiteUri ?? null;

        // Price/rating/types
        const google_rating =
          typeof place?.rating === "number" ? place.rating : null;

        const price_level =
          place?.price_level ??
          (typeof place?.priceLevel === "number" ? place.priceLevel : null) ??
          null;

        const types = Array.isArray(place?.types) ? place.types : null;

        // Photos fallback: handle legacy or v1 shapes if available
        const photos = Array.isArray(place?.photos)
          ? place.photos.map((p: any) => p?.photo_reference ?? p?.name ?? p)
          : null;
  
        // Derive main photo reference and attribution where possible (supports both legacy and v1 shapes)
        const mainPhoto =
          Array.isArray(place?.photos) && place.photos.length > 0 ? place.photos[0] : null;
        const google_photo_reference = mainPhoto?.name ?? mainPhoto?.photo_reference ?? null;
        const main_photo_url = google_photo_reference ? getPhotoUrl(google_photo_reference) : null;
        const photo_attribution =
          mainPhoto && Array.isArray(mainPhoto.authorAttributions) && mainPhoto.authorAttributions.length > 0
            ? JSON.stringify(mainPhoto.authorAttributions)
            : null;
  
        // Best-effort opening_hours metadata attachment
        const syncMeta = {
          sourceGridId: it.sourceGridId,
          gridRadius: it.gridRadius,
          searchLevel: it.searchLevel,
          // Instead of embedding the full place payload (which can be large and noisy)
          // store a minimal raw reference that is useful for debugging/traceability.
          raw: {
            id: place?.id ?? place?.place_id ?? place?.placeId ?? null,
            name:
              typeof place?.displayName?.text === "string"
                ? place.displayName.text
                : typeof place?.name === "string" && !String(place.name).startsWith("places/")
                ? place.name
                : null,
            // keep coordinates if available for quick lookup
            latitude:
              place?.geometry?.location?.lat ??
              place?.lat ??
              place?.location?.latitude ??
              null,
            longitude:
              place?.geometry?.location?.lng ??
              place?.lng ??
              place?.location?.longitude ??
              null,
          },
        };
  
        // Prefer canonical opening hour shapes returned by the Places v1 API.
        // Fall back to legacy `opening_hours` if present.
        let opening_hours: any =
          place?.regularOpeningHours ?? place?.currentOpeningHours ?? place?.opening_hours ?? null;
  
        if (opening_hours && typeof opening_hours === "object") {
          // Attach _sync metadata without embedding the full place object
          opening_hours = { ...opening_hours, _sync: syncMeta };
        } else {
          // Store minimal sync metadata under opening_hours as a best-effort JSONB holder
          opening_hours = { _sync: syncMeta };
        }
  
        // Debug: log photo values computed for this place so we can diagnose why
        // photo columns may be empty after a test sync.
        try {
          console.info("[upsertShopsBatch] place debug:", {
            placeId,
            photos: Array.isArray(place?.photos) ? place.photos : place?.photos ?? null,
            google_photo_reference,
            main_photo_url,
            photo_attribution,
          });
        } catch (e) {
          // swallow logging errors to avoid failing the upsert flow
          // eslint-disable-next-line no-console
          console.info("[upsertShopsBatch] debug log failed:", e);
        }
  
        return {
          google_place_id: placeId,
          name,
          address,
          formatted_address,
          latitude: lat,
          longitude: lng,
          phone,
          website,
          google_rating,
          price_level,
          opening_hours,
          photos,
          // Photo-related columns
          google_photo_reference,
          main_photo_url,
          photo_attribution,
          types,
          status: "active",
          last_updated: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      });

      // Determine which google_place_id values already exist to approximate inserted vs updated
      const placeIds = rows.map((r) => r.google_place_id).filter(Boolean);

      let existingIds: string[] = [];
      if (placeIds.length > 0) {
        const { data: existingRows, error: selectErr } = await supabase
          .from("coffee_shops")
          .select("google_place_id")
          .in("google_place_id", placeIds);

        if (selectErr) {
          // If select fails, log and proceed to upsert anyway — mark as unknown on counts
          console.info(
            `DB: warning selecting existing ids for batch ${i + 1}:`,
            (selectErr as any).message ?? selectErr
          );
        } else if (existingRows && Array.isArray(existingRows)) {
          existingIds = (existingRows as any[]).map((r: any) => r.google_place_id);
        }
      }

      const approxExistingCount = existingIds.length;
      const approxInserted = Math.max(rows.length - approxExistingCount, 0);
      const approxUpdated = approxExistingCount;

      // Perform upsert using google_place_id onConflict
      const { error } = await supabase
        .from("coffee_shops")
        .upsert(rows, { onConflict: "google_place_id" }); // returning minimal to reduce payload

      if (error) {
        // Upsert-level error; capture and continue
        errors.push({ batch: i, error });
        console.info(
          `DB: upsert batch ${i + 1}/${batches.length} — ${rows.length} items — error: ${
            (error as any).message ?? error
          }`
        );
        // We cannot reliably compute inserted/updated counts for this batch when upsert fails; skip counts
        continue;
      }

      // When upsert succeeds, use our approximation for counts
      totalInserted += approxInserted;
      totalUpdated += approxUpdated;

      console.info(
        `DB: upsert batch ${i + 1}/${batches.length} — ${rows.length} items — approx inserted: ${approxInserted}, approx updated: ${approxUpdated}`
      );
    } catch (err) {
      errors.push({ batch: i, error: err });
      console.info(`DB: unexpected error upserting batch ${i + 1}:`, err);
    }
  }

  return {
    inserted: totalInserted,
    updated: totalUpdated,
    errors,
  };
}

/**
 * markShopsNotSeenSince
 *
 * - Marks shops that have not been updated/verified since `syncTimestampISO`.
 * - Preference: if the table has `last_updated` or `updated_at`, compare that.
 * - This implementation updates `status` -> 'temporarily_closed' for rows where
 *   COALESCE(last_updated, updated_at, date_added) < syncTimestampISO.
 *
 * - Returns number of rows updated (best-effort).
 */
export async function markShopsNotSeenSince(syncTimestampISO: string): Promise<number> {
  try {
    // Use SQL to update rows in a single query and return count
    // Supabase client used here; fallback approach implemented due to RPC/SQL limitations in this template.
    const { data: oldRows, error: selectErr } = await supabase
      .from("coffee_shops")
      .select("id")
      .lt("last_updated", syncTimestampISO)
      .or(`updated_at.lt.${syncTimestampISO},date_added.lt.${syncTimestampISO}`);

    if (selectErr) {
      console.info("DB: markShopsNotSeenSince - select error:", selectErr);
      return 0;
    }

    const ids = (oldRows || []).map((r: any) => r.id);
    if (ids.length === 0) {
      return 0;
    }

    const { error: updateErr } = await supabase
      .from("coffee_shops")
      .update({
        status: "temporarily_closed",
        updated_at: new Date().toISOString(),
        last_updated: new Date().toISOString(),
      })
      .in("id", ids);

    if (updateErr) {
      console.info("DB: markShopsNotSeenSince - update error:", updateErr);
      return 0;
    }

    return ids.length;
  } catch (err) {
    console.info("DB: markShopsNotSeenSince - unexpected error:", err);
    return 0;
  }
}

/**
 * recordSyncRun
 *
 * - Attempts to insert a row into `public.sync_history` if present.
 * - If absent, returns the metadata object unchanged.
 *
 * metadata: { mode: 'test'|'production'; areasSearched:number; placesFound:number; apiCalls:number; startAt?:string; endAt?:string }
 *
 * Returns inserted row if successful, otherwise returns the structured metadata object.
 */
export async function recordSyncRun(metadata: {
  mode: "test" | "production";
  areasSearched: number;
  placesFound: number;
  apiCalls: number;
  startAt?: string;
  endAt?: string;
}): Promise<any> {
  try {
    // Check if sync_history exists by attempting a lightweight select
    const { error: checkErr } = await supabase.from("sync_history").select("id").limit(1);

    if (checkErr) {
      // Table might not exist; return metadata object instead
      console.info(
        "DB: sync_history table not found or select failed; skipping insert:",
        (checkErr as any).message ?? checkErr
      );
      return { skipped: true, metadata };
    }

    const row = {
      started_at: metadata.startAt
        ? new Date(metadata.startAt).toISOString()
        : new Date().toISOString(),
      finished_at: metadata.endAt
        ? new Date(metadata.endAt).toISOString()
        : new Date().toISOString(),
      inserted_count: metadata.placesFound ?? null,
      status: "success",
      requested_email: null,
      requested_by: null,
      error: null,
    };

    const { data, error } = await supabase.from("sync_history").insert(row).select();

    if (error) {
      console.info("DB: recordSyncRun insert error:", error);
      return { inserted: false, error };
    }

    console.info(`DB: recorded sync run id=${data?.[0]?.id ?? "unknown"}`);
    return data?.[0] ?? { inserted: true, metadata };
  } catch (err) {
    console.info("DB: recordSyncRun unexpected error:", err);
    return { inserted: false, error: err };
  }
}