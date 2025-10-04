'use client';
import React, { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { User } from "@/src/types";

type Props = {
  shopId: string;
};

const STATUS_LABELS: Record<string, string> = {
  want_to_try: "Want to Try",
  visited: "Visited",
  favorite: "Favorite",
  potential: "Potential",
  not_interested: "Not Interested",
};

export default function ShopStatus({ shopId }: Props) {
  const [user, setUser] = useState<User | null>(null);
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
            setStatus((res.data as { status: string }).status ?? null);
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
            setStatus((res.data as { status: string }).status ?? null);
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
    <div className="mt-3">
      <div className="mb-2 font-semibold">Your relationship</div>
      {!user ? (
        <div className="text-gray-600">
          Sign in to mark this shop. The login form is in the header.
        </div>
      ) : (
        <div className="flex gap-2 items-center flex-wrap">
          {Object.keys(STATUS_LABELS).map((key) => {
            const selected = status === key;
            return (
              <button
                key={key}
                onClick={() => handleSetStatus(key)}
                disabled={saving}
                className={`px-2 py-2 rounded-md border cursor-pointer font-semibold ${
                  selected 
                    ? key === "favorite" 
                      ? 'bg-red-500 text-white border-red-500' 
                      : key === "visited" 
                        ? 'bg-green-600 text-white border-green-600' 
                        : key === "potential"
                          ? 'bg-green-700 text-white border-green-700'
                          : key === "not_interested"
                            ? 'bg-gray-500 text-white border-gray-500'
                            : 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-900 border-gray-300'
                }`}
              >
                {STATUS_LABELS[key]}
              </button>
            );
          })}
          {saving ? <div className="ml-2">Saving…</div> : null}
        </div>
      )}
      {error ? <div className="mt-2 text-red-600">{error}</div> : null}
    </div>
  );
}