'use client';
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/src/lib/supabase";

type Shop = {
  id: string;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  status?: string | null;
};

export default function useShops() {
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
        const res = await supabase
          .from("coffee_shops")
          .select("id,name,latitude,longitude");

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
  }, []);

  return { shops, loading, error };
}