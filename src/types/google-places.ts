/**
 * Type definitions for Google Places API (New) responses
 * 
 * These types cover the fields used in the Full Cup application based on:
 * - Places API (New) Text Search: https://developers.google.com/maps/documentation/places/web-service/text-search
 * - Places API (New) Nearby Search: https://developers.google.com/maps/documentation/places/web-service/search-nearby
 * - Places API (New) Place Details: https://developers.google.com/maps/documentation/places/web-service/place-details
 */

/**
 * Basic place information returned by search endpoints
 * This type includes both new and legacy fields to maintain compatibility
 */
export interface GooglePlace {
  // New API fields
  id: string;
  name?: string;
  displayName?: {
    text: string;
    languageCode?: string;
  };
  formattedAddress?: string;
  types?: string[];
  location?: {
    latitude: number;
    longitude: number;
  };
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  regularOpeningHours?: GooglePlaceOpeningHours;
  currentOpeningHours?: GooglePlaceOpeningHours;
  priceLevel?: GooglePriceLevel;
  businessStatus?: GoogleBusinessStatus;
  photos?: GooglePlacePhoto[];
  primaryType?: string;
  primaryTypeDisplayName?: {
    text: string;
    languageCode?: string;
  };
  shortFormattedAddress?: string;
  editorialSummary?: {
    text: string;
    languageCode?: string;
  };
  accessibilityOptions?: {
    wheelchairAccessibleParking?: boolean;
    wheelchairAccessibleEntrance?: boolean;
    wheelchairAccessibleRestroom?: boolean;
    wheelchairAccessibleSeating?: boolean;
  };
  adrFormatAddress?: string;
  allowsDogs?: boolean;
  curbsidePickup?: boolean;
  delivery?: boolean;
  dineIn?: boolean;
  fuelOptions?: {
    fuelDispensers: string[];
  };
  goodForChildren?: boolean;
  goodForGroups?: boolean;
  goodForWatchingSports?: boolean;
  hasKidFriendlyBathroom?: boolean;
  hasRestroom?: boolean;
  hasSeating?: boolean;
  hasTakeout?: boolean;
  liveMusic?: boolean;
  menuForChildren?: boolean;
  outdoorSeating?: boolean;
  parkingOptions?: {
    acceptsCreditCards?: boolean;
    acceptsDebitCards?: boolean;
    acceptsCashOnly?: boolean;
    lot?: boolean;
    street?: boolean;
    valet?: boolean;
    garage?: boolean;
  };
  paymentOptions?: {
    acceptsCreditCards?: boolean;
    acceptsDebitCards?: boolean;
    acceptsCashOnly?: boolean;
    acceptsNfc?: boolean;
  };
  reservable?: boolean;
  servesBeer?: boolean;
  servesBreakfast?: boolean;
  servesBrunch?: boolean;
  servesCocktails?: boolean;
  servesCoffee?: boolean;
  servesDessert?: boolean;
  servesDinner?: boolean;
  servesLunch?: boolean;
  servesVegetarianFood?: boolean;
  servesWine?: boolean;
  takesReservations?: boolean;
  wifi?: GoogleWifiOption;
  
  // Legacy fields for backward compatibility
  place_id?: string;
  placeId?: string;
  lat?: number;
  lng?: number;
  geometry?: {
    location?: {
      lat?: number;
      lng?: number;
    };
  };
  vicinity?: string;
  address?: string;
  formatted_address?: string;
  phone?: string;
  formatted_phone_number?: string;
  website?: string;
  price_level?: number;
  opening_hours?: GooglePlaceOpeningHours;
  photo_reference?: string;
}

/**
 * Detailed place information returned by place details endpoint
 */
export interface GooglePlaceDetails extends GooglePlace {
  addressComponents?: GoogleAddressComponent[];
  utcOffsetMinutes?: number;
  adrFormatAddress?: string;
  reviews?: GooglePlaceReview[];
  iconMaskBaseUri?: string;
  iconBackgroundColor?: string;
  iconUri?: string;
  goodForChildren?: boolean;
  goodForGroups?: boolean;
  goodForWatchingSports?: boolean;
  hasRestroom?: boolean;
  hasSeating?: boolean;
  hasTakeout?: boolean;
  outdoorSeating?: boolean;
  reservable?: boolean;
  servesBeer?: boolean;
  servesBreakfast?: boolean;
  servesBrunch?: boolean;
  servesCocktails?: boolean;
  servesCoffee?: boolean;
  servesDessert?: boolean;
  servesDinner?: boolean;
  servesLunch?: boolean;
  servesVegetarianFood?: boolean;
  servesWine?: boolean;
  takesReservations?: boolean;
  url?: string;
  utcOffset?: number;
  wheelchairAccessibleEntrance?: boolean;
}

/**
 * Opening hours information
 */
export interface GooglePlaceOpeningHours {
  openNow?: boolean;
  periods?: GoogleOpeningPeriod[];
  weekdayDescriptions?: string[];
  weekday_text?: string[];
}

/**
 * Opening period for a day
 */
export interface GoogleOpeningPeriod {
  open: GoogleOpeningHoursTime;
  close?: GoogleOpeningHoursTime;
}

/**
 * Time specification for opening hours
 */
export interface GoogleOpeningHoursTime {
  day: number; // 0 = Sunday, 1 = Monday, etc.
  hour: number; // 0-23
  minute: number; // 0-59
}

/**
 * Photo information
 */
export interface GooglePlacePhoto {
  name: string; // "places/{place_id}/photos/{photo_reference}"
  widthPx: number;
  heightPx: number;
  authorAttributions: GoogleAuthorAttribution[];
  photo_reference?: string; // Legacy field
}

/**
 * Author attribution for photos
 */
export interface GoogleAuthorAttribution {
  displayName: string;
  uri: string;
  photoUri: string;
}

/**
 * Price level enum
 */
export type GooglePriceLevel = 
  | "PRICE_LEVEL_UNSPECIFIED"
  | "PRICE_LEVEL_FREE"
  | "PRICE_LEVEL_INEXPENSIVE"
  | "PRICE_LEVEL_MODERATE"
 | "PRICE_LEVEL_EXPENSIVE"
 | "PRICE_LEVEL_VERY_EXPENSIVE";

/**
 * Business status enum
 */
export type GoogleBusinessStatus = 
  | "OPERATIONAL"
  | "CLOSED_TEMPORARILY"
  | "CLOSED_PERMANENTLY";

/**
 * WiFi options
 */
export type GoogleWifiOption = 
  | "WIFI_OPTION_UNSPECIFIED"
  | "FREE_WIFI"
  | "PAID_WIFI"
  | "NO_WIFI";

/**
 * Address component
 */
export interface GoogleAddressComponent {
  longText: string;
  shortText: string;
  types: string[];
  languageCode: string;
}

/**
 * Place review
 */
export interface GooglePlaceReview {
  name: string;
  relativePublishTimeDescription: string;
  rating: number;
  text: {
    text: string;
    languageCode: string;
  };
  originalText: {
    text: string;
    languageCode: string;
  };
  authorAttribution: {
    displayName: string;
    uri: string;
    photoUri: string;
  };
  publishTime: string;
}

/**
 * Response for search endpoints
 */
export interface GooglePlacesSearchResponse {
  places?: GooglePlace[];
  nextPageToken?: string;
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

/**
 * Response for place details endpoint
 */
export interface GooglePlaceDetailsResponse {
  places?: GooglePlaceDetails[];
}