import React from 'react';
import Link from 'next/link';
import { supabase } from '@/src/lib/supabase';
import ShopStatus from '@/src/components/ShopStatus';
import ShopReviews from '@/src/components/ShopReviews';
import DrinkReviews from '@/src/components/DrinkReviews';

type Props = { params: { id: string } };

export default async function Page({ params }: Props) {
  const { id } = await params as unknown as { id: string };

  try {
    const res = await supabase
      .from('coffee_shops')
      .select('id,name,address,formatted_address,phone,google_rating,opening_hours,website')
      .eq('id', id)
      .single();

    if (res.error || !res.data) {
      return (
        <div style={{ padding: 24 }}>
          <div>Shop not found.</div>
          <div style={{ marginTop: 12 }}>
            <Link href="/">Back to Map</Link>
          </div>
        </div>
      );
    }

    const shop = res.data as any;

    // Fetch drink review count for this shop (simple server-side count)
    let drinkReviewCount = 0;
    try {
      const countRes = await supabase
        .from('drink_reviews')
        .select('id', { count: 'exact', head: true })
        .eq('shop_id', id);
      if (!countRes.error) {
        drinkReviewCount = countRes.count ?? 0;
      }
    } catch {
      // ignore any failures fetching count
    }

    // Build a friendly hours display when possible
    let hoursElement: React.ReactNode = null;
    if (shop.opening_hours) {
      const oh = shop.opening_hours;
      if (Array.isArray(oh.weekdayDescriptions)) {
        hoursElement = (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {oh.weekdayDescriptions.map((d: string, i: number) => (
              <li key={i} style={{ marginBottom: 4 }}>{d}</li>
            ))}
          </ul>
        );
      } else if (Array.isArray(oh.periods)) {
        const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
        const grouped: Record<number, string[]> = {};
        for (const p of oh.periods) {
          const open = p.open ?? {};
          const close = p.close ?? {};
          const day = typeof open.day === 'number' ? open.day : typeof close.day === 'number' ? close.day : null;
          if (day === null) continue;
          const openTime = `${String(open.hour ?? 0).padStart(2,'0')}:${String(open.minute ?? 0).padStart(2,'0')}`;
          const closeTime = `${String(close.hour ?? 0).padStart(2,'0')}:${String(close.minute ?? 0).padStart(2,'0')}`;
          const s = `${openTime}–${closeTime}`;
          grouped[day] = grouped[day] || [];
          if (!grouped[day].includes(s)) grouped[day].push(s);
        }
        hoursElement = (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {Object.keys(grouped)
              .map(Number)
              .sort((a, b) => a - b)
              .map((d) => (
                <li key={d} style={{ marginBottom: 4 }}>
                  {days[d]}: {grouped[d].join(', ')}
                </li>
              ))}
          </ul>
        );
      } else {
        hoursElement = (
          <pre style={{ background: '#f7f7f7', padding: 12, borderRadius: 6 }}>
            {JSON.stringify(shop.opening_hours, null, 2)}
          </pre>
        );
      }
    }

    return (
      <div style={{ padding: 24, maxWidth: 800 }}>
        <div style={{ marginBottom: 12 }}>
          <Link href="/">← Back to Map</Link>
        </div>

        <h1 style={{ margin: 0 }}>{shop.name}</h1>
        <div style={{ color: '#555', marginTop: 8 }}>
          {shop.formatted_address ?? shop.address ?? 'Address not available'}
        </div>

        <div style={{ marginTop: 12 }}>
          {shop.google_rating != null ? (
            <div>
              Google rating: <strong>{shop.google_rating} ★</strong>
            </div>
          ) : null}
          {shop.phone ? (
            <div>
              Phone: <a href={`tel:${shop.phone}`}>{shop.phone}</a>
            </div>
          ) : null}
          {shop.website ? (
            <div>
              Website:{' '}
              <a href={shop.website} target="_blank" rel="noopener noreferrer">
                {shop.website}
              </a>
            </div>
          ) : null}
        </div>

        {hoursElement ? (
          <div style={{ marginTop: 12 }}>
            <h3 style={{ margin: '8px 0' }}>Hours</h3>
            {hoursElement}
          </div>
        ) : null}

        {/* Client component to let the authenticated user set their status for this shop */}
        <div style={{ marginTop: 18 }}>
          <ShopStatus shopId={String(shop.id)} />
        </div>

        {/* Simple reviews (rating + optional text) */}
        <div style={{ marginTop: 18 }}>
          <ShopReviews shopId={String(shop.id)} />
        </div>

        {/* Drink reviews (separate from shop reviews) */}
        <div style={{ marginTop: 18 }}>
          <DrinkReviews shopId={String(shop.id)} />
        </div>
      </div>
    );
  } catch (err) {
    return (
      <div style={{ padding: 24 }}>
        <div>Error loading shop details.</div>
        <div style={{ marginTop: 12 }}>
          <Link href="/">Back to Map</Link>
        </div>
      </div>
    );
  }
}