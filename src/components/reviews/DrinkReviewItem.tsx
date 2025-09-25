import React, { memo } from 'react';
import { DrinkReview } from '@/src/types';

type Props = {
  review: DrinkReview;
  userId: string | null;
  onStartEdit?: (review: DrinkReview) => void;
  onDelete?: (id: string) => void;
};

function DrinkReviewItem({ review, userId, onStartEdit, onDelete }: Props) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 700 }}>
          {review.drink_name} {review.drink_type ? `· ${review.drink_type}` : null}
          <div style={{ fontSize: 13, color: "#666", fontWeight: 600, marginTop: 4 }}>
            {review.rating.charAt(0).toUpperCase() + review.rating.slice(1)}
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, color: "#666" }}>
            {userId && review.user_id === userId ? "You" : `${review.user_id.substring(0, 6)}...`}
          </div>
          <div style={{ fontSize: 12, color: "#666" }}>
            {review.created_at ? new Date(review.created_at).toLocaleString() : "unknown"}
          </div>
        </div>
      </div>

      {review.review_text ? <div style={{ marginTop: 6 }}>{review.review_text}</div> : null}

      {userId && review.user_id === userId && (onStartEdit || onDelete) ? (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          {onStartEdit && (
            <button
              onClick={() => onStartEdit(review)}
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
    </>
  );
}

export default memo(DrinkReviewItem, (prevProps, nextProps) => {
  // Custom comparison function for memoization
  return (
    prevProps.review.id === nextProps.review.id &&
    prevProps.review.drink_name === nextProps.review.drink_name &&
    prevProps.review.drink_type === nextProps.review.drink_type &&
    prevProps.review.rating === nextProps.review.rating &&
    prevProps.review.review_text === nextProps.review.review_text &&
    prevProps.review.created_at === nextProps.review.created_at &&
    prevProps.userId === nextProps.userId &&
    prevProps.onStartEdit === nextProps.onStartEdit &&
    prevProps.onDelete === nextProps.onDelete
  );
});