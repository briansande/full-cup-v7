'use client';

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";

type Achievement = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  category?: string | null;
  requirements: Record<string, unknown>;
  points: number;
};

type UserAchievement = {
  id: string;
  achievement_id: string;
  earned_at: string | null;
  progress?: Record<string, unknown>;
};

type UserStats = {
  user_id: string;
  total_points?: number;
  level?: number;
  shops_visited?: number;
  reviews_written?: number;
  photos_uploaded?: number;
  votes_received?: number;
};

export default function CoffeePassport() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [userAchievements, setUserAchievements] = useState<Record<string, UserAchievement>>({});
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      setLoading(true);
      setError(null);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData?.session?.user ?? null;
        if (!user) {
          if (mounted) setUserId(null);
          return;
        }
        if (mounted) setUserId(user.id);

        // Fetch achievements definitions
        const achRes = await supabase.from("achievements").select("*").order("category", { ascending: true }).order("name", { ascending: true });
        if (achRes.error) throw achRes.error;
        const achs = Array.isArray(achRes.data) ? (achRes.data as Achievement[]) : [];
        if (!mounted) return;
        setAchievements(achs);

        // Fetch user's earned achievements
        const uaRes = await supabase
          .from("user_achievements")
          .select("id,achievement_id,earned_at,progress")
          .eq("user_id", user.id);
        if (uaRes.error) throw uaRes.error;
        const ualist = Array.isArray(uaRes.data) ? (uaRes.data as UserAchievement[]) : [];
        const uaMap: Record<string, UserAchievement> = {};
        for (const ua of ualist) uaMap[ua.achievement_id] = ua;
        if (!mounted) return;
        setUserAchievements(uaMap);

        // Mark earned achievements as "seen" when viewing the Coffee Passport so nav badge / new counts clear.
        try {
          const storageKey = `fullcup.seen_achievements.${user.id}`;
          const existingRaw = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
          const existing: Record<string, boolean> = existingRaw ? JSON.parse(existingRaw) : {};
          for (const aid of Object.keys(uaMap)) existing[aid] = true;
          if (typeof window !== "undefined") localStorage.setItem(storageKey, JSON.stringify(existing));

          // Notify other UI (nav badge) that achievements were acknowledged
          try {
            window.dispatchEvent(new CustomEvent("fullcup:achievements_updated", { detail: { userId: user.id } }));
          } catch {
            // ignore
          }
        } catch {
          // ignore localStorage errors in private mode
        }

        // Fetch cached user stats
        const statsRes = await supabase.from("user_stats").select("*").eq("user_id", user.id).single();
        if (!mounted) return;
        if (!statsRes.error && statsRes.data) {
          setUserStats(statsRes.data as UserStats);
        } else {
          setUserStats(null);
        }
      } catch (err: unknown) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();
    return () => {
      mounted = false;
    };
  }, []);

  // Helper: determine progress toward an achievement based on requirements
  function achievementProgress(a: Achievement) {
    const req = a.requirements ?? {};
    const kind = req.kind;
    if (!kind || !userStats) return null;

    if (kind === "shops_visited") {
      const have = userStats.shops_visited ?? 0;
      const need = Number(req.value ?? 0);
      return { have, need, label: `${Math.max(0, need - have)} more visits` };
    }
    if (kind === "reviews_written") {
      const have = userStats.reviews_written ?? 0;
      const need = Number(req.value ?? 0);
      return { have, need, label: `${Math.max(0, need - have)} more reviews` };
    }
    if (kind === "photos_uploaded") {
      const have = userStats.photos_uploaded ?? 0;
      const need = Number(req.value ?? 0);
      return { have, need, label: `${Math.max(0, need - have)} more photos` };
    }
    if (kind === "votes_received") {
      const have = userStats.votes_received ?? 0;
      const need = Number(req.value ?? 0);
      return { have, need, label: `${Math.max(0, need - have)} more votes` };
    }
    if (kind === "weekend_visits") {
      const need = Number(req.value ?? 0);
      // We don't cache weekend visits in user_stats; show an advisory message
      return { have: null, need, label: `Visit ${need} shops on weekends` };
    }
    if (kind === "review_time_early") {
      return { have: null, need: 1, label: "Write a review before 8:00 AM" };
    }
    if (kind === "review_time_night") {
      return { have: null, need: 1, label: "Write a review after 8:00 PM" };
    }
    return null;
  }

  const totalAchievements = achievements.length;
  const earnedCount = Object.keys(userAchievements).length;
  const totalPoints = userStats?.total_points ?? 0;

  const categories: Record<string, Achievement[]> = {
    Explorer: [],
    Critic: [],
    Social: [],
    Special: [],
    Other: [],
  };

  for (const a of achievements) {
    const cat = (a.category || "").toLowerCase();
    if (cat.includes("explorer")) categories.Explorer.push(a);
    else if (cat.includes("critic")) categories.Critic.push(a);
    else if (cat.includes("social")) categories.Social.push(a);
    else if (cat === "time" || cat === "weekend" || cat === "special") categories.Special.push(a);
    else categories.Other.push(a);
  }

  const recentEarned = Object.values(userAchievements)
    .filter((ua) => ua.earned_at)
    .sort((a, b) => (b.earned_at ?? "").localeCompare(a.earned_at ?? ""))
    .slice(0, 5)
    .map((ua) => {
      const def = achievements.find((x) => x.id === ua.achievement_id);
      return { def, ua };
    });

  if (loading) {
    return <section style={{ marginTop: 16, border: "1px solid #eee", padding: 12, borderRadius: 6 }}><div>Loading Coffee Passport…</div></section>;
  }

  return (
    <section style={{ marginTop: 16, border: "1px solid #eee", padding: 12, borderRadius: 6 }}>
      <h2 className="text-lg font-semibold">Coffee Passport</h2>

      {error ? <div style={{ color: "red", marginTop: 8 }}>{error}</div> : null}

      <div style={{ marginTop: 10, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ padding: 12, borderRadius: 8, background: "#fff", border: "1px solid #f0f0f0", minWidth: 160 }}>
          <div className="text-sm text-gray-600">Level</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{userStats?.level ?? 1}</div>
          <div style={{ fontSize: 13, color: "#666", marginTop: 6 }}>{totalPoints} points</div>
        </div>

        <div style={{ padding: 12, borderRadius: 8, background: "#fff", border: "1px solid #f0f0f0", flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div className="text-sm text-gray-600">Achievements</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{earnedCount} / {totalAchievements}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Recent</div>
              <div style={{ fontWeight: 700 }}>{recentEarned.length}</div>
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 13, color: "#666" }}>
              Total recognition points: <strong>{totalPoints}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Recent achievements */}
      <div style={{ marginTop: 14 }}>
        <h3 style={{ margin: "8px 0" }}>Recent Achievements</h3>
        {recentEarned.length === 0 ? (
          <div style={{ color: "#666" }}>No achievements earned yet. Keep exploring!</div>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {recentEarned.map(({ def, ua }) => {
              if (!def) return null;
              return (
                <div key={def.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: 8, background: "#fff", borderRadius: 8, border: "1px solid #eee" }}>
                  <div style={{ width: 48, height: 48, borderRadius: 8, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                    {def.icon ?? "🏅"}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700 }}>{def.name}</div>
                    <div style={{ fontSize: 12, color: "#666" }}>{ua.earned_at ? new Date(ua.earned_at).toLocaleDateString() : ""}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Achievement categories */}
      <div style={{ marginTop: 14 }}>
        {Object.entries(categories).map(([catName, list]) => {
          if (!list || list.length === 0) return null;
          return (
            <div key={catName} style={{ marginTop: 12 }}>
              <h4 style={{ margin: "6px 0" }}>{catName}</h4>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {list.map((a) => {
                  const earned = Boolean(userAchievements[a.id]);
                  const prog = achievementProgress(a);
                  return (
                    <div key={a.id} style={{ width: 220, padding: 10, borderRadius: 8, background: earned ? "#fff" : "#fafafa", border: "1px solid #eee" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={{ width: 44, height: 44, borderRadius: 8, background: earned ? "#efefef" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                          {a.icon ?? "🏅"}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700 }}>{a.name}</div>
                          <div style={{ fontSize: 12, color: "#666" }}>{a.description}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 700 }}>{a.points} pts</div>
                          {earned ? <div style={{ fontSize: 12, color: "#10b981" }}>Earned</div> : <div style={{ fontSize: 12, color: "#666" }}>Locked</div>}
                        </div>
                      </div>

                      {!earned && prog ? (
                        <div style={{ marginTop: 8 }}>
                          {prog.have != null ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ fontSize: 13 }}>{prog.have} / {prog.need}</div>
                              <div style={{ fontSize: 12, color: "#666" }}>{prog.label}</div>
                            </div>
                          ) : (
                            <div style={{ fontSize: 13, color: "#666" }}>{prog.label}</div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 12 }}>
        <Link href="/profile" className="text-sm" style={{ color: "#2563eb" }}>View full achievements</Link>
      </div>
    </section>
  );
}