'use client';

import React, { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/src/lib/supabase";

export default function CoffeeShopCount() {
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchCount = useCallback(async () => {
    try {
      const res = await supabase.from("coffee_shops").select("id", { count: "exact" });
      if (!mountedRef.current) return;
      if (res.error) {
        setError(String(res.error));
        setCount(0);
      } else {
        setCount(res.count ?? 0);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setError(String(err));
      setCount(0);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // Initial load and periodic poll
    fetchCount();
    const interval = setInterval(fetchCount, 5000);

    // Refresh immediately after a sync completes (TestPlacesButton dispatches this)
    window.addEventListener("fullcup:sync", fetchCount);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      window.removeEventListener("fullcup:sync", fetchCount);
    };
  }, [fetchCount]);

  return (
    <div className="mt-4 text-sm">
      Coffee shops:{" "}
      <span className="font-medium">{count === null ? "Loading..." : count}</span>
      {error ? <div className="mt-2 text-xs text-red-500">Error: {error}</div> : null}
    </div>
  );
}