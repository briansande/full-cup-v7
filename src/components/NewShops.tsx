'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/src/lib/supabase';
import useFilters from '@/src/hooks/useFilters';
import { Shop } from '@/src/types';
import ShopCard from './ShopCard';

export default function NewShops() {
  // Use shared filter hook (we only use the date filter here)
  const filters = useFilters({ initialDateDays: 7 });
  const { dateDays, setDateDays, DATE_FILTER_OPTIONS, filterError, selectedTags, setSelectedTags } = filters;

  const [shops, setShops] = useState<Shop[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchShops() {
      setLoading(true);
      setError(null);
      try {
        const cutoff = new Date(Date.now() - (dateDays ?? 0) * 24 * 60 * 60 * 1000).toISOString();

        const res = await supabase
          .from('coffee_shops')
          .select('id,name,address,formatted_address,google_rating,opening_hours,date_added,main_photo_url,photo_attribution')
          .gte('date_added', cutoff)
          .order('date_added', { ascending: false });

        if (!mounted) return;

        if (res.error) {
          setError(String(res.error.message ?? res.error));
          setShops([]);
        } else {
          setShops(Array.isArray(res.data) ? (res.data as Shop[]) : []);
        }
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : String(err));
        setShops([]);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }

    fetchShops();

    return () => {
      mounted = false;
    };
  }, [dateDays]);

  // Apply client-side tag filtering (AND logic) using shops' tagIds if present
  const filteredShops = useMemo(() => {
    if (!shops || shops.length === 0) return [];
    
    return shops.filter((s: Shop) => {
      if (selectedTags && selectedTags.length > 0) {
        const shopTagIds: string[] = Array.isArray(s.tagIds) ? s.tagIds.map(String) : [];
        return selectedTags.every((t) => shopTagIds.includes(String(t)));
      }
      return true;
    });
  }, [shops, selectedTags]);

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h1 style={{ margin: '0 0 12px 0' }}>Recently added coffee shops</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {DATE_FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.days}
            onClick={() => setDateDays(opt.days)}
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              border: dateDays === opt.days ? '2px solid #111' : '1px solid #ddd',
              background: dateDays === opt.days ? '#f0f0f0' : '#fff',
              cursor: 'pointer',
            }}
            aria-pressed={dateDays === opt.days}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {filterError ? <div style={{ color: 'red', marginBottom: 8 }}>Filter error: {filterError}</div> : null}

      <div style={{ marginBottom: 12, color: '#666' }}>
        Showing shops added in the last {dateDays} days — sorted newest first.
        {selectedTags && selectedTags.length > 0 ? ` — filtered by ${selectedTags.length} tag${selectedTags.length>1 ? 's':''}` : ''}
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : error ? (
        <div style={{ color: 'red' }}>Error: {error}</div>
      ) : shops && shops.length > 0 ? (
        filteredShops.length === 0 ? (
          <div>No new shops found for the selected time range and tag filters.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            {filteredShops.map((s) => (
              <ShopCard key={s.id} shop={s} />
            ))}
          </div>
        )
      ) : (
        <div>No new shops found for the selected time range.</div>
      )}
    </div>
  );
}