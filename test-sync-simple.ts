import { syncHoustonCoffeeShops } from "./src/lib/sync";

async function testSync() {
  console.log("Starting Houston coffee shops sync...");
  
  try {
    const result = await syncHoustonCoffeeShops(5);
    console.log("Sync completed:", result);
  } catch (error) {
    console.error("Sync failed:", error);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testSync();
}