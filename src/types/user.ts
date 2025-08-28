export interface User {
  id: string;
  email?: string | null;
  created_at?: string | null;
}

export interface UserStats {
  user_id: string;
  total_points?: number;
  level?: number;
  shops_visited?: number;
  reviews_written?: number;
  photos_uploaded?: number;
  votes_received?: number;
}

export interface UserAchievement {
  id: string;
  achievement_id: string;
  user_id: string;
  earned_at: string | null;
  progress?: Record<string, unknown>;
}