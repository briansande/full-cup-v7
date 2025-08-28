import { runAdaptiveTestSync } from "./src/lib/adaptive-search";

async function testSync() {
  console.log("Starting test sync...");
  
  try {
    const result = await runAdaptiveTestSync({
      maxApiCalls: 10,
      rateLimitMs: 1000,
      maxDepth: 2,
      debugLog: true,
      enableFiltering: true,
    });
    
    console.log("Test sync completed:", result);
  } catch (error) {
    console.error("Test sync failed:", error);
  }
}

testSync();