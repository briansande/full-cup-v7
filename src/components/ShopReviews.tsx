'use client';
import React, { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { ShopReview } from "@/src/types";
import ShopReviewItem from "./ShopReviewItem";

type Props = {
  shopId: string;
};

export default function ShopReviews({ shopId }: Props) {
  const [reviews, setReviews] = useState<ShopReview[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Per-criterion rating state
  const [coffeeQuality, setCoffeeQuality] = useState<number>(5); // required
  const [atmosphere, setAtmosphere] = useState<number | null>(null);
  const [noiseLevel, setNoiseLevel] = useState<number | null>(null);
  const [wifiQuality, setWifiQuality] = useState<number | "na" | null>("na"); // "na" = N/A
  const [workFriendliness, setWorkFriendliness] = useState<number | null>(null);
  const [service, setService] = useState<number | null>(null);
  const [text, setText] = useState<string>("");

  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    async function init() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData?.session?.user ?? null;
        if (!mounted) return;
        setUserId(user?.id ?? null);

        // Fetch reviews for this shop (include all criteria)
        const rev = await supabase
          .from("shop_reviews")
          .select("id,user_id,shop_id,rating,review_text,created_at,coffee_quality_rating,atmosphere_rating,noise_level_rating,wifi_quality_rating,work_friendliness_rating,service_rating")
          .eq("shop_id", shopId)
          .order("created_at", { ascending: false });

        if (!mounted) return;
        if (rev.error) {
          setError(String(rev.error));
          setReviews([]);
        } else {
          setReviews(Array.isArray(rev.data) ? (rev.data as ShopReview[]) : []);
        }

        // If user is signed in, fetch their review (to prefill form)
        if (user) {
          const mine = await supabase
            .from("shop_reviews")
            .select("rating,review_text,coffee_quality_rating,atmosphere_rating,noise_level_rating,wifi_quality_rating,work_friendliness_rating,service_rating")
            .eq("shop_id", shopId)
            .eq("user_id", user.id)
            .limit(1)
            .single();
          if (!mounted) return;
          if (!mine.error && mine.data) {
            // Populate per-criterion fields, with sensible fallbacks
            const md: any = mine.data;
            setCoffeeQuality(md.coffee_quality_rating ?? (md.rating != null ? Math.round(Number(md.rating)) : 5));
            setAtmosphere(md.atmosphere_rating ?? null);
            setNoiseLevel(md.noise_level_rating ?? null);
            setWifiQuality(md.wifi_quality_rating == null ? "na" : md.wifi_quality_rating);
            setWorkFriendliness(md.work_friendliness_rating ?? null);
            setService(md.service_rating ?? null);
            setText(md.review_text ?? "");
          }
        }
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, [shopId]);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault?.();
    setSaving(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user ?? null;
      if (!user) {
        setError("Sign in to leave a review.");
        setSaving(false);
        return;
      }

      // Upsert review (one review per user/shop enforced by unique index in migration)
      const up = await supabase.from("shop_reviews").upsert(
        {
          user_id: user.id,
          shop_id: shopId,
          // Write per-criterion ratings; overall `rating` is computed by DB trigger
          coffee_quality_rating: coffeeQuality,
          atmosphere_rating: atmosphere ?? null,
          noise_level_rating: noiseLevel ?? null,
          wifi_quality_rating: wifiQuality === "na" ? null : (wifiQuality as number | null),
          work_friendliness_rating: workFriendliness ?? null,
          service_rating: service ?? null,
          review_text: text || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,shop_id" }
      );

      if (up.error) throw up.error;

      // Re-fetch reviews (include criteria)
      const rev = await supabase
        .from("shop_reviews")
        .select("id,user_id,shop_id,rating,review_text,created_at,coffee_quality_rating,atmosphere_rating,noise_level_rating,wifi_quality_rating,work_friendliness_rating,service_rating")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false });

      if (!rev.error && Array.isArray(rev.data)) {
        setReviews(rev.data as ShopReview[]);
      }

      // Notify other UI (map) to refresh averages
      try {
        window.dispatchEvent(new Event("fullcup:sync"));
      } catch {
        // ignore
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginTop: 18 }}>
      <h3 style={{ margin: "8px 0" }}>Reviews</h3>

      {!userId ? (
        <div style={{ color: "#666", marginBottom: 12 }}>
          Sign in to leave a review. The login form is in the header.
        </div>
      ) : null}

      <form onSubmit={(e) => handleSubmit(e)} style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>Coffee quality (required)</label>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
            {[1, 2, 3, 4, 5].map((n) => {
              const selected = n === coffeeQuality;
              return (
                <button
                  key={`coffee-${n}`}
                  type="button"
                  onClick={() => setCoffeeQuality(n)}
                  style={{
                    padding: "6px 8px",
                    borderRadius: 6,
                    border: selected ? "1px solid #111827" : "1px solid #d1d5db",
                    background: selected ? "#111827" : "#fff",
                    color: selected ? "#fff" : "#111827",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  {n} ★
                </button>
              );
            })}
          </div>

          <div style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>Atmosphere (optional)</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
            {[null,1,2,3,4,5].map((n) => {
              const selected = n === atmosphere;
              return (
                <button
                  key={`atmos-${String(n)}`}
                  type="button"
                  onClick={() => setAtmosphere(n as number | null)}
                  style={{
                    padding: "6px 8px",
                    borderRadius: 6,
                    border: selected ? "1px solid #111827" : "1px solid #d1d5db",
                    background: selected ? "#111827" : "#fff",
                    color: selected ? "#fff" : "#111827",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  {n === null ? "N/A" : `${n} ★`}
                </button>
              );
            })}
          </div>

          <div style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>Noise level (1=quiet, 5=loud)</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
            {[null,1,2,3,4,5].map((n) => {
              const selected = n === noiseLevel;
              return (
                <button
                  key={`noise-${String(n)}`}
                  type="button"
                  onClick={() => setNoiseLevel(n as number | null)}
                  style={{
                    padding: "6px 8px",
                    borderRadius: 6,
                    border: selected ? "1px solid #111827" : "1px solid #d1d5db",
                    background: selected ? "#111827" : "#fff",
                    color: selected ? "#fff" : "#111827",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  {n === null ? "N/A" : `${n}`}
                </button>
              );
            })}
          </div>

          <div style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>WiFi quality (optional)</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
            <button
              type="button"
              onClick={() => setWifiQuality("na")}
              style={{
                padding: "6px 8px",
                borderRadius: 6,
                border: wifiQuality === "na" ? "1px solid #111827" : "1px solid #d1d5db",
                background: wifiQuality === "na" ? "#111827" : "#fff",
                color: wifiQuality === "na" ? "#fff" : "#111827",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              N/A
            </button>
            {[1,2,3,4,5].map((n) => {
              const selected = wifiQuality === n;
              return (
                <button
                  key={`wifi-${n}`}
                  type="button"
                  onClick={() => setWifiQuality(n)}
                  style={{
                    padding: "6px 8px",
                    borderRadius: 6,
                    border: selected ? "1px solid #111827" : "1px solid #d1d5db",
                    background: selected ? "#111827" : "#fff",
                    color: selected ? "#fff" : "#111827",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  {n} ★
                </button>
              );
            })}
          </div>

          <div style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>Work environment (optional)</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
            {[null,1,2,3,4,5].map((n) => {
              const selected = n === workFriendliness;
              return (
                <button
                  key={`work-${String(n)}`}
                  type="button"
                  onClick={() => setWorkFriendliness(n as number | null)}
                  style={{
                    padding: "6px 8px",
                    borderRadius: 6,
                    border: selected ? "1px solid #111827" : "1px solid #d1d5db",
                    background: selected ? "#111827" : "#fff",
                    color: selected ? "#fff" : "#111827",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  {n === null ? "N/A" : `${n} ★`}
                </button>
              );
            })}
          </div>

          <div style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>Service (optional)</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {[null,1,2,3,4,5].map((n) => {
              const selected = n === service;
              return (
                <button
                  key={`service-${String(n)}`}
                  type="button"
                  onClick={() => setService(n as number | null)}
                  style={{
                    padding: "6px 8px",
                    borderRadius: 6,
                    border: selected ? "1px solid #111827" : "1px solid #d1d5db",
                    background: selected ? "#111827" : "#fff",
                    color: selected ? "#fff" : "#111827",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  {n === null ? "N/A" : `${n} ★`}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Your review (optional)</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 6,
              border: "1px solid #d1d5db",
              resize: "vertical",
            }}
            placeholder="Share a short thought about this shop..."
          />
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #111827",
              background: "#111827",
              color: "#fff",
              cursor: saving ? "default" : "pointer",
              fontWeight: 700,
            }}
          >
            {saving ? "Saving…" : "Save review"}
          </button>

          <button
            type="button"
            onClick={() => {
              // Reset per-criterion state to defaults
              setCoffeeQuality(5);
              setAtmosphere(null);
              setNoiseLevel(null);
              setWifiQuality("na");
              setWorkFriendliness(null);
              setService(null);
              setText("");
            }}
            disabled={saving}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              background: "#fff",
              color: "#111827",
              cursor: saving ? "default" : "pointer",
              fontWeight: 600,
            }}
          >
            Reset
          </button>

          {error ? <div style={{ color: "red" }}>{error}</div> : null}
        </div>
      </form>

      <div>
        {loading ? (
          <div>Loading reviews…</div>
        ) : reviews.length === 0 ? (
          <div style={{ color: "#666" }}>No reviews yet. Be the first to leave one.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {reviews.map((r) => (
              <ShopReviewItem
                key={r.id}
                review={r}
                userId={userId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}