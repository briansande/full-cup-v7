/**
 * Test script to verify coffee shop filtering improvements
 * This can be run to validate that the new filtering system works as expected
 */

import { 
  applyCoffeeShopFilters, 
  filterMajorChains,
  filterByKeywords,
  filterByTypes,
  validateQuality,
  EXCLUDED_CHAINS,
  COFFEE_KEYWORDS,
  EXCLUDE_KEYWORDS
} from "./coffee-filtering";
import type { NearbyPlace } from "./density";

// Test data representing different types of establishments
const testPlaces: NearbyPlace[] = [
  {
    id: "starbucks-test",
    name: "Starbucks",
    displayName: { text: "Starbucks" },
    formattedAddress: "123 Main St, Houston, TX",
    location: { latitude: 29.7604, longitude: -95.3698 },
    types: ["cafe", "store", "food"],
    primaryType: "cafe",
    businessStatus: "OPERATIONAL",
    rating: 4.2,
    userRatingCount: 1500
  },
  {
    id: "local-coffee-test",
    name: "Local Coffee Roasters",
    displayName: { text: "Local Coffee Roasters" },
    formattedAddress: "456 Coffee Ave, Houston, TX",
    location: { latitude: 29.7504, longitude: -95.3598 },
    types: ["cafe", "coffee_shop"],
    primaryType: "coffee_shop",
    businessStatus: "OPERATIONAL",
    rating: 4.8,
    userRatingCount: 250
  },
  {
    id: "mcdonalds-test",
    name: "McDonald's",
    displayName: { text: "McDonald's" },
    formattedAddress: "789 Fast Food Blvd, Houston, TX",
    location: { latitude: 29.7404, longitude: -95.3498 },
    types: ["restaurant", "fast_food_restaurant"],
    primaryType: "fast_food_restaurant",
    businessStatus: "OPERATIONAL",
    rating: 3.5,
    userRatingCount: 800
  },
  {
    id: "bagel-shop-test",
    name: "NYC Bagels",
    displayName: { text: "NYC Bagels" },
    formattedAddress: "321 Bagel St, Houston, TX",
    location: { latitude: 29.7304, longitude: -95.3398 },
    types: ["bakery", "restaurant"],
    primaryType: "bakery",
    businessStatus: "OPERATIONAL",
    rating: 4.0,
    userRatingCount: 120
  },
  {
    id: "coffee-bagels-test",
    name: "Coffee & Bagels Co",
    displayName: { text: "Coffee & Bagels Co" },
    formattedAddress: "654 Mixed St, Houston, TX",
    location: { latitude: 29.7204, longitude: -95.3298 },
    types: ["cafe", "bakery"],
    primaryType: "cafe",
    businessStatus: "OPERATIONAL",
    rating: 4.3,
    userRatingCount: 180
  },
  {
    id: "gas-station-coffee",
    name: "Shell Gas Station",
    displayName: { text: "Shell Gas Station" },
    formattedAddress: "987 Highway St, Houston, TX",
    location: { latitude: 29.7104, longitude: -95.3198 },
    types: ["gas_station", "convenience_store"],
    primaryType: "gas_station",
    businessStatus: "OPERATIONAL",
    rating: 3.2,
    userRatingCount: 45
  },
  {
    id: "closed-cafe",
    name: "Old Coffee House",
    displayName: { text: "Old Coffee House" },
    formattedAddress: "111 Closed St, Houston, TX",
    location: { latitude: 29.7004, longitude: -95.3098 },
    types: ["cafe"],
    primaryType: "cafe",
    businessStatus: "CLOSED_PERMANENTLY",
    rating: 4.1,
    userRatingCount: 90
  },
  {
    id: "outside-houston",
    name: "Austin Coffee Co",
    displayName: { text: "Austin Coffee Co" },
    formattedAddress: "555 Austin St, Austin, TX",
    location: { latitude: 30.2672, longitude: -97.7431 }, // Austin coordinates
    types: ["cafe"],
    primaryType: "cafe",
    businessStatus: "OPERATIONAL",
    rating: 4.5,
    userRatingCount: 200
  }
];

function runFilteringTests() {
  console.log("=== Coffee Shop Filtering System Test ===\n");

  console.log("Test Data Summary:");
  console.log(`- Total test places: ${testPlaces.length}`);
  console.log(`- Expected legitimate coffee shops: 2 (Local Coffee Roasters, Coffee & Bagels Co)`);
  console.log(`- Should be filtered out: ${testPlaces.length - 2}\n`);

  // Test individual filter functions
  console.log("=== Individual Filter Tests ===\n");

  // Test 1: Chain filter
  console.log("1. Chain Filter Test:");
  const afterChains = filterMajorChains(testPlaces);
  const chainFiltered = testPlaces.filter(p => !afterChains.includes(p));
  console.log(`   Filtered out: ${chainFiltered.map(p => p.name).join(", ")}`);
  console.log(`   Remaining: ${afterChains.length}/${testPlaces.length}\n`);

  // Test 2: Keyword filter
  console.log("2. Keyword Filter Test:");
  const afterKeywords = filterByKeywords(afterChains);
  const keywordFiltered = afterChains.filter(p => !afterKeywords.includes(p));
  console.log(`   Filtered out: ${keywordFiltered.map(p => p.name).join(", ")}`);
  console.log(`   Remaining: ${afterKeywords.length}/${afterChains.length}\n`);

  // Test 3: Type filter
  console.log("3. Type Filter Test:");
  const afterTypes = filterByTypes(afterKeywords);
  const typeFiltered = afterKeywords.filter(p => !afterTypes.includes(p));
  console.log(`   Filtered out: ${typeFiltered.map(p => p.name).join(", ")}`);
  console.log(`   Remaining: ${afterTypes.length}/${afterKeywords.length}\n`);

  // Test 4: Quality filter
  console.log("4. Quality Filter Test:");
  const afterQuality = validateQuality(afterTypes);
  const qualityFiltered = afterTypes.filter(p => !afterQuality.includes(p));
  console.log(`   Filtered out: ${qualityFiltered.map(p => p.name).join(", ")}`);
  console.log(`   Remaining: ${afterQuality.length}/${afterTypes.length}\n`);

  // Test comprehensive filtering
  console.log("=== Comprehensive Filtering Test ===\n");
  const result = applyCoffeeShopFilters(testPlaces);
  
  console.log("Filtering Statistics:");
  console.log(`   Original: ${result.stats.original}`);
  console.log(`   After chain filter: ${result.stats.afterChainFilter} (${result.stats.original - result.stats.afterChainFilter} removed)`);
  console.log(`   After keyword filter: ${result.stats.afterKeywordFilter} (${result.stats.afterChainFilter - result.stats.afterKeywordFilter} removed)`);
  console.log(`   After type filter: ${result.stats.afterTypeFilter} (${result.stats.afterKeywordFilter - result.stats.afterTypeFilter} removed)`);
  console.log(`   After quality filter: ${result.stats.afterQualityFilter} (${result.stats.afterTypeFilter - result.stats.afterQualityFilter} removed)`);
  console.log(`   Final: ${result.stats.final}\n`);

  console.log("Final Results:");
  if (result.filtered.length > 0) {
    result.filtered.forEach(place => {
      console.log(`   ✓ ${place.name} - ${place.formattedAddress}`);
    });
  } else {
    console.log("   No places passed all filters");
  }

  const filteringEfficiency = Math.round((result.stats.final / result.stats.original) * 100);
  console.log(`\nFiltering Efficiency: ${filteringEfficiency}% (${result.stats.final}/${result.stats.original} passed)`);

  // Validate expected results
  console.log("\n=== Validation ===");
  const expectedNames = ["Local Coffee Roasters", "Coffee & Bagels Co"];
  const actualNames = result.filtered.map(p => p.name);
  
  const success = expectedNames.length === actualNames.length && 
    expectedNames.every(name => actualNames.includes(name));
  
  if (success) {
    console.log("✅ Test PASSED: Filtering system working correctly!");
  } else {
    console.log("❌ Test FAILED: Unexpected filtering results");
    console.log(`   Expected: ${expectedNames.join(", ")}`);
    console.log(`   Actual: ${actualNames.join(", ")}`);
  }

  return success;
}

// Export for potential use in other test files
export { runFilteringTests, testPlaces };

// Auto-run if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  runFilteringTests();
}