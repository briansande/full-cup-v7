/**
 * Shop data fetching utilities
 */

import { supabase } from "@/src/lib/supabase";
import { Shop } from "@/src/types";

// Type definitions for database query results
interface BasicShopData {
  id: number | string;
  name: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  date_added: string | null;
  main_photo_url: string | null;
  photo_attribution: string | null;
}

interface UserShopStatus {
  shop_id: number | string;
  status: string;
}

interface ShopReviewData {
  shop_id: number | string;
  rating: number | string | null;
  coffee_quality_rating: number | string | null;
  atmosphere_rating: number | string | null;
  noise_level_rating: number | string | null;
  wifi_quality_rating: number | string | null;
  work_friendliness_rating: number | string | null;
  service_rating: number | string | null;
}

interface TagData {
  shop_id: number | string;
  votes: number | string;
  tag: {
    id: number | string;
    name: string;
  }[];
}

interface ProcessedTag {
  tag_id: string;
  tag_name: string;
  total_votes: number;
}

/**
 * Fetch basic shop information
 */
export async function fetchBasicShops(days?: number | null) {
  let query = supabase
    .from("coffee_shops")
    .select("id,name,latitude,longitude,date_added,main_photo_url,photo_attribution");
  if (typeof days === "number" && days > 0) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("date_added", cutoff);
  }
  const res = await query;

  if (res.error) {
    return [];
  }

  const data = Array.isArray(res.data) ? res.data : [];
  // Map basic shop info
  return data.map((d: BasicShopData) => ({
    id: String(d.id),
    name: d.name ?? null,
    latitude:
      typeof d.latitude === "number"
        ? d.latitude
        : d.latitude
        ? Number(d.latitude)
        : null,
    longitude:
      typeof d.longitude === "number"
        ? d.longitude
        : d.longitude
        ? Number(d.longitude)
        : null,
    status: null,
    avgRating: null,
    main_photo_url: d.main_photo_url ?? null,
    photo_attribution: d.photo_attribution ?? null,
  }));
}

/**
 * Fetch user shop statuses
 */
export async function fetchUserShopStatuses(shopIds: string[]) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user ?? null;
    if (!user) {
      return {};
    }
    
    const st = await supabase
      .from("user_shop_status")
      .select("shop_id,status")
      .eq("user_id", user.id);
      
    if (st.error || !Array.isArray(st.data)) {
      return {};
    }
    
    const statusMap: Record<string, string> = {};
    for (const row of st.data) {
      const rowData = row as unknown as UserShopStatus;
      const sid = String(rowData.shop_id);
      const s = rowData.status;
      if (sid) statusMap[sid] = s;
    }
    
    return statusMap;
  } catch {
    return {};
  }
}

/**
 * Aggregate type for review statistics
 */
type ReviewAggregates = {
  sumRating: number;
  countRating: number;
  sumCoffee: number;
  countCoffee: number;
  sumAtmos: number;
  countAtmos: number;
  sumNoise: number;
  countNoise: number;
  sumWifi: number;
  countWifi: number;
  sumWork: number;
  countWork: number;
  sumService: number;
  countService: number;
};

/**
 * Fetch and calculate review ratings for shops
 */
export async function fetchAndCalculateReviewRatings(shopIds: string[]) {
  try {
    const rev = await supabase
      .from("shop_reviews")
      .select("shop_id,rating,coffee_quality_rating,atmosphere_rating,noise_level_rating,wifi_quality_rating,work_friendliness_rating,service_rating");
      
    if (rev.error || !Array.isArray(rev.data)) {
      return {};
    }
    
    const aggMap: Record<string, ReviewAggregates> = {};
    for (const row of rev.data) {
      const rowData = row as unknown as ShopReviewData;
      const sid = String(rowData.shop_id);
      if (!aggMap[sid]) {
        aggMap[sid] = {
          sumRating: 0, countRating: 0,
          sumCoffee: 0, countCoffee: 0,
          sumAtmos: 0, countAtmos: 0,
          sumNoise: 0, countNoise: 0,
          sumWifi: 0, countWifi: 0,
          sumWork: 0, countWork: 0,
          sumService: 0, countService: 0,
        };
      }
      const a = aggMap[sid];

      const ratingVal = rowData.rating;
      const ratingNum = ratingVal == null ? NaN : Number(ratingVal);
      if (!Number.isNaN(ratingNum)) {
        a.sumRating += ratingNum;
        a.countRating += 1;
      }

      const c = rowData.coffee_quality_rating;
      if (c != null) { a.sumCoffee += Number(c); a.countCoffee += 1; }

      const at = rowData.atmosphere_rating;
      if (at != null) { a.sumAtmos += Number(at); a.countAtmos += 1; }

      const no = rowData.noise_level_rating;
      if (no != null) { a.sumNoise += Number(no); a.countNoise += 1; }

      const wi = rowData.wifi_quality_rating;
      if (wi != null) { a.sumWifi += Number(wi); a.countWifi += 1; }

      const wk = rowData.work_friendliness_rating;
      if (wk != null) { a.sumWork += Number(wk); a.countWork += 1; }

      const sv = rowData.service_rating;
      if (sv != null) { a.sumService += Number(sv); a.countService += 1; }
    }
    
    // Convert aggregates to shop ratings
    const ratingsMap: Record<string, Partial<Shop>> = {};
    for (const [shopId, a] of Object.entries(aggMap)) {
      ratingsMap[shopId] = {
        avgRating: a.countRating > 0 ? a.sumRating / a.countRating : null,
        avgCoffeeQuality: a.countCoffee > 0 ? a.sumCoffee / a.countCoffee : null,
        avgAtmosphere: a.countAtmos > 0 ? a.sumAtmos / a.countAtmos : null,
        avgNoiseLevel: a.countNoise > 0 ? a.sumNoise / a.countNoise : null,
        avgWifiQuality: a.countWifi > 0 ? a.sumWifi / a.countWifi : null,
        avgWorkFriendliness: a.countWork > 0 ? a.sumWork / a.countWork : null,
        avgService: a.countService > 0 ? a.sumService / a.countService : null,
      };
    }
    
    return ratingsMap;
  } catch {
    return {};
  }
}

/**
 * Fetch top tags for shops
 */
export async function fetchShopTags(shopIds: string[]) {
  try {
    if (shopIds.length === 0) {
      return {};
    }
    
    const tagRes = await supabase
      .from('shop_tags')
      .select('shop_id,votes,tag:tags(id,name)')
      .in('shop_id', shopIds)
      .order('votes', { ascending: false });
      
    if (tagRes.error || !Array.isArray(tagRes.data)) {
      return {};
    }
    
    const tagMap: Record<string, ProcessedTag[]> = {};
    for (const row of tagRes.data) {
      const rowData = row as { shop_id: number | string; votes: number | string; tag: { id: number | string; name: string }[] };
      const sid = String(rowData.shop_id);
      // Get the first tag from the array if it exists
      const tagObj = rowData.tag && rowData.tag.length > 0 ? rowData.tag[0] : null;
      if (!tagObj) continue;
      if (!tagMap[sid]) tagMap[sid] = [];
      tagMap[sid].push({
        tag_id: String(tagObj.id),
        tag_name: tagObj.name,
        total_votes: Number(rowData.votes ?? 0),
      });
    }
    
    // Convert to shop tags format
    const tagsMap: Record<string, { topTags: ProcessedTag[]; tagIds: string[] }> = {};
    for (const shopId of shopIds) {
      const allTags = (tagMap[shopId] || []);
      tagsMap[shopId] = {
        topTags: allTags.slice(0, 3),
        tagIds: allTags.map((t) => t.tag_id),
      };
    }
    
    return tagsMap;
  } catch {
    // Return empty tags for all shops
    const tagsMap: Record<string, { topTags: ProcessedTag[]; tagIds: string[] }> = {};
    for (const shopId of shopIds) {
      tagsMap[shopId] = { topTags: [], tagIds: [] };
    }
    return tagsMap;
  }
}