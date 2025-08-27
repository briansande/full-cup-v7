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
    <div style={{ minWidth: 240, maxWidth: 420 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Selected tags as pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
          {(selectedTags || []).map((tid) => (
            <div key={tid} style={{ display: 'inline-flex', gap: 8, alignItems: 'center', padding: '6px 8px', borderRadius: 999, background: '#f3f4f6', fontSize: 13 }}>
              <div style={{ fontWeight: 600 }}>{selectedTagDetails[tid] ?? tid}</div>
              <button
                aria-label={`Remove tag ${selectedTagDetails[tid] ?? tid}`}
                onClick={() => removeTag(tid)}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
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
            style={{ padding: 8, borderRadius: 8, border: '1px solid #d1d5db', minWidth: 160, flex: '1 1 160px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            onClick={clearAll}
            type="button"
            style={{
              padding: '8px 10px',
              borderRadius: 6,
              border: '1px solid #d1d5db',
              background: '#fff',
              color: '#111827',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        {searching ? <div style={{ fontSize: 13, color: '#666' }}>Searching…</div> : null}
        {error ? <div style={{ fontSize: 13, color: 'red' }}>{error}</div> : null}
        {results && results.length > 0 ? (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {results.map((r) => {
              const already = (selectedTags || []).some((t) => String(t) === String(r.id));
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => addTag(r.id, r.name)}
                  disabled={already}
                  style={{
                    textAlign: 'left',
                    padding: '6px 8px',
                    borderRadius: 6,
                    border: '1px solid #e5e7eb',
                    background: already ? '#f9fafb' : '#fff',
                    cursor: already ? 'not-allowed' : 'pointer',
                  }}
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