'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/src/lib/supabase';
import Link from 'next/link';

type Shop = {
  id: string;
  name: string | null;
  address?: string | null;
  formatted_address?: string | null;
  google_rating?: number | null;
  opening_hours?: any;
  date_added?: string | null;
};

const FILTER_OPTIONS = [
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
  { label: '60 days', days: 60 },
];

export default function NewShops() {
  const [days, setDays] = useState<number>(7);
  const [shops, setShops] = useState<Shop[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchShops() {
      setLoading(true);
      setError(null);
      try {
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        const res = await supabase
          .from('coffee_shops')
          .select('id,name,address,formatted_address,google_rating,opening_hours,date_added')
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
  }, [days]);

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h1 style={{ margin: '0 0 12px 0' }}>Recently added coffee shops</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.days}
            onClick={() => setDays(opt.days)}
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              border: days === opt.days ? '2px solid #111' : '1px solid #ddd',
              background: days === opt.days ? '#f0f0f0' : '#fff',
              cursor: 'pointer',
            }}
            aria-pressed={days === opt.days}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: 12, color: '#666' }}>
        Showing shops added in the last {days} days — sorted newest first.
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : error ? (
        <div style={{ color: 'red' }}>Error: {error}</div>
      ) : shops && shops.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
          {shops.map((s) => (
            <div key={s.id} style={{ border: '1px solid #e6e6e6', padding: 12, borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{s.name ?? 'Unnamed shop'}</div>
                  <div style={{ color: '#555', marginTop: 6 }}>
                    {s.formatted_address ?? s.address ?? 'Address not available'}
                  </div>
                </div>
                <div style={{ textAlign: 'right', color: '#666', fontSize: 13 }}>
                  {s.date_added ? new Date(s.date_added).toLocaleString() : 'Date unknown'}
                </div>
              </div>

              <div style={{ marginTop: 10, display: 'flex', gap: 12, alignItems: 'center' }}>
                {s.google_rating != null ? (
                  <div style={{ color: '#333' }}>Rating: <strong>{s.google_rating} ★</strong></div>
                ) : null}

                {s.opening_hours ? (
                  <div style={{ color: '#333' }}>
                    Hours:{" "}
                    {Array.isArray(s.opening_hours?.weekdayDescriptions) ? (
                      <span style={{ fontSize: 13 }}>
                        {s.opening_hours.weekdayDescriptions[0] ?? 'View details'}
                      </span>
                    ) : (
                      <span style={{ fontSize: 13 }}>See details</span>
                    )}
                  </div>
                ) : null}
              </div>

              <div style={{ marginTop: 12 }}>
                <Link href={`/shop/${s.id}`}>View details</Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>No new shops found for the selected time range.</div>
      )}
    </div>
  );
}