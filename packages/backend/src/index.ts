import { app, initializeApp, cleanupApp } from "./app";

const port = process.env.PORT || 3001;

// Async initialization wrapper
async function startServer() {
  try {
    // Initialize app with MCP
    await initializeApp();
    
    // Cleanup on shutdown
    process.on('SIGINT', async () => {
      console.log('Shutting down...');
      await cleanupApp();
      process.exit(0);
    });
    
    console.log(`Backend server with MCP running on http://localhost:${port}`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

export default {
  port,
  fetch: app.fetch,
  // Configure timeouts for long-running streaming requests
  idleTimeout: 120, // 120 seconds for idle connections
  // Disable request body timeout for streaming
  development: true,
};
