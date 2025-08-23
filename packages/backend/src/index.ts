import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import chat from "./routes/chat";
import { initializeMCPClient, closeMCPClient } from "./services/mcp-client";

const app = new Hono();

app.use("*", logger());
app.use("*", cors());

app.get("/", c => {
  return c.json({ message: "Backend API running with MCP support" });
});

app.get("/health", c => {
  return c.json({ status: "healthy", timestamp: new Date().toISOString() });
});

const port = process.env.PORT || 3001;

// Async initialization wrapper
async function startServer() {
  try {
    // Initialize MCP client BEFORE mounting routes
    await initializeMCPClient();
    console.log('MCP client initialized successfully');
    
    // Mount chat routes AFTER MCP is ready
    app.route("/api", chat);
    
    // Cleanup on shutdown
    process.on('SIGINT', async () => {
      console.log('Shutting down...');
      await closeMCPClient();
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
