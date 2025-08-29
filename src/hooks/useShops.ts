'use client';
import { useEffect, useRef, useState } from "react";
import { Shop } from "@/src/types";
import { 
  fetchBasicShops, 
  fetchUserShopStatuses, 
  fetchAndCalculateReviewRatings, 
  fetchShopTags 
} from "@/src/lib/shopData";

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
        // Fetch basic shop information
        const mapped = await fetchBasicShops(days);
        if (!mountedRef.current) return;

        // Fetch user's statuses and merge
        const shopIds = mapped.map((s) => s.id).filter(Boolean);
        const statusMap = await fetchUserShopStatuses(shopIds);
        if (!mountedRef.current) return;
        
        for (const shop of mapped) {
          if (statusMap[shop.id]) shop.status = statusMap[shop.id];
        }

        // Fetch review ratings and compute averages
        const ratingsMap = await fetchAndCalculateReviewRatings(shopIds);
        if (!mountedRef.current) return;
        
        for (const shop of mapped) {
          const ratings = ratingsMap[shop.id];
          if (ratings) {
            Object.assign(shop, ratings);
          }
        }

        // Fetch top tags for the fetched shops
        const tagsMap = await fetchShopTags(shopIds);
        if (!mountedRef.current) return;
        
        for (const shop of mapped) {
          const tags = tagsMap[shop.id];
          if (tags) {
            shop.topTags = tags.topTags;
            shop.tagIds = tags.tagIds;
          } else {
            shop.topTags = [];
            shop.tagIds = [];
          }
        }

        setShops(mapped);
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