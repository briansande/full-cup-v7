'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import useShops from '@/src/hooks/useShops';
import { supabase } from '@/src/lib/supabase';

export default function Page() {
  const { shops, loading, error } = useShops();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const shopList = shops ?? [];

  function pickRandom(excludeId?: string | null) {
    if (!shopList.length) return null;
    if (shopList.length === 1) return shopList[0].id;
    let tries = 0;
    while (tries < 10) {
      const idx = Math.floor(Math.random() * shopList.length);
      const id = shopList[idx].id;
      if (id !== excludeId) return id;
      tries++;
    }
    // fallback to any random
    return shopList[Math.floor(Math.random() * shopList.length)].id;
  }

  const handleGetRandom = () => {
    const id = pickRandom(null);
    setSelectedId(id);
  };

  const handleTryAnother = () => {
    const id = pickRandom(selectedId);
    setSelectedId(id);
  };

  useEffect(() => {
    let mounted = true;
    async function fetchDetail() {
      setDetail(null);
      setDetailError(null);
      if (!selectedId) return;
      setDetailLoading(true);
      try {
        const res = await supabase
          .from('coffee_shops')
          .select('id,name,address,formatted_address,phone,google_rating')
          .eq('id', selectedId)
          .single();
        if (!mounted) return;
        if (res.error || !res.data) {
          setDetailError(res.error ? String(res.error) : 'No details found');
          setDetail(null);
        } else {
          setDetail(res.data);
        }
      } catch (err) {
        if (!mounted) return;
        setDetailError(err instanceof Error ? err.message : String(err));
        setDetail(null);
      } finally {
        if (!mounted) return;
        setDetailLoading(false);
      }
    }
    fetchDetail();
    return () => {
      mounted = false;
    };
  }, [selectedId]);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 12 }}>
        <Link href="/">← Back to Map</Link>
      </div>

      <h1 style={{ marginTop: 0 }}>Random Shop</h1>

      {loading ? (
        <div>Loading shops…</div>
      ) : error ? (
        <div style={{ color: 'red' }}>Error loading shops: {error}</div>
      ) : !shopList.length ? (
        <div>No shops available.</div>
      ) : (
        <div>
          <div style={{ marginBottom: 12 }}>
            <button onClick={handleGetRandom} style={{ marginRight: 8 }}>
              Get Random Shop
            </button>
            <button onClick={handleTryAnother} disabled={!selectedId}>
              Try Another
            </button>
          </div>

          {selectedId == null ? (
            <div style={{ color: '#666' }}>Click "Get Random Shop" to see a selection.</div>
          ) : detailLoading ? (
            <div>Loading shop details…</div>
          ) : detailError ? (
            <div style={{ color: 'red' }}>Error loading details: {detailError}</div>
          ) : detail ? (
            <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 6, maxWidth: 720 }}>
              <h2 style={{ margin: '4px 0' }}>{detail.name ?? 'Unnamed shop'}</h2>
              <div style={{ color: '#555', marginBottom: 8 }}>
                {detail.formatted_address ?? detail.address ?? 'Address not available'}
              </div>
              <div style={{ marginBottom: 8 }}>
                {detail.google_rating != null ? (
                  <div>Google rating: <strong>{detail.google_rating} ★</strong></div>
                ) : null}
                {detail.phone ? (
                  <div>Phone: <a href={`tel:${detail.phone}`}>{detail.phone}</a></div>
                ) : null}
              </div>

              <div style={{ marginTop: 8 }}>
                <Link href={`/shop/${detail.id}`}>View full details</Link>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}