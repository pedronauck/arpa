import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import chat from "./routes/chat";
import { initializeMCPClient, closeMCPClient, getMCPConnectionStatus } from "./services/mcp-client";

// Create the Hono app instance
export const app = new Hono();

// Apply middleware
app.use("*", logger());
app.use("*", cors());

// Root routes
app.get("/", c => {
  return c.json({ message: "Backend API running with MCP support" });
});

app.get("/health", c => {
  return c.json({ status: "healthy", timestamp: new Date().toISOString() });
});

app.get("/api/mcp/status", c => {
  const status = getMCPConnectionStatus();
  return c.json(status);
});

// Initialize function for MCP and routes
export async function initializeApp() {
  try {
    // Initialize MCP client
    await initializeMCPClient();
    console.log('MCP client initialized successfully');
    
    // Mount chat routes after MCP is ready
    app.route("/api", chat);
    
    return app;
  } catch (error) {
    console.error('Failed to initialize app:', error);
    throw error;
  }
}

// Cleanup function
export async function cleanupApp() {
  await closeMCPClient();
}