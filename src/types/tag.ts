export interface Tag {
  id: string;
  name: string;
  category?: string | null;
  description?: string | null;
}

export interface ShopTag {
  id: string;
  shop_id: string;
  tag_id: string;
  user_id: string;
  votes: number;
  created_at: string;
}

export interface TagSummary {
  tag_id: string;
  tag_name: string;
  category: string | null;
  total_votes: number;
  user_count: number;
}

export interface SuggestResult {
  id: string;
  name: string;
}