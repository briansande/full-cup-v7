'use client';

import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type AchievementDef = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  points?: number;
};

type UserAchievement = {
  id: string;
  achievement_id: string;
  earned_at: string | null;
};

type ToastItem = {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  earned_at?: string | null;
};

const STORAGE_PREFIX = "fullcup.seen_achievements";

export default function AchievementNotifier() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [polling, setPolling] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    let intervalHandle: number | undefined;

    async function init() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData?.session?.user ?? null;
        if (!user) return;
        if (!mounted) return;
        setUserId(user.id);

        // Listen for global sync events dispatched by components after actions
        const onSync = () => {
          fetchNewAchievements(user.id).catch((e) => {
            // ignore
            // eslint-disable-next-line no-console
            console.warn("fetchNewAchievements error", e);
          });
        };

        window.addEventListener("fullcup:sync", onSync);

        // Also poll periodically (every 25s) as a fallback so users on other tabs get updates
        intervalHandle = window.setInterval(onSync, 25000);

        // Initial fetch
        await fetchNewAchievements(user.id);

        return () => {
          mounted = false;
          window.removeEventListener("fullcup:sync", onSync);
          if (intervalHandle) window.clearInterval(intervalHandle);
        };
      } catch {
        // ignore
      }
    }

    init();

    return () => {
      mounted = false;
      if (intervalHandle) window.clearInterval(intervalHandle);
    };
  }, []);

  // Fetch user achievements and show toasts for any not-seen
  async function fetchNewAchievements(uid: string) {
    if (polling) return;
    setPolling(true);
    try {
      // 1) fetch earned achievements for the user (recent)
      const uaRes = await supabase
        .from("user_achievements")
        .select("id,achievement_id,earned_at")
        .eq("user_id", uid)
        .order("earned_at", { ascending: true })
        .limit(50);

      if (uaRes.error) {
        // eslint-disable-next-line no-console
        console.warn("achievement fetch error", uaRes.error);
        return;
      }
      const uaRows = Array.isArray(uaRes.data) ? (uaRes.data as UserAchievement[]) : [];

      // 2) build set of seen ids from localStorage
      const storageKey = `${STORAGE_PREFIX}.${uid}`;
      const raw = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
      const seen: Record<string, boolean> = raw ? JSON.parse(raw) : {};

      // 3) filter unseen achievement ids
      const unseen = uaRows.filter((ua) => !seen[ua.achievement_id]);

      if (unseen.length === 0) return;

      // 4) fetch definitions for unseen achievement ids
      const ids = unseen.map((u) => u.achievement_id);
      const defsRes = await supabase.from("achievements").select("id,key,name,description,icon,points").in("id", ids);
      if (defsRes.error) {
        // eslint-disable-next-line no-console
        console.warn("achievement defs fetch error", defsRes.error);
        return;
      }
      const defs = Array.isArray(defsRes.data) ? (defsRes.data as AchievementDef[]) : [];
      const defById: Record<string, AchievementDef> = Object.fromEntries(defs.map((d) => [d.id, d]));

      // 5) prepare toasts and update seen set (we mark as seen locally so toasts don't repeat)
      const newToasts: ToastItem[] = unseen.map((u) => {
        const def = defById[u.achievement_id];
        return {
          id: u.id,
          name: def?.name ?? "Achievement",
          description: def?.description ?? null,
          icon: def?.icon ?? "🏅",
          earned_at: u.earned_at ?? null,
        };
      });

      // Add new toasts to UI
      setToasts((prev) => [...newToasts, ...prev]);

      // Mark them as seen in localStorage so we don't re-notify
      const updatedSeen = { ...seen };
      for (const u of unseen) updatedSeen[u.achievement_id] = true;
      localStorage.setItem(storageKey, JSON.stringify(updatedSeen));

      // Notify other UI (nav badge) that achievements updated
      try {
        window.dispatchEvent(new CustomEvent("fullcup:achievements_updated", { detail: { userId: uid } }));
      } catch {
        // ignore
      }
    } finally {
      setPolling(false);
    }
  }

  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  if (!userId) return null;

  return (
    <div style={{ position: "fixed", right: 12, bottom: 12, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8 }}>
      {toasts.map((t) => (
        <div key={t.id} style={{ minWidth: 260, maxWidth: 420, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, boxShadow: "0 6px 18px rgba(0,0,0,0.08)" }}>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ width: 44, height: 44, borderRadius: 8, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
              {t.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800 }}>{t.name}</div>
              {t.description ? <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>{t.description}</div> : null}
              <div style={{ marginTop: 8 }}>
                <a href="/profile" style={{ color: "#2563eb", fontSize: 13 }}>View Coffee Passport</a>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "flex-end" }}>
              <button onClick={() => dismissToast(t.id)} style={{ border: 0, background: "transparent", cursor: "pointer", fontSize: 14 }} aria-label="Dismiss">
                ✕
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}