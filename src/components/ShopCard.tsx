import React, { memo } from 'react';
import Link from 'next/link';
import { Shop } from '@/src/types';

type Props = {
  shop: Shop;
};

function ShopCard({ shop }: Props) {
  const photoUrl = shop.main_photo_url && shop.main_photo_url !== "" ? shop.main_photo_url : "/file.svg";
  
  return (
    <div style={{ border: '1px solid #e6e6e6', padding: 12, borderRadius: 8, display: 'flex', gap: 12 }}>
      <div style={{ minWidth: 120, maxWidth: 160, flex: '0 0 160px' }}>
        <img
          src={photoUrl}
          alt={shop.name ?? 'Coffee shop'}
          style={{ width: '100%', height: 96, objectFit: 'cover', borderRadius: 6, background: '#f3f3f3' }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/file.svg'; }}
        />
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 600 }}>{shop.name ?? 'Unnamed shop'}</div>
            <div style={{ color: '#555', marginTop: 6 }}>
              {shop.formatted_address ?? shop.address ?? 'Address not available'}
            </div>
          </div>
          <div style={{ textAlign: 'right', color: '#666', fontSize: 13 }}>
            {shop.date_added ? new Date(shop.date_added).toLocaleString() : 'Date unknown'}
          </div>
        </div>

        <div style={{ marginTop: 10, display: 'flex', gap: 12, alignItems: 'center' }}>
          {shop.google_rating != null ? (
            <div style={{ color: '#333' }}>Rating: <strong>{shop.google_rating} ★</strong></div>
          ) : null}

          {shop.opening_hours ? (
            <div style={{ color: '#333' }}>
              Hours:{" "}
              {Array.isArray(shop.opening_hours?.weekdayDescriptions) ? (
                <span style={{ fontSize: 13 }}>
                  {shop.opening_hours.weekdayDescriptions[0] ?? 'View details'}
                </span>
              ) : (
                <span style={{ fontSize: 13 }}>See details</span>
              )}
            </div>
          ) : null}
        </div>

        <div style={{ marginTop: 12 }}>
          <Link href={`/shop/${shop.id}`}>View details</Link>
        </div>
      </div>
    </div>
  );
}

export default memo(ShopCard, (prevProps, nextProps) => {
  // Custom comparison function for memoization
  return (
    prevProps.shop.id === nextProps.shop.id &&
    prevProps.shop.name === nextProps.shop.name &&
    prevProps.shop.address === nextProps.shop.address &&
    prevProps.shop.formatted_address === nextProps.shop.formatted_address &&
    prevProps.shop.google_rating === nextProps.shop.google_rating &&
    prevProps.shop.date_added === nextProps.shop.date_added &&
    prevProps.shop.main_photo_url === nextProps.shop.main_photo_url
  );
});