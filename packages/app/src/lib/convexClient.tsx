import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { type ReactNode } from 'react';

// Initialize Convex client - you'll need to set up your Convex deployment URL
const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL || 'https://your-convex-deployment.convex.cloud');

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}

export default convex;
