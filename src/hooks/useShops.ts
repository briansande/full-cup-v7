'use client';
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/src/lib/supabase";

type Shop = {
  id: string;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  status?: string | null;
  avgRating?: number | null;
};

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
          .select("id,name,latitude,longitude,date_added");
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
          const mapped = data.map((d: any) => ({
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
          })) as Shop[];

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

          // Fetch review ratings for all shops and compute average per shop
          try {
            const rev = await supabase
              .from("shop_reviews")
              .select("shop_id,rating");
            if (!mountedRef.current) return;
            if (!rev.error && Array.isArray(rev.data)) {
              const sums: Record<string, { sum: number; count: number }> = {};
              for (const row of rev.data) {
                const sid = String((row as any).shop_id);
                const rating = Number((row as any).rating ?? 0);
                if (!sums[sid]) sums[sid] = { sum: 0, count: 0 };
                sums[sid].sum += rating;
                sums[sid].count += 1;
              }
              for (const shop of mapped) {
                if (sums[shop.id] && sums[shop.id].count > 0) {
                  shop.avgRating = sums[shop.id].sum / sums[shop.id].count;
                } else {
                  shop.avgRating = null;
                }
              }
            }
          } catch {
            // ignore review fetch errors; show shops without avgRating
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