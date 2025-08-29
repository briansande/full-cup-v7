'use client';
import React from 'react';

interface DrinkReviewFormProps {
  drinkName: string;
  setDrinkName: (value: string) => void;
  drinkType: string;
  setDrinkType: (value: string) => void;
  rating: string;
  setRating: (value: string) => void;
  text: string;
  setText: (value: string) => void;
  saving: boolean;
  handleSubmit: (e?: React.FormEvent) => void;
  userId: string | null;
  error: string | null;
}

export default function DrinkReviewForm({
  drinkName,
  setDrinkName,
  drinkType,
  setDrinkType,
  rating,
  setRating,
  text,
  setText,
  saving,
  handleSubmit,
  userId,
  error
}: DrinkReviewFormProps) {
  // Render the drink review form
  return (
    <form onSubmit={(e) => handleSubmit(e)} style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 8, flexDirection: "column", marginBottom: 8 }}>
        <label style={{ fontWeight: 600 }}>Drink name</label>
        <input
          value={drinkName}
          onChange={(e) => setDrinkName(e.target.value)}
          placeholder="e.g., Caffe Latte"
          style={{
            width: "100%",
            padding: 8,
            borderRadius: 6,
            border: "1px solid #d1d5db",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
        <label style={{ fontWeight: 600, minWidth: 60 }}>Rating</label>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {[
            { key: "pass", label: "Pass" },
            { key: "good", label: "Good" },
            { key: "awesome", label: "Awesome" },
          ].map((opt) => {
            const selected = opt.key === rating;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setRating(opt.key)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: selected ? "1px solid #111827" : "1px solid #d1d5db",
                  background: selected ? "#111827" : "#fff",
                  color: selected ? "#fff" : "#111827",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Review (optional)</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 6,
            border: "1px solid #d1d5db",
            resize: "vertical",
          }}
          placeholder="Share a short thought about the drink..."
        />
      </div>

      <div style={{ marginBottom: 8 }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Drink type (optional)</label>
        <input
          value={drinkType}
          onChange={(e) => setDrinkType(e.target.value)}
          placeholder="e.g., espresso, pour over, cold brew"
          style={{
            width: "100%",
            padding: 8,
            borderRadius: 6,
            border: "1px solid #d1d5db",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
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
          {saving ? "Saving…" : "Add drink review"}
        </button>

        <button
          type="button"
          onClick={() => {
            setDrinkName("");
            setDrinkType("");
            setRating("good");
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