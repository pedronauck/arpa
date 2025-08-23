import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { type ReactNode, useEffect } from 'react';

// Get Convex URL from environment
const convexUrl = import.meta.env.VITE_CONVEX_URL;

// Validate Convex URL
if (!convexUrl || convexUrl === 'https://your-convex-deployment.convex.cloud') {
  console.error('⚠️ Invalid or missing VITE_CONVEX_URL in environment variables');
  console.error('Please configure your Convex deployment URL in the .env file');
}

// Initialize Convex client
const convex = new ConvexReactClient(convexUrl || 'https://your-convex-deployment.convex.cloud');

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Log connection status for debugging
    if (convexUrl && convexUrl !== 'https://your-convex-deployment.convex.cloud') {
      console.log('✅ Convex client connected to:', convexUrl);
    } else {
      console.warn('⚠️ Convex client using placeholder URL - messages will not be saved!');
    }
  }, []);

  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}

export default convex;
