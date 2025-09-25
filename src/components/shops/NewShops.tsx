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
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="m-0 mb-3">Recently added coffee shops</h1>

      <div className="flex gap-2 mb-4">
        {DATE_FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.days}
            onClick={() => setDateDays(opt.days)}
            className={`px-2 py-2 rounded-md cursor-pointer ${
              dateDays === opt.days 
                ? 'border-2 border-gray-900 bg-gray-100' 
                : 'border border-gray-300 bg-white'
            }`}
            aria-pressed={dateDays === opt.days}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {filterError ? <div className="text-red-600 mb-2">Filter error: {filterError}</div> : null}

      <div className="mb-3 text-gray-600">
        Showing shops added in the last {dateDays} days — sorted newest first.
        {selectedTags && selectedTags.length > 0 ? ` — filtered by ${selectedTags.length} tag${selectedTags.length>1 ? 's':''}` : ''}
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : error ? (
        <div className="text-red-600">Error: {error}</div>
      ) : shops && shops.length > 0 ? (
        filteredShops.length === 0 ? (
          <div>No new shops found for the selected time range and tag filters.</div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
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