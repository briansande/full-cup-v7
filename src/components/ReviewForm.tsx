'use client';
import React from 'react';

interface ReviewFormProps {
  coffeeQuality: number;
  setCoffeeQuality: (value: number) => void;
  atmosphere: number | null;
  setAtmosphere: (value: number | null) => void;
  noiseLevel: number | null;
  setNoiseLevel: (value: number | null) => void;
  wifiQuality: number | "na" | null;
  setWifiQuality: (value: number | "na" | null) => void;
  workFriendliness: number | null;
  setWorkFriendliness: (value: number | null) => void;
  service: number | null;
  setService: (value: number | null) => void;
  text: string;
  setText: (value: string) => void;
  saving: boolean;
  handleSubmit: (e?: React.FormEvent) => void;
  userId: string | null;
  error: string | null;
}

export default function ReviewForm({
  coffeeQuality,
  setCoffeeQuality,
  atmosphere,
  setAtmosphere,
  noiseLevel,
  setNoiseLevel,
  wifiQuality,
  setWifiQuality,
  workFriendliness,
  setWorkFriendliness,
  service,
  setService,
  text,
  setText,
  saving,
  handleSubmit,
  userId,
  error
}: ReviewFormProps) {
  // Render the review form
  return (
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
  );
}