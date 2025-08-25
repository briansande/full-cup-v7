'use client';
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/src/lib/supabase";

type Shop = {
  id: string;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
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
          }));
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