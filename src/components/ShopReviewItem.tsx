import React, { memo } from 'react';
import { ShopReview } from '@/src/types';

type Props = {
  review: ShopReview;
  userId: string | null;
  onEdit?: (review: ShopReview) => void;
  onDelete?: (id: string) => void;
};

function ShopReviewItem({ review, userId, onEdit, onDelete }: Props) {
  return (
    <div style={{ padding: 12, background: "#fafafa", borderRadius: 8, border: "1px solid #eee" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 700 }}>{review.user_id === userId ? "You" : `${review.user_id.substring(0, 6)}...`}</div>
        <div style={{ fontWeight: 700 }}>{review.rating != null ? `${review.rating} ★` : (review.coffee_quality_rating != null ? `${review.coffee_quality_rating} ★` : "")}</div>
      </div>
      {review.review_text ? <div style={{ marginTop: 8 }}>{review.review_text}</div> : null}

      <div style={{ marginTop: 8, color: "#444", fontSize: 13 }}>
        {review.coffee_quality_rating != null ? <div>Coffee: <strong>{review.coffee_quality_rating} ★</strong></div> : null}
        {review.atmosphere_rating != null ? <div>Atmosphere: <strong>{review.atmosphere_rating} ★</strong></div> : null}
        {review.noise_level_rating != null ? <div>Noise level: <strong>{review.noise_level_rating}</strong></div> : null}
        {review.wifi_quality_rating != null ? <div>WiFi: <strong>{review.wifi_quality_rating} ★</strong></div> : null}
        {review.work_friendliness_rating != null ? <div>Work friendly: <strong>{review.work_friendliness_rating} ★</strong></div> : null}
        {review.service_rating != null ? <div>Service: <strong>{review.service_rating} ★</strong></div> : null}
      </div>

      {review.created_at ? (
        <div style={{ marginTop: 8, color: "#666", fontSize: 12 }}>
          {new Date(review.created_at).toLocaleString()}
        </div>
      ) : null}
      
      {review.user_id === userId && (onEdit || onDelete) ? (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          {onEdit && (
            <button
              onClick={() => onEdit(review)}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                background: "#fff",
                color: "#111827",
                fontWeight: 600,
              }}
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(review.id)}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid #fee2e2",
                background: "#fff",
                color: "#b91c1c",
                fontWeight: 600,
              }}
            >
              Delete
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default memo(ShopReviewItem, (prevProps, nextProps) => {
  // Custom comparison function for memoization
  return (
    prevProps.review.id === nextProps.review.id &&
    prevProps.review.rating === nextProps.review.rating &&
    prevProps.review.review_text === nextProps.review.review_text &&
    prevProps.review.coffee_quality_rating === nextProps.review.coffee_quality_rating &&
    prevProps.review.atmosphere_rating === nextProps.review.atmosphere_rating &&
    prevProps.review.noise_level_rating === nextProps.review.noise_level_rating &&
    prevProps.review.wifi_quality_rating === nextProps.review.wifi_quality_rating &&
    prevProps.review.work_friendliness_rating === nextProps.review.work_friendliness_rating &&
    prevProps.review.service_rating === nextProps.review.service_rating &&
    prevProps.review.created_at === nextProps.review.created_at &&
    prevProps.userId === nextProps.userId &&
    prevProps.onEdit === nextProps.onEdit &&
    prevProps.onDelete === nextProps.onDelete
  );
});