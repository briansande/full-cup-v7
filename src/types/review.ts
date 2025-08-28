export interface ShopReview {
  id: string;
  user_id: string;
  shop_id: string;
  rating: number | null;
  review_text: string | null;
  created_at: string | null;
  coffee_quality_rating?: number | null;
  atmosphere_rating?: number | null;
  noise_level_rating?: number | null;
  wifi_quality_rating?: number | null;
  work_friendliness_rating?: number | null;
  service_rating?: number | null;
}

export interface DrinkReview {
  id: string;
  user_id: string;
  shop_id: string;
  drink_name: string;
  rating: string; // 'pass' | 'good' | 'awesome'
  review_text: string | null;
  drink_type: string | null;
  created_at: string | null;
}