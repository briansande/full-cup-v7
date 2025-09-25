import React, { memo } from 'react';
import { TagSummary } from '@/src/types';

type Props = {
  tag: TagSummary;
  userId: string | null;
  onVote?: (tag: TagSummary) => void;
  submitting?: boolean;
};

function ShopTagItem({ tag, userId, onVote, submitting }: Props) {
  return (
    <div className="px-1.5 py-1.5 rounded-full bg-gray-100 flex gap-2 items-center">
      <div className="font-bold">{tag.tag_name}</div>
      <div className="text-sm text-gray-700">{tag.total_votes > 0 ? `+${tag.total_votes}` : ''}</div>
      {onVote && (
        <button
          type="button"
          onClick={() => onVote(tag)}
          disabled={submitting}
          title="Thumbs up"
          className="px-1.5 py-1.5 rounded-md border border-gray-300 bg-white cursor-pointer"
        >
          👍
        </button>
      )}
    </div>
  );
}

export default memo(ShopTagItem, (prevProps, nextProps) => {
  // Custom comparison function for memoization
  return (
    prevProps.tag.tag_id === nextProps.tag.tag_id &&
    prevProps.tag.tag_name === nextProps.tag.tag_name &&
    prevProps.tag.total_votes === nextProps.tag.total_votes &&
    prevProps.userId === nextProps.userId &&
    prevProps.submitting === nextProps.submitting &&
    prevProps.onVote === nextProps.onVote
  );
});