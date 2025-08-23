import { ConvexHttpClient } from "convex/browser";

// Create a Convex client for the extension
// Note: This will be initialized properly in the extension with the correct URL
export let convexClient: ConvexHttpClient;

// Initialize the Convex client with the proper URL
export function initializeConvexClient(convexUrl: string) {
    convexClient = new ConvexHttpClient(convexUrl);
    return convexClient;
}

// Export the client for use in the extension
export default convexClient;
