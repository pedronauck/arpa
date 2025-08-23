import { experimental_createMCPClient, type experimental_MCPClient } from 'ai';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { validateAIGatewayConfig } from '../config/ai-gateway';

// Properly typed MCP client and tools
let mcpClient: experimental_MCPClient | null = null;
let mcpTools: Record<string, any> | null = null;

export async function initializeMCPClient() {
  if (mcpClient) return mcpTools;
  
  // Validate AI Gateway configuration
  validateAIGatewayConfig();
  
  try {
    // Use Bun's import.meta.dir for path resolution
    const agentPath = path.join(import.meta.dir, '../../../agent/src/mcp/index.ts');
    
    const transport = new StdioClientTransport({
      command: 'bun', // Use bun to run TypeScript directly
      args: [agentPath],
    });
    
    mcpClient = await experimental_createMCPClient({ transport });
    mcpTools = await mcpClient.tools();
    
    console.log('MCP client initialized with tools:', mcpTools ? Object.keys(mcpTools) : []);
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