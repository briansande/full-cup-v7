"use client";

import React, { useState } from "react";

type Place = {
  name: string;
  formatted_address?: string;
  place_id?: string;
  rating?: number;
};

export default function TestPlacesButton() {
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  async function handleTest() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/test-places");
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      setPlaces(data.places ?? []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setPlaces(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncLoading(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      setSyncMessage(`Inserted ${data.inserted} shops`);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("fullcup:sync"));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setSyncMessage(`Error: ${message}`);
    } finally {
      setSyncLoading(false);
    }
  }

  return (
    <div className="mt-6 text-center">
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
        <button
          onClick={handleTest}
          className="px-5 py-2 rounded-full bg-[var(--coffee-brown)] text-[var(--cream)] font-semibold shadow-sm"
          disabled={loading}
        >
          {loading ? "Testing..." : "Test Google Places"}
        </button>

        <button
          onClick={handleSync}
          className="px-5 py-2 rounded-full border border-[rgba(59,47,47,0.12)] text-sm"
          disabled={syncLoading}
        >
          {syncLoading ? "Syncing..." : "Sync Google Places"}
        </button>
      </div>

      {syncMessage ? <div className="mt-3 text-sm">{syncMessage}</div> : null}
      {error ? (
        <div className="mt-3 text-sm text-red-600">Error: {error}</div>
      ) : null}

      {places && places.length > 0 ? (
        <ul className="mt-3 text-sm space-y-1">
          {places.map((p) => (
            <li key={p.place_id ?? p.name} className="text-left">
              <strong>{p.name}</strong>
              {p.formatted_address ? <span>: {p.formatted_address}</span> : null}
              {p.rating ? <span> — ★{p.rating}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}