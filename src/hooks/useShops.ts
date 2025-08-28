'use client';
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { Shop, TopTag } from "@/src/types";

export default function useShops(days?: number | null) {
  const [shops, setShops] = useState<Shop[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    async function fetchShops() {
      setLoading(true);
      setError(null);
      try {
        let query = supabase
          .from("coffee_shops")
          .select("id,name,latitude,longitude,date_added,main_photo_url,photo_attribution");
        if (typeof days === "number" && days > 0) {
          const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
          query = query.gte("date_added", cutoff);
        }
        const res = await query;
  
        if (!mountedRef.current) return;

        if (res.error) {
          setError(String(res.error));
          setShops([]);
        } else {
          const data = Array.isArray(res.data) ? res.data : [];
          // Map basic shop info
          const mapped: Shop[] = data.map((d: any) => ({
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

          // Attempt to fetch user's statuses and merge
          try {
            const { data: sessionData } = await supabase.auth.getSession();
            const user = sessionData?.session?.user ?? null;
            if (user) {
              const st = await supabase
                .from("user_shop_status")
                .select("shop_id,status")
                .eq("user_id", user.id);
              if (!mountedRef.current) return;
              if (!st.error && Array.isArray(st.data)) {
                const statusMap: Record<string, string> = {};
                for (const row of st.data) {
                  const sid = String((row as any).shop_id);
                  const s = (row as any).status;
                  if (sid) statusMap[sid] = s;
                }
                for (const shop of mapped) {
                  if (statusMap[shop.id]) shop.status = statusMap[shop.id];
                }
              }
            }
          } catch {
            // ignore status fetch failures; show shops without status
          }

          // Fetch review ratings for all shops and compute averages per shop (overall + per-criterion)
          try {
            const rev = await supabase
              .from("shop_reviews")
              .select("shop_id,rating,coffee_quality_rating,atmosphere_rating,noise_level_rating,wifi_quality_rating,work_friendliness_rating,service_rating");
            if (!mountedRef.current) return;
            if (!rev.error && Array.isArray(rev.data)) {
              type Agg = {
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
              const aggMap: Record<string, Agg> = {};
              for (const row of rev.data) {
                const sid = String((row as any).shop_id);
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

                const ratingVal = (row as any).rating;
                const ratingNum = ratingVal == null ? NaN : Number(ratingVal);
                if (!Number.isNaN(ratingNum)) {
                  a.sumRating += ratingNum;
                  a.countRating += 1;
                }

                const c = (row as any).coffee_quality_rating;
                if (c != null) { a.sumCoffee += Number(c); a.countCoffee += 1; }

                const at = (row as any).atmosphere_rating;
                if (at != null) { a.sumAtmos += Number(at); a.countAtmos += 1; }

                const no = (row as any).noise_level_rating;
                if (no != null) { a.sumNoise += Number(no); a.countNoise += 1; }

                const wi = (row as any).wifi_quality_rating;
                if (wi != null) { a.sumWifi += Number(wi); a.countWifi += 1; }

                const wk = (row as any).work_friendliness_rating;
                if (wk != null) { a.sumWork += Number(wk); a.countWork += 1; }

                const sv = (row as any).service_rating;
                if (sv != null) { a.sumService += Number(sv); a.countService += 1; }
              }

              for (const shop of mapped) {
                const a = aggMap[shop.id];
                shop.avgRating = a && a.countRating > 0 ? a.sumRating / a.countRating : null;
                shop.avgCoffeeQuality = a && a.countCoffee > 0 ? a.sumCoffee / a.countCoffee : null;
                shop.avgAtmosphere = a && a.countAtmos > 0 ? a.sumAtmos / a.countAtmos : null;
                shop.avgNoiseLevel = a && a.countNoise > 0 ? a.sumNoise / a.countNoise : null;
                shop.avgWifiQuality = a && a.countWifi > 0 ? a.sumWifi / a.countWifi : null;
                shop.avgWorkFriendliness = a && a.countWork > 0 ? a.sumWork / a.countWork : null;
                shop.avgService = a && a.countService > 0 ? a.sumService / a.countService : null;
              }
            }
          } catch {
            // ignore review fetch errors; show shops without averages
          }
  
          // Fetch top tags for the fetched shops in bulk to avoid N+1 queries
          try {
            const shopIds = mapped.map((s) => s.id).filter(Boolean);
            if (shopIds.length > 0) {
              const tagRes = await supabase
                .from('shop_tags')
                .select('shop_id,votes,tag:tags(id,name)')
                .in('shop_id', shopIds)
                .order('votes', { ascending: false });
  
              if (!tagRes.error && Array.isArray(tagRes.data)) {
                const tagMap: Record<string, TopTag[]> = {};
                for (const row of tagRes.data as any[]) {
                  const sid = String(row.shop_id);
                  const tagObj = row.tag ?? row.tags ?? null;
                  if (!tagObj) continue;
                  if (!tagMap[sid]) tagMap[sid] = [];
                  tagMap[sid].push({
                    tag_id: String(tagObj.id),
                    tag_name: tagObj.name,
                    total_votes: Number(row.votes ?? 0),
                  });
                }
  
                // Attach top 2-3 tags to each shop and a full tag id list for filtering
                for (const shop of mapped) {
                  const allTags = (tagMap[shop.id] || []);
                  shop.topTags = allTags.slice(0, 3);
                  shop.tagIds = allTags.map((t) => t.tag_id);
                }
              } else {
                // ensure properties present even if no tags
                for (const shop of mapped) {
                  shop.topTags = [];
                  shop.tagIds = [];
                }
              }
            } else {
              for (const shop of mapped) {
                shop.topTags = [];
                shop.tagIds = [];
              }
            }
          } catch {
            // ignore tag fetch errors; still set shops without tags
            for (const shop of mapped) {
              shop.topTags = [];
              shop.tagIds = [];
            }
          }
  
          setShops(mapped);
        }
      } catch (err) {
        if (!mountedRef.current) return;
        setError(err instanceof Error ? err.message : String(err));
        setShops([]);
      } finally {
        if (!mountedRef.current) return;
        setLoading(false);
      }
    }

    fetchShops();
    window.addEventListener("fullcup:sync", fetchShops);
  
    return () => {
      mountedRef.current = false;
      window.removeEventListener("fullcup:sync", fetchShops);
    };
  }, [days]);
  
  return { shops, loading, error };
}