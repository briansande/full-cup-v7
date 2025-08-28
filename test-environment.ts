import { supabase, testConnection } from "./src/lib/supabase";
import { searchNearbyPlaces } from "./src/lib/google-places";

async function testEnvironment() {
  console.log("Testing environment setup...");
  
  // Test Supabase connection
  console.log("Testing Supabase connection...");
  try {
    const connectionResult = await testConnection();
    console.log("Supabase connection test:", connectionResult);
  } catch (error) {
    console.error("Supabase connection test failed:", error);
  }
  
  // Test Google Maps API
  console.log("Testing Google Maps API...");
  try {
    const key = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    console.log("Google Maps API key present:", !!key);
    
    if (key) {
      const places = await searchNearbyPlaces("coffee shops in Houston, TX", 2);
      console.log("Google Maps API test - Found places:", places.length);
      if (places.length > 0) {
        console.log("Sample place:", places[0]);
      }
    } else {
      console.log("No Google Maps API key found");
    }
  } catch (error) {
    console.error("Google Maps API test failed:", error);
  }
  
  // Test database query
  console.log("Testing database query...");
  try {
    const { data, error } = await supabase.from("coffee_shops").select().limit(1);
    if (error) {
      console.error("Database query failed:", error);
    } else {
      console.log("Database query successful, found rows:", data?.length || 0);
    }
  } catch (error) {
    console.error("Database query test failed:", error);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testEnvironment();
}