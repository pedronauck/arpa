import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";

const app = new Hono();

app.use("*", logger());
app.use("*", cors());

app.get("/", (c) => {
    return c.json({ message: "Backend API running" });
});

app.get("/health", (c) => {
    return c.json({ status: "healthy", timestamp: new Date().toISOString() });
});

const port = process.env.PORT || 3001;

export default {
    port,
    fetch: app.fetch,
};

console.log(`Backend server running on http://localhost:${port}`);
