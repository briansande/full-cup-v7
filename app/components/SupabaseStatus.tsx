'use client';

import React, { useEffect, useState } from "react";
import { testConnection } from "@/src/lib/supabase";

type Status = "idle" | "checking" | "connected" | "error";

export default function SupabaseStatus() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setStatus("checking");
    testConnection()
      .then((res) => {
        if (!mounted) return;
        if (res.ok) {
          setStatus("connected");
        } else {
          setStatus("error");
          setError(String(res.error));
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setStatus("error");
        setError(String(err));
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="mt-4 text-sm">
      Database:{" "}
      <span
        className={
          status === "connected"
            ? "text-green-600"
            : status === "checking"
            ? "text-yellow-600"
            : "text-red-600"
        }
      >
        {status === "checking"
          ? "Checking..."
          : status === "connected"
          ? "Connected"
          : status === "error"
          ? "Error"
          : "Idle"}
      </span>
      {error ? <div className="mt-2 text-xs text-red-500">Details: {error}</div> : null}
    </div>
  );
}