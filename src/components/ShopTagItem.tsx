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
    <div style={{ padding: '6px 8px', borderRadius: 999, background: '#f3f4f6', display: 'flex', gap: 8, alignItems: 'center' }}>
      <div style={{ fontWeight: 700 }}>{tag.tag_name}</div>
      <div style={{ fontSize: 13, color: '#444' }}>{tag.total_votes > 0 ? `+${tag.total_votes}` : ''}</div>
      {onVote && (
        <button
          type="button"
          onClick={() => onVote(tag)}
          disabled={submitting}
          title="Thumbs up"
          style={{
            padding: '6px 8px',
            borderRadius: 6,
            border: '1px solid #d1d5db',
            background: '#fff',
            cursor: 'pointer',
          }}
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