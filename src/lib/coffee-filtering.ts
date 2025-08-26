/**
 * Coffee Shop Filtering System
 * 
 * Comprehensive filtering utilities for Google Places API results to ensure
 * only legitimate coffee shops are included in search results.
 */

import type { NearbyPlace } from "./density";

// Major chain exclusions - comprehensive list of non-independent coffee chains
export const EXCLUDED_CHAINS = [
  // Major coffee chains
  "starbucks",
  "dunkin",
  "dunkin donuts",
  "dunkin'",
  "peet",
  "peets",
  "peet's coffee",
  "tim hortons",
  "caribou coffee",
  "caribou",
  "costa coffee",
  "costa",
  
  // Fast food with coffee (not coffee-focused)
  "mcdonald",
  "mcdonalds",
  "mccafe",
  "burger king",
  "subway",
  "taco bell",
  "kfc",
  "wendys",
  "wendy's",
  "arby's",
  "arbys",
  "jack in the box",
  "sonic",
  "whataburger",
  "in-n-out",
  
  // Gas stations with coffee
  "7-eleven",
  "7 eleven",
  "circle k",
  "wawa",
  "sheetz",
  "speedway",
  "shell",
  "exxon",
  "bp",
  "chevron",
  "mobil",
  "valero",
  "marathon",
  
  // Bakeries/Donut shops (unless coffee-focused)
  "krispy kreme",
  "shipley",
  "kolache factory",
  
  // Other non-coffee establishments
  "cvs",
  "walgreens",
  "walmart",
  "target",
  "kroger",
  "heb",
  "whole foods",
];

// Coffee-positive keywords that indicate legitimate coffee establishments
export const COFFEE_KEYWORDS = [
  "coffee",
  "cafe",
  "espresso",
  "roasters",
  "roastery",
  "coffeehouse",
  "coffee house",
  "cappuccino",
  "latte",
  "brew",
  "brewing",
  "barista",
  "beans",
  "grind",
  "drip",
  "pour over",
  "cold brew",
  "nitro",
  "macchiato",
  "americano",
  "cortado",
  "mocha",
  "frappe",
  "frappuccino",
];

// Keywords that indicate non-coffee establishments
export const EXCLUDE_KEYWORDS = [
  "bagel",
  "donut",
  "doughnut",
  "bakery",
  "pizza",
  "burger",
  "taco",
  "sandwich",
  "deli",
  "restaurant",
  "grill",
  "bar",
  "pub",
  "hotel",
  "motel",
  "gas",
  "station",
  "convenience",
  "grocery",
  "market",
  "pharmacy",
  "bank",
  "credit union",
  "atm",
  "mall",
  "shopping center",
  "food court",
  "hospital",
  "clinic",
  "gym",
  "fitness",
];

// Primary types that should be included (Google Places API v1)
export const INCLUDED_PRIMARY_TYPES = [
  "cafe",
  "coffee_shop",
];

// Primary types that should be excluded
export const EXCLUDED_PRIMARY_TYPES = [
  "restaurant",
  "fast_food_restaurant",
  "bakery",
  "gas_station",
  "convenience_store",
  "grocery_store",
  "pharmacy",
  "bank",
  "atm",
  "shopping_mall",
  "department_store",
  "hospital",
  "doctor",
  "gym",
  "hotel",
  "lodging",
];

/**
 * Extract display name from various place formats
 */
function getDisplayName(place: NearbyPlace): string {
  // Prefer displayName.text when available (v1 / new Places shape)
  if (place.displayName?.text && typeof place.displayName.text === "string") {
    return place.displayName.text;
  }

  // If place.name is a human-readable name, use it. However the API sometimes
  // provides a resource-style name like "places/{place_id}" in place.name — in
  // that case prefer the displayName above or return empty so filters that rely
  // on human-readable names don't get tricked by resource identifiers.
  if (typeof place.name === "string") {
    if (place.name.startsWith("places/")) {
      return "";
    }
    return place.name;
  }

  return "";
}

/**
 * Extract business types from place data
 */
function getBusinessTypes(place: NearbyPlace): string[] {
  return place.types || [];
}

/**
 * Filter out major chains by name matching
 */
export function filterMajorChains(places: NearbyPlace[]): NearbyPlace[] {
  const chainPatterns = EXCLUDED_CHAINS.map(chain => chain.toLowerCase());
  
  return places.filter(place => {
    const name = getDisplayName(place).toLowerCase();
    const address = (place.formattedAddress || "").toLowerCase();
    
    // Check name against chain patterns
    const isChain = chainPatterns.some(pattern => 
      name.includes(pattern) || address.includes(pattern)
    );
    
    return !isChain;
  });
}

/**
 * Filter by coffee-positive and negative keywords
 * More permissive for places with correct primary types from Google Places API
 */
export function filterByKeywords(places: NearbyPlace[]): NearbyPlace[] {
  const coffeeKeywords = COFFEE_KEYWORDS.map(kw => kw.toLowerCase());
  const excludeKeywords = EXCLUDE_KEYWORDS.map(kw => kw.toLowerCase());
  
  return places.filter(place => {
    const name = getDisplayName(place).toLowerCase();
    const address = (place.formattedAddress || "").toLowerCase();
    const searchText = `${name} ${address}`;
    const primaryType = place.primaryType?.toLowerCase() || "";
    const types = (place.types || []).map(t => t.toLowerCase());
    
    // If Google already classified this as cafe/coffee_shop, be more permissive
    const isCoffeeType = primaryType === "cafe" || primaryType === "coffee_shop" || 
                        types.includes("cafe") || types.includes("coffee_shop");
    
    // Check for exclude keywords first
    const hasExcludeKeywords = excludeKeywords.some(keyword => 
      searchText.includes(keyword)
    );
    
    // If has exclude keywords, only keep if also has coffee keywords OR is coffee type
    if (hasExcludeKeywords) {
      const hasCoffeeKeywords = coffeeKeywords.some(keyword => 
        searchText.includes(keyword)
      );
      return hasCoffeeKeywords || isCoffeeType;
    }
    
    // If no exclude keywords and Google says it's a coffee place, trust it
    if (isCoffeeType) {
      return true;
    }
    
    // Otherwise, require coffee keywords
    const hasCoffeeKeywords = coffeeKeywords.some(keyword => 
      searchText.includes(keyword)
    );
    
    return hasCoffeeKeywords;
  });
}

/**
 * Filter by primary business types
 */
export function filterByTypes(places: NearbyPlace[]): NearbyPlace[] {
  return places.filter(place => {
    const types = getBusinessTypes(place);
    
    // Check if any type is in excluded list
    const hasExcludedType = types.some(type => 
      EXCLUDED_PRIMARY_TYPES.includes(type)
    );
    
    if (hasExcludedType) {
      // Only allow if also has included type
      return types.some(type => INCLUDED_PRIMARY_TYPES.includes(type));
    }
    
    return true;
  });
}

/**
 * Quality validation checks
 */
export function validateQuality(places: NearbyPlace[]): NearbyPlace[] {
  return places.filter(place => {
    // Check business status
    if (place.businessStatus && place.businessStatus !== "OPERATIONAL") {
      return false;
    }
    
    // Check if has any rating data (legitimate businesses usually have ratings)
    // Allow places without ratings as they might be new
    const hasRatingData = place.rating !== undefined || place.userRatingCount !== undefined;
    
    // Check for valid coordinates
    const hasValidCoords = 
      (place.location && 
       ((place.location as { latitude?: number }).latitude !== undefined && 
        (place.location as { longitude?: number }).longitude !== undefined)) ||
      (place.geometry?.location?.lat !== undefined && 
       place.geometry?.location?.lng !== undefined);
    
    if (!hasValidCoords) {
      return false;
    }
    
    // Check for Houston area (rough bounds)
    // Houston metro area approximately: 29.0-30.5 lat, -96.0 to -94.5 lng
    const coords = getCoordinates(place);
    if (coords.lat && coords.lng) {
      const inHoustonArea = 
        coords.lat >= 29.0 && coords.lat <= 30.5 &&
        coords.lng >= -96.0 && coords.lng <= -94.5;
      
      if (!inHoustonArea) {
        return false;
      }
    }
    
    return true;
  });
}

/**
 * Extract coordinates from place data
 */
function getCoordinates(place: NearbyPlace): { lat?: number; lng?: number } {
  // Try v1 format first
  if (place.location) {
    const loc = place.location as { latitude?: number; longitude?: number; lat?: number; lng?: number };
    if (loc.latitude !== undefined && loc.longitude !== undefined) {
      return { lat: loc.latitude, lng: loc.longitude };
    }
    if (loc.lat !== undefined && loc.lng !== undefined) {
      return { lat: loc.lat, lng: loc.lng };
    }
  }
  
  // Try geometry format
  if (place.geometry?.location) {
    return {
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng
    };
  }
  
  return {};
}

/**
 * Comprehensive filtering pipeline
 * Applies all filtering steps in the correct order
 */
export function applyCoffeeShopFilters(places: NearbyPlace[]): {
  filtered: NearbyPlace[];
  stats: {
    original: number;
    afterChainFilter: number;
    afterKeywordFilter: number;
    afterTypeFilter: number;
    afterQualityFilter: number;
    final: number;
  };
} {
  const original = places.length;
  
  // Step 1: Filter major chains
  const afterChains = filterMajorChains(places);
  const afterChainFilter = afterChains.length;
  
  // Step 2: Filter by keywords
  const afterKeywords = filterByKeywords(afterChains);
  const afterKeywordFilter = afterKeywords.length;
  
  // Step 3: Filter by types
  const afterTypes = filterByTypes(afterKeywords);
  const afterTypeFilter = afterTypes.length;
  
  // Step 4: Quality validation
  const final = validateQuality(afterTypes);
  const afterQualityFilter = final.length;
  
  return {
    filtered: final,
    stats: {
      original,
      afterChainFilter,
      afterKeywordFilter,
      afterTypeFilter,
      afterQualityFilter,
      final: afterQualityFilter,
    }
  };
}

/**
 * Enhanced place type for tracking filtering metadata
 */
export type FilteredPlace = NearbyPlace & {
  is_chain_excluded?: boolean;
  filtering_metadata?: {
    passed_chain_filter: boolean;
    passed_keyword_filter: boolean;
    passed_type_filter: boolean;
    passed_quality_filter: boolean;
  };
};

/**
 * Apply filters with detailed tracking for analytics
 */
export function applyCoffeeShopFiltersWithTracking(places: NearbyPlace[]): FilteredPlace[] {
  return places.map(place => {
    const chainPassed = filterMajorChains([place]).length > 0;
    const keywordPassed = chainPassed && filterByKeywords([place]).length > 0;
    const typePassed = keywordPassed && filterByTypes([place]).length > 0;
    const qualityPassed = typePassed && validateQuality([place]).length > 0;
    
    const enhanced: FilteredPlace = {
      ...place,
      is_chain_excluded: !chainPassed,
      filtering_metadata: {
        passed_chain_filter: chainPassed,
        passed_keyword_filter: keywordPassed,
        passed_type_filter: typePassed,
        passed_quality_filter: qualityPassed,
      }
    };
    
    return enhanced;
  }).filter(place => 
    place.filtering_metadata?.passed_chain_filter &&
    place.filtering_metadata?.passed_keyword_filter &&
    place.filtering_metadata?.passed_type_filter &&
    place.filtering_metadata?.passed_quality_filter
  );
}