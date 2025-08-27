'use client';

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../src/lib/supabase";

type Stats = {
  visited: number;
  favorite: number;
  want_to_try: number;
  shopReviews: number;
  drinkReviews: number;
  memberSince?: string | null;
};

type User = {
  id: string;
  email?: string | null;
  created_at?: string | null;
};

type ShopShort = {
  id: string | number;
  name?: string | null;
};

type ShopReviewItem = {
  id: string;
  user_id: string;
  rating: number | string;
  review_text?: string | null;
  created_at?: string | null;
  shop_id?: string | number;
  shop?: ShopShort | null;
};

type DrinkReviewItem = {
  id: string;
  user_id: string;
  drink_name?: string | null;
  drink_type?: string | null;
  rating?: string | null;
  review_text?: string | null;
  created_at?: string | null;
  shop_id?: string | number;
  shop?: ShopShort | null;
};

type ShopListItem = {
  id: string;
  shop_id?: string | number;
  status: string;
  created_at?: string | null;
  shop?: ShopShort | null;
};

function formatDate(iso?: string | null) {
  if (!iso) return "Unknown";
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<Stats>({
    visited: 0,
    favorite: 0,
    want_to_try: 0,
    shopReviews: 0,
    drinkReviews: 0,
    memberSince: null,
  });
  const [error, setError] = useState<string | null>(null);

  // Activity lists + pagination state
  const PAGE_SIZE = 10;

  const [shopReviewsList, setShopReviewsList] = useState<ShopReviewItem[]>([]);
  const [shopReviewsPage, setShopReviewsPage] = useState(0);
  const [shopReviewsHasMore, setShopReviewsHasMore] = useState(false);
  const [shopReviewsLoading, setShopReviewsLoading] = useState(false);

  const [drinkReviewsList, setDrinkReviewsList] = useState<DrinkReviewItem[]>([]);
  const [drinkReviewsPage, setDrinkReviewsPage] = useState(0);
  const [drinkReviewsHasMore, setDrinkReviewsHasMore] = useState(false);
  const [drinkReviewsLoading, setDrinkReviewsLoading] = useState(false);

  const [shopLists, setShopLists] = useState<ShopListItem[]>([]);
  const [shopListsPage, setShopListsPage] = useState(0);
  const [shopListsHasMore, setShopListsHasMore] = useState(false);
  const [shopListsLoading, setShopListsLoading] = useState(false);

  // Lightweight profile editing state
  const [editingProfile, setEditingProfile] = useState(false);
  const [displayName, setDisplayName] = useState<string>("");
  const [bio, setBio] = useState<string>("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Top reviewed drinks summary (computed client-side from recent reviews)
  const [topDrinks, setTopDrinks] = useState<{ name: string; count: number }[]>([]);
  const [topDrinkTypes, setTopDrinkTypes] = useState<{ type: string; count: number }[]>([]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
        if (sessErr) {
          console.info("Auth: getSession error", sessErr);
        }
        const currentUser = sessionData?.session?.user ?? null;

        if (!mounted) return;
        if (!currentUser) {
          router.push("/");
          return;
        }

        setUser(currentUser);

        const userId = currentUser.id;

        const visitedPromise = supabase
          .from("user_shop_status")
          .select("user_id", { count: "exact" })
          .eq("user_id", userId)
          .eq("status", "visited");

        const favoritePromise = supabase
          .from("user_shop_status")
          .select("user_id", { count: "exact" })
          .eq("user_id", userId)
          .eq("status", "favorite");

        const wantPromise = supabase
          .from("user_shop_status")
          .select("user_id", { count: "exact" })
          .eq("user_id", userId)
          .eq("status", "want_to_try");

        const shopReviewsPromise = supabase
          .from("shop_reviews")
          .select("id", { count: "exact" })
          .eq("user_id", userId);

        const drinkReviewsPromise = supabase
          .from("drink_reviews")
          .select("id", { count: "exact" })
          .eq("user_id", userId);

        // Try to obtain member since and profile fields from user_profiles
        const profilePromise = supabase
          .from("user_profiles")
          .select("created_at,display_name,bio")
          .eq("id", userId)
          .single();

        const [
          visitedRes,
          favoriteRes,
          wantRes,
          shopReviewsRes,
          drinkReviewsRes,
          profileRes,
        ] = await Promise.all([
          visitedPromise,
          favoritePromise,
          wantPromise,
          shopReviewsPromise,
          drinkReviewsPromise,
          profilePromise,
        ]);

        const visited = visitedRes.count ?? 0;
        const favorite = favoriteRes.count ?? 0;
        const want_to_try = wantRes.count ?? 0;
        const shopReviews = shopReviewsRes.count ?? 0;
        const drinkReviews = drinkReviewsRes.count ?? 0;

        // Determine memberSince and profile fields: prefer auth user.created_at, fallback to user_profiles.created_at
        const memberSince =
          currentUser?.created_at ??
          (profileRes?.data?.created_at as string | undefined) ??
          null;

        // Prefer stored display_name/bio from user_profiles; fall back to auth user metadata when available
        const displayNameVal =
          (profileRes?.data?.display_name as string | undefined) ??
          (currentUser?.user_metadata?.full_name as string | undefined) ??
          "";
        const bioVal = (profileRes?.data?.bio as string | undefined) ?? "";

        if (!mounted) return;

        setStats({
          visited,
          favorite,
          want_to_try,
          shopReviews,
          drinkReviews,
          memberSince,
        });

        // Populate profile edit fields (not saved until user presses Save)
        setDisplayName(displayNameVal);
        setBio(bioVal);

        // Load initial activity lists (first page)
        // Kick off in background; don't await here so UI loads quickly
        fetchShopReviews(currentUser.id, 0);
        fetchDrinkReviews(currentUser.id, 0);
        fetchShopLists(currentUser.id, 0);
        fetchTopDrinks(currentUser.id);
        fetchTopDrinkTypes(currentUser.id);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Fetch user's shop reviews with basic pagination
  async function fetchShopReviews(userId: string, page = 0, append = false) {
    try {
      setShopReviewsLoading(true);
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const res = await supabase
        .from("shop_reviews")
        .select("id,user_id,rating,review_text,created_at,shop_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (res.error) {
        console.warn("shop reviews fetch error", res.error);
        return;
      }
      const items = Array.isArray(res.data) ? (res.data as ShopReviewItem[]) : ([] as ShopReviewItem[]);
      
      // Fetch shop names for these shop_ids
      const shopIds = Array.from(new Set(items.map((i) => i.shop_id).filter(Boolean)));
      let shopsMap: Record<string, ShopShort> = {};
      if (shopIds.length > 0) {
        const shopRes = await supabase
          .from("coffee_shops")
          .select("id,name")
          .in("id", shopIds);
        if (!shopRes.error && Array.isArray(shopRes.data)) {
          shopsMap = Object.fromEntries((shopRes.data as ShopShort[]).map((s) => [String(s.id), s]));
        }
      }
      
      const withShop = items.map((it) => ({
        ...it,
        shop: shopsMap[String(it.shop_id)] ?? null,
      }));

      setShopReviewsList((prev) => (append ? [...prev, ...withShop] : withShop));
      setShopReviewsPage(page);
      setShopReviewsHasMore(withShop.length === PAGE_SIZE);
    } finally {
      setShopReviewsLoading(false);
    }
  }

  // Fetch user's drink reviews with pagination
  async function fetchDrinkReviews(userId: string, page = 0, append = false) {
    try {
      setDrinkReviewsLoading(true);
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const res = await supabase
        .from("drink_reviews")
        .select("id,user_id,drink_name,rating,review_text,drink_type,created_at,shop_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (res.error) {
        console.warn("drink reviews fetch error", res.error);
        return;
      }
      const items = Array.isArray(res.data) ? (res.data as DrinkReviewItem[]) : ([] as DrinkReviewItem[]);
      
      // Fetch shop names
      const shopIds = Array.from(new Set(items.map((i) => i.shop_id).filter(Boolean)));
      let shopsMap: Record<string, ShopShort> = {};
      if (shopIds.length > 0) {
        const shopRes = await supabase
          .from("coffee_shops")
          .select("id,name")
          .in("id", shopIds);
        if (!shopRes.error && Array.isArray(shopRes.data)) {
          shopsMap = Object.fromEntries((shopRes.data as ShopShort[]).map((s) => [String(s.id), s]));
        }
      }
      
      const withShop = items.map((it) => ({
        ...it,
        shop: shopsMap[String(it.shop_id)] ?? null,
      }));

      setDrinkReviewsList((prev) => (append ? [...prev, ...withShop] : withShop));
      setDrinkReviewsPage(page);
      setDrinkReviewsHasMore(withShop.length === PAGE_SIZE);
    } finally {
      setDrinkReviewsLoading(false);
    }
  }

  // Fetch user's shop status list (visited/favorite/want_to_try) with pagination
  async function fetchShopLists(userId: string, page = 0, append = false) {
    try {
      setShopListsLoading(true);
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const res = await supabase
        .from("user_shop_status")
        .select("id,shop_id,status,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (res.error) {
        console.warn("shop lists fetch error", res.error);
        return;
      }
      const items = Array.isArray(res.data) ? (res.data as ShopListItem[]) : ([] as ShopListItem[]);

      // Fetch shop names
      const shopIds = Array.from(new Set(items.map((i) => i.shop_id).filter(Boolean)));
      let shopsMap: Record<string, ShopShort> = {};
      if (shopIds.length > 0) {
        const shopRes = await supabase
          .from("coffee_shops")
          .select("id,name")
          .in("id", shopIds);
        if (!shopRes.error && Array.isArray(shopRes.data)) {
          shopsMap = Object.fromEntries((shopRes.data as ShopShort[]).map((s) => [String(s.id), s]));
        }
      }

      const withShop = items.map((it) => ({
        ...it,
        shop: shopsMap[String(it.shop_id)] ?? null,
      }));

      setShopLists((prev) => (append ? [...prev, ...withShop] : withShop));
      setShopListsPage(page);
      setShopListsHasMore(withShop.length === PAGE_SIZE);
    } finally {
      setShopListsLoading(false);
    }
  }

  // Fetch user's top-reviewed drinks (simple client-side aggregation)
  async function fetchTopDrinks(userId: string) {
    try {
      const res = await supabase
        .from("drink_reviews")
        .select("drink_name")
        .eq("user_id", userId)
        .limit(300);
      if (res.error) {
        console.warn("top drinks fetch error", res.error);
        return;
      }
      const rows = Array.isArray(res.data) ? (res.data as { drink_name?: string }[]) : [];
      const counts: Record<string, number> = {};
      for (const r of rows) {
        const name = (r.drink_name ?? "Unknown").trim();
        if (!name) continue;
        counts[name] = (counts[name] ?? 0) + 1;
      }
      const arr = Object.entries(counts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      setTopDrinks(arr);
    } catch (err) {
      console.warn("fetchTopDrinks error", err);
    }
  }

  // Fetch user's top drink types (e.g., espresso, pour over)
  async function fetchTopDrinkTypes(userId: string) {
    try {
      const res = await supabase
        .from("drink_reviews")
        .select("drink_type")
        .eq("user_id", userId)
        .limit(500);
      if (res.error) {
        console.warn("top drink types fetch error", res.error);
        return;
      }
      const rows = Array.isArray(res.data) ? (res.data as { drink_type?: string }[]) : [];
      const counts: Record<string, number> = {};
      for (const r of rows) {
        const t = (r.drink_type ?? "Unknown").trim();
        if (!t) continue;
        counts[t] = (counts[t] ?? 0) + 1;
      }
      const arr = Object.entries(counts)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      setTopDrinkTypes(arr);
    } catch (err) {
      console.warn("fetchTopDrinkTypes error", err);
    }
  }

  // Profile editing: display name / bio
  async function saveProfile() {
    if (!user) return;
    setSavingProfile(true);
    try {
      const payload = {
        id: user.id,
        email: user.email ?? null,
        display_name: displayName || null,
        bio: bio || null,
      };
      const up = await supabase.from("user_profiles").upsert(payload, { onConflict: "id" });
      if (up.error) throw up.error;
      // Refresh summary info
      fetchTopDrinks(user.id);
      setEditingProfile(false);
    } catch (err) {
      console.warn("saveProfile error", err);
    } finally {
      setSavingProfile(false);
    }
  }

  // Helpers to load more pages from UI

  // Helpers to load more pages from UI
  function loadMoreShopReviews() {
    if (!user) return;
    fetchShopReviews(user.id, shopReviewsPage + 1, true);
  }
  function loadMoreDrinkReviews() {
    if (!user) return;
    fetchDrinkReviews(user.id, drinkReviewsPage + 1, true);
  }
  function loadMoreShopLists() {
    if (!user) return;
    fetchShopLists(user.id, shopListsPage + 1, true);
  }

  if (loading) {
    return (
      <div style={{ padding: 16, maxWidth: 960, margin: "0 auto" }}>
        <div>Loading profile...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  function ratingLabelForDrink(r?: string | null) {
    if (!r) return "";
    return r.charAt(0).toUpperCase() + r.slice(1);
  }

  return (
    <div style={{ padding: 16, maxWidth: 960, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>Profile</h1>
        <Link href="/" className="text-sm">Back</Link>
      </div>

      <section style={{ marginTop: 16, border: "1px solid #eee", padding: 12, borderRadius: 6 }}>
        <h2 className="text-lg font-semibold">Basic Information</h2>

        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          <div><strong>Display name:</strong> {displayName ? <span>{displayName}</span> : <em style={{ color: "#666" }}>Not set</em>}</div>
          <div><strong>Email:</strong> {user.email}</div>
          <div><strong>Member since:</strong> {formatDate(stats.memberSince)}</div>

          {editingProfile ? (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Display name"
                style={{ padding: 8, borderRadius: 6, border: "1px solid #d1d5db" }}
              />
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                placeholder="Short bio (what you like about coffee...)"
                style={{ padding: 8, borderRadius: 6, border: "1px solid #d1d5db", resize: "vertical" }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => saveProfile()}
                  disabled={savingProfile}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid #111827",
                    background: "#111827",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  {savingProfile ? "Saving…" : "Save profile"}
                </button>
                <button
                  onClick={() => {
                    // revert any unsaved edits to last saved values
                    setEditingProfile(false);
                  }}
                  disabled={savingProfile}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    background: "#fff",
                    color: "#111827",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 8 }}>
              <div style={{ color: "#444" }}>{bio ? bio : <span style={{ color: "#666" }}>No bio yet. Tell others what coffee you like.</span>}</div>
              <div style={{ marginTop: 8 }}>
                <button
                  onClick={() => setEditingProfile(true)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid #111827",
                    background: "#fff",
                    color: "#111827",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Edit profile
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Top reviewed drinks summary */}
        <div style={{ marginTop: 12 }}>
          <h3 style={{ margin: "8px 0" }}>Favorite drinks</h3>
          {topDrinks.length === 0 ? (
            <div style={{ color: "#666" }}>No drink reviews yet to summarise.</div>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {topDrinks.map((d) => (
                <div key={d.name} style={{ padding: "6px 10px", background: "#f5f5f5", borderRadius: 8 }}>
                  {d.name} <strong style={{ marginLeft: 6 }}>×{d.count}</strong>
                </div>
              ))}
            </div>
          )}

          {/* Favorite drink types */}
          <div style={{ marginTop: 8 }}>
            <h4 style={{ margin: "6px 0" }}>Top drink types</h4>
            {topDrinkTypes.length === 0 ? (
              <div style={{ color: "#666" }}>No drink type data yet.</div>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {topDrinkTypes.map((t) => (
                  <div key={t.type} style={{ padding: "6px 10px", background: "#f7f7f7", borderRadius: 8 }}>
                    {t.type} <strong style={{ marginLeft: 6 }}>×{t.count}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section style={{ marginTop: 16, border: "1px solid #eee", padding: 12, borderRadius: 6 }}>
        <h2 className="text-lg font-semibold">Activity Summary</h2>
        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
          <div style={{ padding: 8, border: "1px solid #f0f0f0", borderRadius: 6 }}>
            <div className="text-sm text-gray-600">Shops visited</div>
            <div style={{ fontWeight: 600, fontSize: 18 }}>{stats.visited}</div>
          </div>

          <div style={{ padding: 8, border: "1px solid #f0f0f0", borderRadius: 6 }}>
            <div className="text-sm text-gray-600">Favorites</div>
            <div style={{ fontWeight: 600, fontSize: 18 }}>{stats.favorite}</div>
          </div>

          <div style={{ padding: 8, border: "1px solid #f0f0f0", borderRadius: 6 }}>
            <div className="text-sm text-gray-600">Want to try</div>
            <div style={{ fontWeight: 600, fontSize: 18 }}>{stats.want_to_try}</div>
          </div>

          <div style={{ padding: 8, border: "1px solid #f0f0f0", borderRadius: 6 }}>
            <div className="text-sm text-gray-600">Shop reviews</div>
            <div style={{ fontWeight: 600, fontSize: 18 }}>{stats.shopReviews}</div>
          </div>

          <div style={{ padding: 8, border: "1px solid #f0f0f0", borderRadius: 6 }}>
            <div className="text-sm text-gray-600">Drink reviews</div>
            <div style={{ fontWeight: 600, fontSize: 18 }}>{stats.drinkReviews}</div>
          </div>
        </div>
      </section>

      {/* Quick navigation */}
      <section style={{ marginTop: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/" style={{ padding: "8px 10px", borderRadius: 8, background: "#f3f4f6", fontWeight: 600 }}>Map</Link>
          <Link href="/new-shops" style={{ padding: "8px 10px", borderRadius: 8, background: "#f3f4f6", fontWeight: 600 }}>New shops</Link>
          <Link href="/random" style={{ padding: "8px 10px", borderRadius: 8, background: "#f3f4f6", fontWeight: 600 }}>Random shop</Link>
          <Link href="/profile" style={{ padding: "8px 10px", borderRadius: 8, background: "#f3f4f6", fontWeight: 600 }}>My profile</Link>
        </div>
      </section>

      {error ? (
        <div style={{ marginTop: 12, color: "red" }}>Error loading profile: {error}</div>
      ) : null}

      {/* My Shop Reviews */}
      <section style={{ marginTop: 18 }}>
        <h2 className="text-lg font-semibold">My Shop Reviews</h2>
        <div style={{ marginTop: 8 }}>
          {shopReviewsLoading && shopReviewsList.length === 0 ? (
            <div>Loading shop reviews…</div>
          ) : shopReviewsList.length === 0 ? (
            <div style={{ color: "#666" }}>
              No shop reviews yet. <Link href="/new-shops" style={{ color: "#2563eb", marginLeft: 8 }}>Explore shops</Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {shopReviewsList.map((r) => (
                <div key={r.id} style={{ padding: 12, borderRadius: 8, border: "1px solid #eee", background: "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      {r.shop ? (
                        <Link href={`/shop/${r.shop.id}`} style={{ fontWeight: 700 }}>
                          {r.shop.name}
                        </Link>
                      ) : (
                        <span style={{ fontWeight: 700 }}>Shop</span>
                      )}
                      <div style={{ fontSize: 13, color: "#666", marginTop: 6 }}>
                        {r.review_text ? <span>{r.review_text}</span> : <span style={{ color: "#999" }}>No comment</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 700 }}>{r.rating} ★</div>
                      <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>{r.created_at ? new Date(r.created_at).toLocaleString() : "unknown"}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {shopReviewsHasMore ? (
            <div style={{ marginTop: 8 }}>
              <button
                onClick={() => loadMoreShopReviews()}
                disabled={shopReviewsLoading}
                style={{
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid #111827",
                  background: "#111827",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                {shopReviewsLoading ? "Loading…" : "Show more"}
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {/* My Drink Reviews */}
      <section style={{ marginTop: 18 }}>
        <h2 className="text-lg font-semibold">My Drink Reviews</h2>
        <div style={{ marginTop: 8 }}>
          {drinkReviewsLoading && drinkReviewsList.length === 0 ? (
            <div>Loading drink reviews…</div>
          ) : drinkReviewsList.length === 0 ? (
            <div style={{ color: "#666" }}>
              No drink reviews yet. <Link href="/new-shops" style={{ color: "#2563eb", marginLeft: 8 }}>Try a shop</Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {drinkReviewsList.map((r) => (
                <div key={r.id} style={{ padding: 12, borderRadius: 8, border: "1px solid #eee", background: "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{r.drink_name}{r.drink_type ? ` · ${r.drink_type}` : ""}</div>
                      <div style={{ fontSize: 13, color: "#666", marginTop: 6 }}>
                        {r.review_text ? <span>{r.review_text}</span> : <span style={{ color: "#999" }}>No comment</span>}
                      </div>
                      {r.shop ? (
                        <div style={{ marginTop: 6 }}>
                          <Link href={`/shop/${r.shop.id}`} className="text-sm" style={{ color: "#2563eb" }}>
                            View shop: {r.shop.name}
                          </Link>
                        </div>
                      ) : null}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 700 }}>{ratingLabelForDrink(r.rating)}</div>
                      <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>{r.created_at ? new Date(r.created_at).toLocaleString() : "unknown"}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {drinkReviewsHasMore ? (
            <div style={{ marginTop: 8 }}>
              <button
                onClick={() => loadMoreDrinkReviews()}
                disabled={drinkReviewsLoading}
                style={{
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid #111827",
                  background: "#111827",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                {drinkReviewsLoading ? "Loading…" : "Show more"}
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {/* My Shop Lists (visited / favorites / want to try) */}
      <section style={{ marginTop: 18 }}>
        <h2 className="text-lg font-semibold">My Shop Lists</h2>
        <div style={{ marginTop: 8 }}>
          {shopListsLoading && shopLists.length === 0 ? (
            <div>Loading your shop lists…</div>
          ) : shopLists.length === 0 ? (
            <div style={{ color: "#666" }}>You haven't marked any shops yet. <Link href="/new-shops" style={{ color: "#2563eb", marginLeft: 8 }}>Find shops</Link></div>
          ) : (
            // Group by status
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {["visited", "favorite", "want_to_try"].map((status) => {
                const group = shopLists.filter((s) => s.status === status);
                if (group.length === 0) return null;
                return (
                  <div key={status} style={{ padding: 12, borderRadius: 8, border: "1px solid #eee", background: "#fff" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontWeight: 700, textTransform: "capitalize" }}>{status.replace("_", " ")}</div>
                    </div>
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                      {group.map((g) => (
                        <div key={g.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            {g.shop ? (
                              <Link href={`/shop/${g.shop.id}`} style={{ fontWeight: 600 }}>
                                {g.shop.name}
                              </Link>
                            ) : (
                              <span style={{ fontWeight: 600 }}>Shop</span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: "#666" }}>{g.created_at ? new Date(g.created_at).toLocaleString() : "unknown"}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {shopListsHasMore ? (
            <div style={{ marginTop: 8 }}>
              <button
                onClick={() => loadMoreShopLists()}
                disabled={shopListsLoading}
                style={{
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid #111827",
                  background: "#111827",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                {shopListsLoading ? "Loading…" : "Show more"}
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}