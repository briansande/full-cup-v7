'use client';
import React, { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";

type Review = {
  id: string;
  user_id: string;
  rating: number;
  review_text: string | null;
  created_at: string | null;
};

type Props = {
  shopId: string;
};

export default function ShopReviews({ shopId }: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [rating, setRating] = useState<number>(5);
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

        // Fetch reviews for this shop
        const rev = await supabase
          .from("shop_reviews")
          .select("id,user_id,rating,review_text,created_at")
          .eq("shop_id", shopId)
          .order("created_at", { ascending: false });

        if (!mounted) return;
        if (rev.error) {
          setError(String(rev.error));
          setReviews([]);
        } else {
          setReviews(Array.isArray(rev.data) ? (rev.data as Review[]) : []);
        }

        // If user is signed in, fetch their review (to prefill form)
        if (user) {
          const mine = await supabase
            .from("shop_reviews")
            .select("rating,review_text")
            .eq("shop_id", shopId)
            .eq("user_id", user.id)
            .limit(1)
            .single();
          if (!mounted) return;
          if (!mine.error && mine.data) {
            setRating(mine.data.rating ?? 5);
            setText(mine.data.review_text ?? "");
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
          rating,
          review_text: text || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,shop_id" }
      );

      if (up.error) throw up.error;

      // Re-fetch reviews
      const rev = await supabase
        .from("shop_reviews")
        .select("id,user_id,rating,review_text,created_at")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false });

      if (!rev.error && Array.isArray(rev.data)) {
        setReviews(rev.data as Review[]);
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
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <label style={{ fontWeight: 600 }}>Your rating</label>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {[1, 2, 3, 4, 5].map((n) => {
              const selected = n === rating;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
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
              setRating(5);
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
              <div key={r.id} style={{ padding: 12, background: "#fafafa", borderRadius: 8, border: "1px solid #eee" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 700 }}>{r.user_id === userId ? "You" : `${r.user_id.substring(0, 6)}...`}</div>
                  <div style={{ fontWeight: 700 }}>{r.rating} ★</div>
                </div>
                {r.review_text ? <div style={{ marginTop: 8 }}>{r.review_text}</div> : null}
                {r.created_at ? (
                  <div style={{ marginTop: 8, color: "#666", fontSize: 12 }}>
                    {new Date(r.created_at).toLocaleString()}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}