// Simple test script to verify the sync functionality
require('dotenv').config({ path: '.env.local' });

// This will only work if we compile TypeScript first
// For now, let's test the API endpoint directly

console.log("Environment variables loaded:");
console.log("GOOGLE_MAPS_API_KEY:", process.env.GOOGLE_MAPS_API_KEY ? "Present" : "Missing");
console.log("NEXT_PUBLIC_SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "Present" : "Missing");
console.log("NEXT_PUBLIC_SUPABASE_ANON_KEY:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "Present" : "Missing");

console.log("\nTo test the sync functionality, you can:");
console.log("1. Start the development server: npm run dev");
console.log("2. Make a POST request to http://localhost:3000/api/sync");
console.log("   Example: curl -X POST http://localhost:3000/api/sync");