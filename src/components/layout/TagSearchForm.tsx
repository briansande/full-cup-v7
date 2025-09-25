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
    <div className="mb-3">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search or suggest a tag (e.g. 'Pet friendly')"
        className="p-2 rounded-md border border-gray-300 w-full"
      />
      {searching ? <div className="text-sm text-gray-600">Searching…</div> : null}
      {searchResults.length > 0 ? (
        <div className="mt-2 flex flex-col gap-1.5">
          {searchResults.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => handleAddExistingTag(r.id)}
              disabled={submitting}
              className="text-left p-1.5 rounded-md border border-gray-200 bg-white cursor-pointer"
            >
              {r.name}
            </button>
          ))}
        </div>
      ) : null}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => handleSuggestTag(search)}
          disabled={submitting}
          className="px-3 py-2 rounded-md border border-gray-900 bg-gray-900 text-white cursor-pointer"
        >
          {submitting ? 'Submitting…' : 'Suggest new tag'}
        </button>
      </div>
      {error ? <div className="mt-2 text-red-600">{error}</div> : null}
    </div>
  );
}