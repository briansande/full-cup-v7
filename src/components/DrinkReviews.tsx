'use client';
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { DrinkReview } from "@/src/types";
import DrinkReviewForm from "./DrinkReviewForm";
import EditDrinkReviewForm from "./EditDrinkReviewForm";

type Props = {
  shopId: string;
};

function ratingToScore(r: string) {
  if (r === "awesome") return 3;
  if (r === "good") return 2;
  return 1;
}

function scoreToLabel(n: number) {
  if (n >= 2.5) return "Awesome";
  if (n >= 1.5) return "Good";
  return "Pass";
}

export default function DrinkReviews({ shopId }: Props) {
  const [reviews, setReviews] = useState<DrinkReview[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);

  // Form state (new review)
  const [drinkName, setDrinkName] = useState<string>("");
  const [drinkType, setDrinkType] = useState<string>("");
  const [rating, setRating] = useState<string>("good");
  const [text, setText] = useState<string>("");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDrinkName, setEditDrinkName] = useState<string>("");
  const [editDrinkType, setEditDrinkType] = useState<string>("");
  const [editRating, setEditRating] = useState<string>("good");
  const [editText, setEditText] = useState<string>("");

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

        // Fetch drink reviews for this shop
        const rev = await supabase
          .from("drink_reviews")
          .select("id,user_id,shop_id,drink_name,rating,review_text,drink_type,created_at")
          .eq("shop_id", shopId)
          .order("created_at", { ascending: false });

        if (!mounted) return;
        if (rev.error) {
          setError(String(rev.error));
          setReviews([]);
        } else {
          setReviews(Array.isArray(rev.data) ? (rev.data as DrinkReview[]) : []);
        }
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : String(err));
        setReviews([]);
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

  async function fetchReviews() {
    setLoading(true);
    setError(null);
    try {
      const rev = await supabase
        .from("drink_reviews")
        .select("id,user_id,shop_id,drink_name,rating,review_text,drink_type,created_at")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false });
      if (!rev.error && Array.isArray(rev.data)) {
        setReviews(rev.data as DrinkReview[]);
      } else if (rev.error) {
        setError(String(rev.error));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault?.();
    setSaving(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user ?? null;
      if (!user) {
        setError("Sign in to add a drink review.");
        setSaving(false);
        return;
      }

      if (!drinkName || drinkName.trim().length === 0) {
        setError("Please enter a drink name.");
        setSaving(false);
        return;
      }

      // Insert new drink review
      const insertPayload = {
        user_id: user.id,
        shop_id: shopId,
        drink_name: drinkName.trim(),
        drink_type: drinkType?.trim() || null,
        rating,
        review_text: text || null,
      };

      const ins = await supabase.from("drink_reviews").insert(insertPayload);

      if (ins.error) throw ins.error;

      // Refresh reviews
      await fetchReviews();

      // Reset a few fields
      setRating("good");
      setText("");

      // Notify other UI to refresh counts/averages
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

  // Edit handlers
  function startEdit(r: DrinkReview) {
    setEditingId(r.id);
    setEditDrinkName(r.drink_name);
    setEditDrinkType(r.drink_type ?? "");
    setEditRating(r.rating);
    setEditText(r.review_text ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDrinkName("");
    setEditDrinkType("");
    setEditRating("good");
    setEditText("");
  }

  async function submitEdit() {
    if (!editingId) return;
    setSaving(true);
    setError(null);
    try {
      const upd = await supabase
        .from("drink_reviews")
        .update({
          drink_name: editDrinkName.trim(),
          drink_type: editDrinkType?.trim() || null,
          rating: editRating,
          review_text: editText || null,
        })
        .eq("id", editingId);
      if (upd.error) throw upd.error;
      await fetchReviews();
      cancelEdit();
      try {
        window.dispatchEvent(new Event("fullcup:sync"));
      } catch {}
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function deleteReview(id: string) {
    const ok = confirm("Delete this review? This action cannot be undone.");
    if (!ok) return;
    setSaving(true);
    setError(null);
    try {
      const del = await supabase.from("drink_reviews").delete().eq("id", id);
      if (del.error) throw del.error;
      await fetchReviews();
      try {
        window.dispatchEvent(new Event("fullcup:sync"));
      } catch {}
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  // Group reviews by drink name + type
  const grouped = useMemo(() => {
    const map = new Map<string, { drink_name: string; drink_type: string | null; reviews: DrinkReview[] }>();
    for (const r of reviews) {
      const key = `${r.drink_name.toLowerCase().trim()}|${(r.drink_type ?? "").toLowerCase().trim()}`;
      if (!map.has(key)) {
        map.set(key, { drink_name: r.drink_name, drink_type: r.drink_type ?? null, reviews: [] });
      }
      map.get(key)!.reviews.push(r);
    }

    const arr = Array.from(map.values()).map((g) => {
      const scores = g.reviews.map((rr) => ratingToScore(rr.rating));
      const avgScore = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);
      return {
        ...g,
        avgScore,
        avgLabel: scoreToLabel(avgScore),
        count: g.reviews.length,
        reviews: g.reviews.sort((a, b) => {
          const ta = new Date(a.created_at ?? 0).getTime();
          const tb = new Date(b.created_at ?? 0).getTime();
          return tb - ta;
        }),
      };
    });

    // Sort by average score desc, then count desc, then name asc
    arr.sort((a, b) => {
      if (b.avgScore !== a.avgScore) return b.avgScore - a.avgScore;
      if (b.count !== a.count) return b.count - a.count;
      return a.drink_name.localeCompare(b.drink_name);
    });

    return arr;
  }, [reviews]);

  const totalDrinks = grouped.length;
  const totalReviews = reviews.length;
  const overallAvg =
    reviews.length > 0 ? reviews.map((r) => ratingToScore(r.rating)).reduce((a, b) => a + b, 0) / reviews.length : 0;

  return (
    <div style={{ marginTop: 18 }}>
      <h3 style={{ margin: "8px 0" }}>Drink reviews</h3>

      {/* Summary stats */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 12,
          color: "#333",
        }}
      >
        <div style={{ background: "#f5f5f5", padding: "8px 10px", borderRadius: 8 }}>
          Drinks reviewed: <strong>{totalDrinks}</strong>
        </div>
        <div style={{ background: "#f5f5f5", padding: "8px 10px", borderRadius: 8 }}>
          Total reviews: <strong>{totalReviews}</strong>
        </div>
        <div style={{ background: "#f5f5f5", padding: "8px 10px", borderRadius: 8 }}>
          Average: <strong>{overallAvg ? `${overallAvg.toFixed(2)} (${scoreToLabel(overallAvg)})` : "N/A"}</strong>
        </div>
      </div>

      {!userId ? (
        <div style={{ color: "#666", marginBottom: 12 }}>
          Sign in to add or manage your drink reviews. The login form is in the header.
        </div>
      ) : null}

      <DrinkReviewForm
        drinkName={drinkName}
        setDrinkName={setDrinkName}
        drinkType={drinkType}
        setDrinkType={setDrinkType}
        rating={rating}
        setRating={setRating}
        text={text}
        setText={setText}
        saving={saving}
        handleSubmit={handleSubmit}
        userId={userId}
        error={error}
      />

      <div>
        {loading ? (
          <div>Loading drink reviews…</div>
        ) : reviews.length === 0 ? (
          <div style={{ color: "#666" }}>No drink reviews yet. Be the first to add one.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {grouped.map((g) => (
              <div
                key={`${g.drink_name}|${g.drink_type ?? ""}`}
                style={{
                  padding: 12,
                  background: "#ffffff",
                  borderRadius: 8,
                  border: "1px solid #eee",
                  boxShadow: "0 1px 0 rgba(0,0,0,0.02)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div style={{ fontWeight: 700 }}>
                    {g.drink_name} {g.drink_type ? `· ${g.drink_type}` : null}
                    <div style={{ fontSize: 13, color: "#555", fontWeight: 600, marginTop: 6 }}>
                      {g.count} review{g.count > 1 ? "s" : ""} • Avg: {g.avgScore.toFixed(2)} ({g.avgLabel})
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center", whiteSpace: "nowrap" }}>
                    <div style={{ fontWeight: 700, textTransform: "capitalize" }}>{g.avgLabel}</div>
                  </div>
                </div>

                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  {g.reviews.map((r) => (
                    <div
                      key={r.id}
                      style={{
                        padding: 10,
                        background: "#fafafa",
                        borderRadius: 6,
                        border: "1px solid #f0f0f0",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      {editingId === r.id ? (
                        <EditDrinkReviewForm
                          editDrinkName={editDrinkName}
                          setEditDrinkName={setEditDrinkName}
                          editDrinkType={editDrinkType}
                          setEditDrinkType={setEditDrinkType}
                          editRating={editRating}
                          setEditRating={setEditRating}
                          editText={editText}
                          setEditText={setEditText}
                          saving={saving}
                          submitEdit={submitEdit}
                          cancelEdit={cancelEdit}
                        />
                      ) : (
                        <>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontWeight: 700 }}>
                              {r.drink_name} {r.drink_type ? `· ${r.drink_type}` : null}
                              <div style={{ fontSize: 13, color: "#666", fontWeight: 600, marginTop: 4 }}>
                                {r.rating.charAt(0).toUpperCase() + r.rating.slice(1)}
                              </div>
                            </div>

                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 12, color: "#666" }}>
                                {r.user_id === userId ? "You" : `${r.user_id.substring(0, 6)}...`}
                              </div>
                              <div style={{ fontSize: 12, color: "#666" }}>
                                {r.created_at ? new Date(r.created_at).toLocaleString() : "unknown"}
                              </div>
                            </div>
                          </div>

                          {r.review_text ? <div style={{ marginTop: 6 }}>{r.review_text}</div> : null}

                          {r.user_id === userId ? (
                            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                              <button
                                onClick={() => startEdit(r)}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: 6,
                                  border: "1px solid #d1d5db",
                                  background: "#fff",
                                  color: "#111827",
                                  fontWeight: 600,
                                }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => deleteReview(r.id)}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: 6,
                                  border: "1px solid #fee2e2",
                                  background: "#fff",
                                  color: "#b91c1c",
                                  fontWeight: 600,
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}