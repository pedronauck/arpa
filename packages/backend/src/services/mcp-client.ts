import { experimental_createMCPClient, type experimental_MCPClient } from 'ai';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { validateAIGatewayConfig } from '../config/ai-gateway';

// Properly typed MCP client and tools
let mcpClient: experimental_MCPClient | null = null;
let mcpTools: Record<string, any> | null = null;
let connectionStatus: 'connected' | 'disconnected' | 'connecting' = 'disconnected';

export async function initializeMCPClient() {
  if (mcpClient) return mcpTools;
  
  // Validate AI Gateway configuration
  validateAIGatewayConfig();
  
  connectionStatus = 'connecting';
  
  try {
    // Use Bun's import.meta.dir for path resolution
    const agentPath = path.join(import.meta.dir, '../../../agent/src/mcp/index.ts');
    
    const transport = new StdioClientTransport({
      command: 'bun', // Use bun to run TypeScript directly
      args: [agentPath],
    });
    
    mcpClient = await experimental_createMCPClient({ transport });
    mcpTools = await mcpClient.tools();
    
    connectionStatus = 'connected';
    console.log('MCP client initialized with tools:', mcpTools ? Object.keys(mcpTools) : []);
    return mcpTools;
  } catch (error) {
    connectionStatus = 'disconnected';
    console.error('Failed to initialize MCP client:', error);
    throw error;
  }
}

export async function closeMCPClient() {
  if (mcpClient) {
    await mcpClient.close();
    mcpClient = null;
    mcpTools = null;
    connectionStatus = 'disconnected';
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

// Get connection status
export function getMCPConnectionStatus() {
  return {
    status: connectionStatus,
    hasTools: mcpTools !== null,
    toolCount: mcpTools ? Object.keys(mcpTools).length : 0
  };
}