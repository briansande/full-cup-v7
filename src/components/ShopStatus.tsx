'use client';
import React, { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";

type Props = {
  shopId: string;
};

const STATUS_LABELS: Record<string, string> = {
  want_to_try: "Want to Try",
  visited: "Visited",
  favorite: "Favorite",
};

export default function ShopStatus({ shopId }: Props) {
  const [user, setUser] = useState<any | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      setLoading(true);
      setError(null);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const u = sessionData?.session?.user ?? null;
        if (!mounted) return;
        setUser(u);

        if (u) {
          const res = await supabase
            .from("user_shop_status")
            .select("status")
            .eq("user_id", u.id)
            .eq("shop_id", shopId)
            .limit(1)
            .single();
          if (!mounted) return;
          if (!res.error && res.data) {
            setStatus((res.data as any).status ?? null);
          } else {
            setStatus(null);
          }
        } else {
          setStatus(null);
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

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      // Re-fetch status when auth changes
      (async () => {
        if (!u) {
          setStatus(null);
          return;
        }
        try {
          const res = await supabase
            .from("user_shop_status")
            .select("status")
            .eq("user_id", u.id)
            .eq("shop_id", shopId)
            .limit(1)
            .single();
          if (!res.error && res.data) {
            setStatus((res.data as any).status ?? null);
          } else {
            setStatus(null);
          }
        } catch {
          setStatus(null);
        }
      })();
    });

    return () => {
      mounted = false;
      subscription?.subscription?.unsubscribe?.();
    };
  }, [shopId]);

  async function handleSetStatus(newStatus: string) {
    if (!user) {
      setError("Sign in to set a status.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Toggle off if clicking the same status
      if (status === newStatus) {
        const del = await supabase
          .from("user_shop_status")
          .delete()
          .eq("user_id", user.id)
          .eq("shop_id", shopId);
        if (del.error) throw del.error;
        setStatus(null);
      } else {
        const up = await supabase
          .from("user_shop_status")
          .upsert(
            {
              user_id: user.id,
              shop_id: shopId,
              status: newStatus,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,shop_id" }
          );
        if (up.error) throw up.error;
        setStatus(newStatus);
      }

      // Notify other parts (map) to refresh shop statuses
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

  if (loading) return <div>Loading status...</div>;

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ marginBottom: 8, fontWeight: 600 }}>Your relationship</div>
      {!user ? (
        <div style={{ color: "#666" }}>
          Sign in to mark this shop. The login form is in the header.
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {Object.keys(STATUS_LABELS).map((key) => {
            const selected = status === key;
            const bg = selected ? (key === "favorite" ? "#ef4444" : key === "visited" ? "#10b981" : "#3b82f6") : "#fff";
            const color = selected ? "#fff" : "#111827";
            return (
              <button
                key={key}
                onClick={() => handleSetStatus(key)}
                disabled={saving}
                style={{
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  background: bg,
                  color,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {STATUS_LABELS[key]}
              </button>
            );
          })}
          {saving ? <div style={{ marginLeft: 8 }}>Saving…</div> : null}
        </div>
      )}
      {error ? <div style={{ marginTop: 8, color: "red" }}>{error}</div> : null}
    </div>
  );
}