# MCP Integration Implementation Plan

## Overview
Integrate the MCP server from `@packages/agent` into the AI chat bot in `@packages/app` using the existing Hono backend in `@packages/backend`.

## Architecture Diagram
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  @packages/app  │────▶│ @packages/backend│────▶│ @packages/agent │
│   (React App)   │ HTTP│  (Hono Server)   │stdio│  (MCP Server)   │
│                 │     │                  │     │                 │
│ - useChat hook  │     │ - /api/chat      │     │ - code_review   │
│ - AI Elements   │     │ - MCP Client     │     │   tool          │
│ - Convex DB     │     │ - AI SDK         │     │ - Mastra        │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Phase 1: Backend MCP Integration (Priority: HIGH)

### 1.1 Install Dependencies in @packages/backend
```bash
cd packages/backend
bun add ai @ai-sdk/openai @modelcontextprotocol/sdk
```

### 1.2 Create MCP Client Service
Create `packages/backend/src/services/mcp-client.ts`:
```typescript
import { experimental_createMCPClient, type MCPClient } from 'ai';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import path from 'path';

// Properly typed MCP client and tools
let mcpClient: MCPClient | null = null;
let mcpTools: Record<string, any> | null = null;

export async function initializeMCPClient() {
  if (mcpClient) return mcpTools;
  
  // Validate OpenAI API key at initialization
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }
  
  try {
    // Use Bun's import.meta.dir for path resolution
    const agentPath = path.join(import.meta.dir, '../../../agent/dist/mcp/index.js');
    
    const transport = new StdioClientTransport({
      command: 'node', // Use node for CommonJS compatibility
      args: [agentPath],
    });
    
    mcpClient = await experimental_createMCPClient({ transport });
    mcpTools = await mcpClient.tools();
    
    console.log('MCP client initialized with tools:', Object.keys(mcpTools));
    return mcpTools;
  } catch (error) {
    console.error('Failed to initialize MCP client:', error);
    throw error;
  }
}

export async function closeMCPClient() {
  if (mcpClient) {
    await mcpClient.close();
    mcpClient = null;
    mcpTools = null;
  }
}

export function getMCPTools() {
  return mcpTools;
}

// Connection recovery helper
export async function ensureMCPConnection() {
  if (!mcpClient || !mcpTools) {
    console.log('MCP client disconnected, attempting to reconnect...');
    return await initializeMCPClient();
  }
  return mcpTools;
}
```

### 1.3 Create Chat API Route
Create `packages/backend/src/routes/chat.ts`:
```typescript
import { Hono } from 'hono';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { ensureMCPConnection } from '../services/mcp-client';

const chat = new Hono();

chat.post('/chat', async (c) => {
  const { messages } = await c.req.json();
  
  // Ensure MCP connection with recovery
  const tools = await ensureMCPConnection();
  
  if (!tools) {
    return c.json({ error: 'MCP tools not available' }, 503);
  }
  
  try {
    const response = await streamText({
      model: openai('gpt-4o'),
      messages,
      tools,
      system: "You are an AI assistant with code review capabilities via MCP tools.",
    });
    
    // Use AI SDK's built-in streaming response
    return response.toDataStreamResponse();
  } catch (error) {
    console.error('Chat error:', error);
    // Return more specific error information
    return c.json({ 
      error: 'Failed to process chat',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default chat;
```

### 1.4 Update Backend Index
Update `packages/backend/src/index.ts`:
```typescript
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
};
```

## Phase 2: Agent Build Configuration (Priority: HIGH)

### 2.1 Add Build Script to @packages/agent
Update `packages/agent/package.json`:
```json
{
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "mcp:start": "bun run dist/mcp/index.js"
  }
}
```

### 2.2 Create TypeScript Config
Create `packages/agent/tsconfig.json` if not exists:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Phase 3: Frontend Integration (Priority: MEDIUM)

### 3.1 Update Chat Input Component
Replace TODO in `packages/app/src/components/chat-input.tsx`:
```typescript
import { useChat } from '@ai-sdk/react';
import { useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useState, useEffect } from 'react';

export function ChatInput({ chatId }: ChatInputProps) {
  const sendMessage = useMutation(api.chats.sendMessage);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  
  const { messages, input, handleInputChange, handleSubmit, isLoading, setInput } = useChat({
    api: 'http://localhost:3001/api/chat',
    onResponse: async () => {
      // Save user message to Convex when request starts
      if (hasSubmitted && input.trim()) {
        await sendMessage({
          chatId,
          content: input,
          role: 'user',
        });
        setHasSubmitted(false);
      }
    },
    onFinish: async (message) => {
      // Save assistant response to Convex
      await sendMessage({
        chatId,
        content: message.content,
        role: 'assistant',
      });
    },
    onError: (error) => {
      console.error('Chat error:', error);
      // Optionally show error to user
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    // Mark that we've submitted for onResponse handler
    setHasSubmitted(true);
    
    // Let useChat handle the submission
    handleSubmit(e);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e as any);
    }
  };

  return (
    <div className="border-t border-border p-4">
      <div className="max-w-3xl mx-auto">
        <form onSubmit={onSubmit}>
          <div className="relative">
            <Textarea
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="min-h-[80px] pr-12 resize-none"
              disabled={isLoading}
              maxLength={4000} // Client-side length validation
            />
            <Button
              type="submit"
              disabled={!input.trim() || isLoading}
              size="sm"
              className="absolute bottom-2 right-2"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
        <p className="text-xs text-muted-foreground mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
```

## Phase 4: Testing & Validation

### 4.1 Build Steps
```bash
# 1. Build the agent MCP server
cd packages/agent
bun run build

# 2. Start the backend with MCP
cd ../backend
bun dev

# 3. Start the frontend app
cd ../app
bun dev
```

### 4.2 Test MCP Integration
1. Open the chat interface
2. Send a message requesting code review
3. Verify MCP tool is called and response is streamed
4. Check Convex for message persistence

## Implementation Checklist

- [ ] Install backend dependencies (`ai`, `@ai-sdk/openai`, `@modelcontextprotocol/sdk`)
- [ ] Create MCP client service in backend
- [ ] Add chat API route with streaming
- [ ] Build agent package to JavaScript
- [ ] Update frontend to use `useChat` hook
- [ ] Test MCP tool invocation
- [ ] Add error handling and retry logic
- [ ] Configure environment variables for API keys

## Environment Variables Required

Create `.env` in `packages/backend`:
```env
OPENAI_API_KEY=your-api-key-here
PORT=3001
```

## Next Steps

1. **Immediate**: Implement Phase 1 (Backend MCP Integration)
2. **Then**: Build agent package (Phase 2)
3. **Finally**: Update frontend (Phase 3)
4. **Optional**: Add WebSocket support for real-time updates
5. **Production**: Consider switching from stdio to HTTP/SSE transport for better scalability

## Error Handling Considerations

- MCP client initialization failures (agent not built, wrong path)
- OpenAI API rate limits and errors
- Convex connection issues
- Stream interruption handling
- Tool execution timeouts

## Security Notes

- Never expose MCP server directly to frontend
- Validate all user inputs before passing to AI
- Implement rate limiting on chat endpoint
- Use environment variables for sensitive data
- Consider authentication for production