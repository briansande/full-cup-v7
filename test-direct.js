// Simple test script to verify the sync functionality
require('dotenv').config({ path: '.env.local' });

async function testSync() {
  console.log("Loading sync function...");
  
  try {
    // Dynamically import the sync function
    const { syncHoustonCoffeeShops } = require('./src/lib/sync');
    
    console.log("Starting sync test...");
    const result = await syncHoustonCoffeeShops(2);
    console.log("Sync result:", result);
  } catch (error) {
    console.error("Sync test failed:", error);
  }
}

testSync();