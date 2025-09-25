'use client';

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

const STORAGE_PREFIX = "fullcup.seen_achievements";

export default function AchievementNavBadge() {
  const [count, setCount] = useState<number>(0);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData?.session?.user ?? null;
        if (!user) {
          if (mounted) setUserId(null);
          return;
        }
        if (mounted) setUserId(user.id);

        // Fetch function
        const refresh = async () => {
          try {
            // Fetch user's earned achievement ids
            const uaRes = await supabase
              .from("user_achievements")
              .select("achievement_id", { count: "exact" })
              .eq("user_id", user.id)
              .limit(1000);
            if (uaRes.error) {
              console.warn("AchievementNavBadge ua fetch error", uaRes.error);
              return;
            }
            const uaRows = Array.isArray(uaRes.data) ? uaRes.data as { achievement_id: string }[] : [];
            const earnedIds = uaRows.map((r) => r.achievement_id);

            // Read seen map from localStorage
            const key = `${STORAGE_PREFIX}.${user.id}`;
            const raw = typeof window !== "undefined" ? localStorage.getItem(key) : null;
            const seen: Record<string, boolean> = raw ? JSON.parse(raw) : {};

            const unseenCount = earnedIds.filter((id) => !seen[id]).length;
            if (mounted) setCount(unseenCount);
          } catch (err) {
            console.warn("AchievementNavBadge refresh error", err);
          }
        };

        // Initial refresh
        await refresh();

        // Listen for global events that may indicate achievements changed
        const onUpdated = () => {
          refresh();
        };
        window.addEventListener("fullcup:achievements_updated", onUpdated);
        window.addEventListener("fullcup:sync", onUpdated);

        // Poll as fallback
        const handle = window.setInterval(() => refresh(), 30000);

        return () => {
          mounted = false;
          window.removeEventListener("fullcup:achievements_updated", onUpdated);
          window.removeEventListener("fullcup:sync", onUpdated);
          clearInterval(handle);
        };
      } catch {
        // ignore
      }
    }

    init();
    return () => {
      // nop
    };
  }, []);

  if (!userId) return null;

  return (
    <Link href="/profile" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#111827", textDecoration: "none" }}>
      <span style={{ padding: "6px 8px", borderRadius: 6, background: "#f3f4f6", fontWeight: 700 }}>Passport</span>
      {count > 0 ? (
        <span aria-live="polite" style={{ minWidth: 22, height: 22, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 999, background: "#ef4444", color: "#fff", fontSize: 12, fontWeight: 700 }}>
          {count}
        </span>
      ) : null}
    </Link>
  );
}