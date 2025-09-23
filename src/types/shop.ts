export interface Shop {
  id: string;
  name: string | null;
  address?: string | null;
  formatted_address?: string | null;
  latitude: number | null;
  longitude: number | null;
  phone?: string | null;
  website?: string | null;
  google_rating?: number | null;
  price_level?: number | null;
  opening_hours?: OpeningHours | null;
  photos?: string[] | null;
  main_photo_url?: string | null;
  photo_attribution?: string | null;
  google_photo_reference?: string | null;
  types?: string[] | null;
  status?: string | null;
  is_chain_excluded?: boolean | null;
  date_added?: string | null;
  last_updated?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  sync_metadata?: SyncMetadata | null;
  avgRating?: number | null;
  avgCoffeeQuality?: number | null;
  avgAtmosphere?: number | null;
  avgNoiseLevel?: number | null;
  avgWifiQuality?: number | null;
  avgWorkFriendliness?: number | null;
  avgService?: number | null;
  topTags?: TopTag[];
  tagIds?: string[];
}

export interface TopTag {
  tag_id: string;
  tag_name: string;
  total_votes: number;
}

export interface SimpleShop {
  id: string;
  name?: string | null;
}

export interface OpeningHours {
  openNow?: boolean;
  periods?: Array<{
    open: {
      day: number;
      hour: number;
      minute: number;
    };
    close?: {
      day: number;
      hour: number;
      minute: number;
    };
  }>;
  weekdayDescriptions?: string[];
  weekday_text?: string[];
}

export interface SyncMetadata {
  sourceGridId?: string;
  gridRadius?: number;
  searchLevel?: number;
  raw?: {
    id?: string | null;
    name?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  };
}