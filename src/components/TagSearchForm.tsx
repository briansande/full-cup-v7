'use client';
import React from 'react';
import { SuggestResult } from '@/src/types';

interface TagSearchFormProps {
  search: string;
  setSearch: (value: string) => void;
  searching: boolean;
  searchResults: SuggestResult[];
  handleAddExistingTag: (tagId: string) => void;
  handleSuggestTag: (name: string) => void;
  submitting: boolean;
  error: string | null;
}

export default function TagSearchForm({
  search,
  setSearch,
  searching,
  searchResults,
  handleAddExistingTag,
  handleSuggestTag,
  submitting,
  error
}: TagSearchFormProps) {
  // Render the tag search form
  return (
    <div style={{ marginBottom: 12 }}>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search or suggest a tag (e.g. 'Pet friendly')"
        style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db', width: '100%' }}
      />
      {searching ? <div style={{ fontSize: 13, color: '#666' }}>Searching…</div> : null}
      {searchResults.length > 0 ? (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {searchResults.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => handleAddExistingTag(r.id)}
              disabled={submitting}
              style={{
                textAlign: 'left',
                padding: '6px 8px',
                borderRadius: 6,
                border: '1px solid #e5e7eb',
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              {r.name}
            </button>
          ))}
        </div>
      ) : null}
      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={() => handleSuggestTag(search)}
          disabled={submitting}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid #111827',
            background: '#111827',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          {submitting ? 'Submitting…' : 'Suggest new tag'}
        </button>
      </div>
      {error ? <div style={{ marginTop: 8, color: 'red' }}>{error}</div> : null}
    </div>
  );
}