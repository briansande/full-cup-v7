const { execSync } = require('child_process');

// Run the Next.js API route directly using curl
console.log("Testing sync API endpoint...");

try {
  // First start the development server in the background
  console.log("Starting Next.js development server...");
  execSync('npm run dev', { cwd: '.', stdio: 'inherit' });
} catch (error) {
  console.error("Failed to start Next.js development server:", error.message);
}