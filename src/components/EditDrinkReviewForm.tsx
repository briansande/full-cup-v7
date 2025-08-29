'use client';
import React from 'react';

interface EditDrinkReviewFormProps {
  editDrinkName: string;
  setEditDrinkName: (value: string) => void;
  editDrinkType: string;
  setEditDrinkType: (value: string) => void;
  editRating: string;
  setEditRating: (value: string) => void;
  editText: string;
  setEditText: (value: string) => void;
  saving: boolean;
  submitEdit: () => void;
  cancelEdit: () => void;
}

export default function EditDrinkReviewForm({
  editDrinkName,
  setEditDrinkName,
  editDrinkType,
  setEditDrinkType,
  editRating,
  setEditRating,
  editText,
  setEditText,
  saving,
  submitEdit,
  cancelEdit
}: EditDrinkReviewFormProps) {
  // Render the edit drink review form
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <input
        value={editDrinkName}
        onChange={(e) => setEditDrinkName(e.target.value)}
        placeholder="Drink name"
        style={{ padding: 8, borderRadius: 6, border: "1px solid #d1d5db" }}
      />
      <input
        value={editDrinkType}
        onChange={(e) => setEditDrinkType(e.target.value)}
        placeholder="Drink type (optional)"
        style={{ padding: 8, borderRadius: 6, border: "1px solid #d1d5db" }}
      />
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        {[
          { key: "pass", label: "Pass" },
          { key: "good", label: "Good" },
          { key: "awesome", label: "Awesome" },
        ].map((opt) => {
          const selected = opt.key === editRating;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => setEditRating(opt.key)}
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
      <textarea
        value={editText}
        onChange={(e) => setEditText(e.target.value)}
        rows={3}
        style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #d1d5db" }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => submitEdit()}
          disabled={saving}
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #111827",
            background: "#111827",
            color: "#fff",
            fontWeight: 700,
          }}
        >
          Save
        </button>
        <button
          onClick={() => cancelEdit()}
          disabled={saving}
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            background: "#fff",
            color: "#111827",
            fontWeight: 600,
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}