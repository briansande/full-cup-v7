import React, { memo } from 'react';
import Link from 'next/link';
import { Shop } from '@/src/types';

type Props = {
  shop: Shop;
};

function ShopCard({ shop }: Props) {
  const photoUrl = shop.main_photo_url && shop.main_photo_url !== "" ? shop.main_photo_url : "/file.svg";
  
  return (
    <div className="card-shop-layout">
      <div className="card-shop-image">
        <img
          src={photoUrl}
          alt={shop.name ?? 'Coffee shop'}
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/file.svg'; }}
        />
      </div>

      <div className="layout-content">
        <div className="layout-header-actions">
          <div className="layout-header">
            <div className="font-semibold">{shop.name ?? 'Unnamed shop'}</div>
            <div className="text-secondary mt-2">
              {shop.formatted_address ?? shop.address ?? 'Address not available'}
            </div>
          </div>
          <div className="text-muted text-sm">
            {shop.date_added ? new Date(shop.date_added).toLocaleString() : 'Date unknown'}
          </div>
        </div>

        <div className="layout-content-meta">
          <div className="layout-meta">
            {shop.google_rating != null ? (
              <div className="rating-display">
                <span className="rating-label">Rating:</span>
                <span className="rating-stars">{shop.google_rating} ★</span>
              </div>
            ) : null}

            {shop.opening_hours ? (
              <div className="rating-display">
                <span className="rating-label">Hours:</span>
                <span className="text-sm">
                  {Array.isArray(shop.opening_hours?.weekdayDescriptions) ? (
                    shop.opening_hours.weekdayDescriptions[0] ?? 'View details'
                  ) : (
                    'See details'
                  )}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="action-group-end">
          <Link href={`/shop/${shop.id}`} className="btn btn-ghost text-primary">
            View details
          </Link>
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