'use client';
import React, { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { ShopReview } from "@/src/types";
import ShopReviewItem from "./ShopReviewItem";
import ReviewForm from "./ReviewForm";

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

      <ReviewForm
        coffeeQuality={coffeeQuality}
        setCoffeeQuality={setCoffeeQuality}
        atmosphere={atmosphere}
        setAtmosphere={setAtmosphere}
        noiseLevel={noiseLevel}
        setNoiseLevel={setNoiseLevel}
        wifiQuality={wifiQuality}
        setWifiQuality={setWifiQuality}
        workFriendliness={workFriendliness}
        setWorkFriendliness={setWorkFriendliness}
        service={service}
        setService={setService}
        text={text}
        setText={setText}
        saving={saving}
        handleSubmit={handleSubmit}
        userId={userId}
        error={error}
      />

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