'use client';

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/src/lib/supabase";

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
    return <section className="mt-4 border border-gray-200 p-3 rounded-lg"><div>Loading Coffee Passport…</div></section>;
  }

  return (
    <section className="mt-4 border border-gray-200 p-3 rounded-lg">
      <h2 className="text-lg font-semibold">Coffee Passport</h2>

      {error ? <div className="text-red-500 mt-2">{error}</div> : null}

      <div className="mt-2.5 flex gap-3 items-center flex-wrap">
        <div className="p-3 rounded-lg bg-white border border-gray-100 min-w-[160px]">
          <div className="text-sm text-gray-600">Level</div>
          <div className="text-xl font-bold">{userStats?.level ?? 1}</div>
          <div className="text-xs text-gray-600 mt-1.5">{totalPoints} points</div>
        </div>

        <div className="p-3 rounded-lg bg-white border border-gray-100 flex-1">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-sm text-gray-600">Achievements</div>
              <div className="text-xl font-bold">{earnedCount} / {totalAchievements}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Recent</div>
              <div className="font-bold">{recentEarned.length}</div>
            </div>
          </div>

          <div className="mt-2">
            <div className="text-xs text-gray-600">
              Total recognition points: <strong>{totalPoints}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Recent achievements */}
      <div className="mt-3.5">
        <h3 className="my-2 font-medium">Recent Achievements</h3>
        {recentEarned.length === 0 ? (
          <div className="text-gray-500">No achievements earned yet. Keep exploring!</div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {recentEarned.map(({ def, ua }) => {
              if (!def) return null;
              return (
                <div key={def.id} className="flex gap-2 items-center p-2 bg-white rounded-lg border border-gray-200">
                  <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-lg">
                    {def.icon ?? "🏅"}
                  </div>
                  <div>
                    <div className="font-bold">{def.name}</div>
                    <div className="text-xs text-gray-600">{ua.earned_at ? new Date(ua.earned_at).toLocaleDateString() : ""}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Achievement categories */}
      <div className="mt-3.5">
        {Object.entries(categories).map(([catName, list]) => {
          if (!list || list.length === 0) return null;
          return (
            <div key={catName} className="mt-3">
              <h4 className="my-1.5 font-medium">{catName}</h4>
              <div className="flex gap-2 flex-wrap">
                {list.map((a) => {
                  const earned = Boolean(userAchievements[a.id]);
                  const prog = achievementProgress(a);
                  return (
                    <div key={a.id} className={`w-56 p-2.5 rounded-lg border ${earned ? 'bg-white' : 'bg-gray-50'} border-gray-20`}>
                      <div className="flex gap-2 items-center">
                        <div className={`w-11 h-11 rounded-lg ${earned ? 'bg-gray-100' : 'bg-white'} flex items-center justify-center text-lg`}>
                          {a.icon ?? "🏅"}
                        </div>
                        <div className="flex-1">
                          <div className="font-bold">{a.name}</div>
                          <div className="text-xs text-gray-600">{a.description}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{a.points} pts</div>
                          {earned ? <div className="text-xs text-green-500">Earned</div> : <div className="text-xs text-gray-600">Locked</div>}
                        </div>
                      </div>

                      {!earned && prog ? (
                        <div className="mt-2">
                          {prog.have != null ? (
                            <div className="flex items-center gap-2">
                              <div className="text-xs">{prog.have} / {prog.need}</div>
                              <div className="text-xs text-gray-600">{prog.label}</div>
                            </div>
                          ) : (
                            <div className="text-xs text-gray-600">{prog.label}</div>
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

      <div className="mt-3">
        <Link href="/profile" className="text-sm text-blue-600">View full achievements</Link>
      </div>
    </section>
  );
}