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
      <div className="flex justify-between items-center">
        <div className="font-semibold">
          {review.drink_name} {review.drink_type ? `· ${review.drink_type}` : null}
          <div className="text-xs text-gray-600 font-medium mt-1">
            {review.rating.charAt(0).toUpperCase() + review.rating.slice(1)}
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs text-gray-600">
            {userId && review.user_id === userId ? "You" : `${review.user_id.substring(0, 6)}...`}
          </div>
          <div className="text-xs text-gray-600">
            {review.created_at ? new Date(review.created_at).toLocaleString() : "unknown"}
          </div>
        </div>
      </div>

      {review.review_text ? <div className="mt-1.5">{review.review_text}</div> : null}

      {userId && review.user_id === userId && (onStartEdit || onDelete) ? (
        <div className="flex gap-2 mt-2">
          {onStartEdit && (
            <button
              onClick={() => onStartEdit(review)}
              className="px-2.5 py-1.5 rounded-md border border-gray-300 bg-white text-gray-900 font-medium"
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(review.id)}
              className="px-2.5 py-1.5 rounded-md border border-red-200 bg-white text-red-600 font-medium"
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