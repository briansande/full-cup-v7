import React from 'react';
import Link from 'next/link';
import { supabase } from '@/src/lib/supabase';
import ShopStatus from '@/src/components/ShopStatus';
import ShopReviews from '@/src/components/ShopReviews';
import DrinkReviews from '@/src/components/DrinkReviews';
import ShopTags from '@/src/components/ShopTags';

type Props = { params: { id: string } };

export default async function Page({ params }: Props) {
  const { id } = await params as unknown as { id: string };

  try {
    const res = await supabase
      .from('coffee_shops')
      .select('id,name,address,formatted_address,phone,google_rating,opening_hours,website,main_photo_url,photo_attribution,google_photo_reference')
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
    
    // Fetch reviews for this shop and compute averages (overall + per-criterion) in server-side code
    try {
      const revRes = await supabase
        .from('shop_reviews')
        .select('rating,coffee_quality_rating,atmosphere_rating,noise_level_rating,wifi_quality_rating,work_friendliness_rating,service_rating')
        .eq('shop_id', id)
        .limit(1000);
      if (!revRes.error && Array.isArray(revRes.data)) {
        const rows = revRes.data as any[];
        const agg = {
          sumRating: 0, countRating: 0,
          sumCoffee: 0, countCoffee: 0,
          sumAtmos: 0, countAtmos: 0,
          sumNoise: 0, countNoise: 0,
          sumWifi: 0, countWifi: 0,
          sumWork: 0, countWork: 0,
          sumService: 0, countService: 0,
        };
        for (const r of rows) {
          const ratingVal = r.rating;
          const ratingNum = ratingVal == null ? NaN : Number(ratingVal);
          if (!Number.isNaN(ratingNum)) { agg.sumRating += ratingNum; agg.countRating += 1; }

          if (r.coffee_quality_rating != null) { agg.sumCoffee += Number(r.coffee_quality_rating); agg.countCoffee += 1; }
          if (r.atmosphere_rating != null) { agg.sumAtmos += Number(r.atmosphere_rating); agg.countAtmos += 1; }
          if (r.noise_level_rating != null) { agg.sumNoise += Number(r.noise_level_rating); agg.countNoise += 1; }
          if (r.wifi_quality_rating != null) { agg.sumWifi += Number(r.wifi_quality_rating); agg.countWifi += 1; }
          if (r.work_friendliness_rating != null) { agg.sumWork += Number(r.work_friendliness_rating); agg.countWork += 1; }
          if (r.service_rating != null) { agg.sumService += Number(r.service_rating); agg.countService += 1; }
        }

        shop.avgRating = agg.countRating > 0 ? agg.sumRating / agg.countRating : null;
        shop.avgCoffeeQuality = agg.countCoffee > 0 ? agg.sumCoffee / agg.countCoffee : null;
        shop.avgAtmosphere = agg.countAtmos > 0 ? agg.sumAtmos / agg.countAtmos : null;
        shop.avgNoiseLevel = agg.countNoise > 0 ? agg.sumNoise / agg.countNoise : null;
        shop.avgWifiQuality = agg.countWifi > 0 ? agg.sumWifi / agg.countWifi : null;
        shop.avgWorkFriendliness = agg.countWork > 0 ? agg.sumWork / agg.countWork : null;
        shop.avgService = agg.countService > 0 ? agg.sumService / agg.countService : null;
      } else {
        shop.avgRating = null;
        shop.avgCoffeeQuality = null;
        shop.avgAtmosphere = null;
        shop.avgNoiseLevel = null;
        shop.avgWifiQuality = null;
        shop.avgWorkFriendliness = null;
        shop.avgService = null;
      }
    } catch {
      shop.avgRating = null;
      shop.avgCoffeeQuality = null;
      shop.avgAtmosphere = null;
      shop.avgNoiseLevel = null;
      shop.avgWifiQuality = null;
      shop.avgWorkFriendliness = null;
      shop.avgService = null;
    }

    // Prepare main photo URL (fallback to bundled placeholder) and parse attribution if available.
    const mainPhotoUrl = shop?.main_photo_url && shop.main_photo_url !== "" ? shop.main_photo_url : "/file.svg";
    let photoAttributionElement: React.ReactNode = null;
    if (shop?.photo_attribution) {
      try {
        const attrs = JSON.parse(String(shop.photo_attribution));
        if (Array.isArray(attrs) && attrs.length > 0) {
          const a = attrs[0];
          const name = a.displayName ?? a.name ?? null;
          const uri = a.uri ?? a.photoUri ?? null;
          if (uri && name) {
            photoAttributionElement = (
              <div style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
                Photo: <a href={uri} target="_blank" rel="noopener noreferrer">{name}</a>
              </div>
            );
          } else if (uri) {
            photoAttributionElement = (
              <div style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
                Photo: <a href={uri} target="_blank" rel="noopener noreferrer">{uri}</a>
              </div>
            );
          }
        }
      } catch {
        // ignore malformed attribution
      }
    }

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

        {/* Tagging: show popular tags and allow adding/voting */}
        <div style={{ marginTop: 18 }}>
          <ShopTags shopId={String(shop.id)} />
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