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
    <div className="card-review-item">
      <div className="layout-header-actions">
        <div className="layout-header">
          <div className="font-bold">{review.user_id === userId ? "You" : `${review.user_id.substring(0, 6)}...`}</div>
          {(review.rating != null || review.coffee_quality_rating != null) && (
            <div className="rating-display">
              <span className="rating-label">Rating:</span>
              <span className="rating-stars">
                {review.rating ?? review.coffee_quality_rating} ★
              </span>
            </div>
          )}
        </div>
      </div>

      {review.review_text && (
        <div className="mt-2">{review.review_text}</div>
      )}

      <div className="layout-content-meta">
        <div className="layout-meta">
          {review.coffee_quality_rating != null && (
            <div className="rating-display">
              <span className="rating-label">Coffee:</span>
              <span className="rating-stars">{review.coffee_quality_rating} ★</span>
            </div>
          )}
          {review.atmosphere_rating != null && (
            <div className="rating-display">
              <span className="rating-label">Atmosphere:</span>
              <span className="rating-stars">{review.atmosphere_rating} ★</span>
            </div>
          )}
          {review.noise_level_rating != null && (
            <div className="rating-display">
              <span className="rating-label">Noise level:</span>
              <span className="rating-stars">{review.noise_level_rating}</span>
            </div>
          )}
          {review.wifi_quality_rating != null && (
            <div className="rating-display">
              <span className="rating-label">WiFi:</span>
              <span className="rating-stars">{review.wifi_quality_rating} ★</span>
            </div>
          )}
          {review.work_friendliness_rating != null && (
            <div className="rating-display">
              <span className="rating-label">Work friendly:</span>
              <span className="rating-stars">{review.work_friendliness_rating} ★</span>
            </div>
          )}
          {review.service_rating != null && (
            <div className="rating-display">
              <span className="rating-label">Service:</span>
              <span className="rating-stars">{review.service_rating} ★</span>
            </div>
          )}
        </div>
      </div>

      {review.created_at && (
        <div className="text-muted text-xs mt-2">
          {new Date(review.created_at).toLocaleString()}
        </div>
      )}

      {review.user_id === userId && (onEdit || onDelete) && (
        <div className="action-group-end">
          {onEdit && (
            <button
              onClick={() => onEdit(review)}
              className="btn-action-edit"
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(review.id)}
              className="btn-action-delete"
            >
              Delete
            </button>
          )}
        </div>
      )}
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