'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/src/lib/supabase';

type Props = {
  selectedTags: string[];
  setSelectedTags: (v: string[] | null) => void;
  placeholder?: string;
};

/**
 * TagSelector
 * - Searchable tag selector used by FilterControls and NewShops
 * - Allows multiple selection. Calls setSelectedTags with an array (or null to clear)
 * - Minimal, accessible UI: input + suggestion list + selected tag pills
 *
 * Notes:
 * - Uses simple ilike search on tag name; limits results to 12.
 * - Normalizes tag ids to strings.
 */
export default function TagSelector({ selectedTags, setSelectedTags, placeholder = 'Filter by tags…' }: Props) {
  const [query, setQuery] = useState<string>('');
  const [searching, setSearching] = useState<boolean>(false);
  const [results, setResults] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load tag details for selectedTags so we can render names
  const [selectedTagDetails, setSelectedTagDetails] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;
    async function fetchSelected() {
      if (!selectedTags || selectedTags.length === 0) {
        if (mounted) setSelectedTagDetails({});
        return;
      }
      try {
        const res = await supabase.from('tags').select('id,name').in('id', selectedTags).limit(50);
        if (!mounted) return;
        if (!res.error && Array.isArray(res.data)) {
          const map: Record<string, string> = {};
          for (const row of res.data) {
            map[String((row as any).id)] = (row as any).name;
          }
          setSelectedTagDetails(map);
        } else {
          setSelectedTagDetails({});
        }
      } catch {
        if (!mounted) return;
        setSelectedTagDetails({});
      }
    }
    fetchSelected();
    return () => { mounted = false; };
  }, [selectedTags]);

  useEffect(() => {
    let mounted = true;
    if (!query || query.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    (async () => {
      try {
        const q = `%${query}%`;
        const res = await supabase
          .from('tags')
          .select('id,name')
          .ilike('name', q)
          .order('name', { ascending: true })
          .limit(12);

        if (!mounted) return;
        if (!res.error && Array.isArray(res.data)) {
          setResults(res.data.map((r: any) => ({ id: String(r.id), name: r.name })));
        } else {
          setResults([]);
        }
      } catch (err) {
        if (!mounted) return;
        setResults([]);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!mounted) return;
        setSearching(false);
      }
    })();
    return () => { mounted = false; };
  }, [query]);

  function addTag(tagId: string, tagName?: string) {
    const id = String(tagId);
    const next = Array.from(new Set([...(selectedTags || []), id]));
    setSelectedTags(next);
    if (tagName) {
      setSelectedTagDetails((prev) => ({ ...prev, [id]: tagName }));
    }
    setQuery('');
    setResults([]);
  }

  function removeTag(tagId: string) {
    const next = (selectedTags || []).filter((t) => String(t) !== String(tagId));
    setSelectedTags(next.length > 0 ? next : []);
  }

  function clearAll() {
    setSelectedTags(null);
    setSelectedTagDetails({});
  }

  return (
    <div className="min-w-[240px] max-w-[420px]">
      <div className="flex gap-2 items-center flex-wrap">
        {/* Selected tags as pills */}
        <div className="flex gap-2 flex-wrap items-center flex-1">
          {(selectedTags || []).map((tid) => (
            <div key={tid} className="cottage-tag inline-flex gap-2 items-center">
              <div className="font-medium">{selectedTagDetails[tid] ?? tid}</div>
              <button
                aria-label={`Remove tag ${selectedTagDetails[tid] ?? tid}`}
                onClick={() => removeTag(tid)}
                className="bg-none border-none cursor-pointer text-[--cottage-neutral-dark] hover:text-red-500"
                type="button"
              >
                ×
              </button>
            </div>
          ))}

          <input
            aria-label="Search tags"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="cottage-input py-2 flex-1 min-w-[160px]"
          />
        </div>

        <div className="flex gap-2 items-center">
          <button
            onClick={clearAll}
            type="button"
            className="cottage-button px-3 py-2 hover:bg-[--cottage-secondary]/50"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="mt-2">
        {searching ? <div className="text-sm text-[--cottage-neutral-dark]/70 flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-[--cottage-primary] border-t-transparent rounded-full animate-spin"></div>
          Searching…
        </div> : null}
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
        {results && results.length > 0 ? (
          <div className="mt-2 flex flex-col gap-1.5">
            {results.map((r) => {
              const already = (selectedTags || []).some((t) => String(t) === String(r.id));
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => addTag(r.id, r.name)}
                  disabled={already}
                  className={`text-left px-2 py-1.5 rounded-lg border ${
                    already 
                      ? 'bg-[--cottage-secondary] border-[--cottage-accent]' 
                      : 'bg-white border-[--cottage-neutral-light]'
                  } ${already ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-[--cottage-secondary]/50'}`}
                >
                  {r.name} {already ? '✓' : ''}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}