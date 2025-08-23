import { Hono } from 'hono';
import { streamText, convertToModelMessages } from 'ai';
import { ensureMCPConnection } from '../services/mcp-client';
import { normalizeModelName, validateAIGatewayConfig } from '../config/ai-gateway';

const chat = new Hono();

chat.post('/chat', async (c) => {
  // Validate AI Gateway configuration
  try {
    validateAIGatewayConfig();
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'AI Gateway configuration error' }, 500);
  }

  const { messages } = await c.req.json();

  // Convert messages to UIMessage format if needed
  const uiMessages = messages.map((msg: any) => {
    // If already in UIMessage format with parts, use as-is
    if (msg.parts) return msg;

    // Convert simple format to UIMessage format
    return {
      id: msg.id || crypto.randomUUID(),
      role: msg.role,
      parts: [{ type: 'text', text: msg.content }]
    };
  });

  // Convert UIMessages to ModelMessages format
  const modelMessages = convertToModelMessages(uiMessages);

  // Ensure MCP connection with recovery
  const tools = await ensureMCPConnection();

  if (!tools) {
    return c.json({ error: 'MCP tools not available' }, 503);
  }

  // Log tools to verify they're properly formatted
  console.log('Available tools:', Object.keys(tools));

  try {
    const response = streamText({
      model: normalizeModelName('claude-sonnet-4'),
      messages: modelMessages,
      tools,
      system: "You are an AI assistant with code review capabilities via MCP tools. When asked to review code, use the code_review tool to perform the review.",
    });

    // Return the UI message stream response directly
    // The AI SDK handles all necessary headers internally
    return response.toUIMessageStreamResponse();
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
