/**
 * Vercel AI Gateway Configuration
 * 
 * This module provides utilities for configuring the Vercel AI Gateway
 * which provides a unified API to access multiple LLM providers.
 */

export interface AIGatewayConfig {
  baseURL?: string;
  apiKey?: string;
}

/**
 * Get AI Gateway configuration from environment variables
 */
export function getAIGatewayConfig(): AIGatewayConfig {
  const config: AIGatewayConfig = {};

  // Use Vercel API token if provided
  if (process.env.VERCEL_API_TOKEN) {
    config.apiKey = process.env.VERCEL_API_TOKEN;
  }

  // Custom base URL if needed (defaults to Vercel AI Gateway)
  if (process.env.AI_GATEWAY_BASE_URL) {
    config.baseURL = process.env.AI_GATEWAY_BASE_URL;
  }

  return config;
}

/**
 * Normalize model names to AI Gateway format (provider/model)
 */
export function normalizeModelName(modelName: string): string {
  // Handle already formatted names - just return them as-is for AI Gateway
  if (modelName.includes('/')) {
    return modelName;
  }

  // Map common model names to AI Gateway format
  const modelMap: Record<string, string> = {
    'gpt-4': 'openai/gpt-4',
    'gpt-4o': 'openai/gpt-4o',
    'gpt-4o-mini': 'openai/gpt-4o-mini',
    'gpt-3.5-turbo': 'openai/gpt-3.5-turbo',
    'claude-3-sonnet': 'anthropic/claude-3-sonnet-20240229',
    'claude-3-opus': 'anthropic/claude-3-opus-20240229',
    'claude-sonnet-4': 'anthropic/claude-sonnet-4',
    'claude-3-5-sonnet': 'anthropic/claude-3-5-sonnet-20241022',
    'gemini-pro': 'google/gemini-pro',
    'gemini-1.5-pro': 'google/gemini-1.5-pro',
  };

  return modelMap[modelName] || `openai/${modelName}`;
}

/**
 * Validate required environment variables for AI Gateway
 */
export function validateAIGatewayConfig(): void {
  if (!process.env.VERCEL_API_TOKEN) {
    throw new Error(
      'VERCEL_API_TOKEN environment variable is required for AI Gateway. ' +
      'Please set this to your Vercel API token.'
    );
  }
}