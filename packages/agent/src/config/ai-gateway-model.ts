/**
 * Vercel AI Gateway Model Configuration
 * Creates MastraLanguageModel instances compatible with Vercel AI Gateway
 * Using OpenAI-compatible API endpoint as per https://vercel.com/docs/ai-gateway/openai-compat
 */

import { createOpenAI } from "@ai-sdk/openai";
import type { MastraLanguageModel } from "@mastra/core";

// Create OpenAI-compatible client for Vercel AI Gateway
// Using the OpenAI-compatible endpoint at https://ai-gateway.vercel.sh/v1
const aiGateway = createOpenAI({
  baseURL: process.env.AI_GATEWAY_URL || "https://ai-gateway.vercel.sh/v1",
  apiKey: process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || process.env.OPENAI_API_KEY || "",
});

/**
 * Get a MastraLanguageModel instance for the given model name
 * Supports models from multiple providers through AI Gateway's OpenAI-compatible API
 */
export function getAIGatewayModel(modelName: string): MastraLanguageModel {
  // Normalize the model name to provider/model format
  let normalizedName = modelName;
  
  // Handle model names that don't include provider prefix
  if (!modelName.includes('/')) {
    const modelMap: Record<string, string> = {
      'gpt-4': 'openai/gpt-4',
      'gpt-4o': 'openai/gpt-4o',
      'gpt-4o-mini': 'openai/gpt-4o-mini',
      'gpt-3.5-turbo': 'openai/gpt-3.5-turbo',
      'gpt-4.1': 'openai/gpt-4o', // Map gpt-4.1 to gpt-4o
      'claude-3-sonnet': 'anthropic/claude-3-sonnet-20240229',
      'claude-3-opus': 'anthropic/claude-3-opus-20240229',
      'claude-sonnet-4': 'anthropic/claude-sonnet-4',
      'claude-3-5-sonnet': 'anthropic/claude-3-5-sonnet-20241022',
      'gemini-pro': 'google/gemini-pro',
      'gemini-1.5-pro': 'google/gemini-1.5-pro',
    };
    
    normalizedName = modelMap[modelName] || `openai/${modelName}`;
  }

  // Return the model instance using the AI Gateway client
  // The AI Gateway handles routing to the correct provider
  return aiGateway(normalizedName) as MastraLanguageModel;
}

/**
 * Create an AI Gateway model with custom configuration
 */
export function createAIGatewayModel(
  modelName: string,
  options?: {
    baseURL?: string;
    apiKey?: string;
    temperature?: number;
    maxTokens?: number;
  }
): MastraLanguageModel {
  const client = createOpenAI({
    baseURL: options?.baseURL || process.env.AI_GATEWAY_URL || "https://ai-gateway.vercel.sh/v1",
    apiKey: options?.apiKey || process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || process.env.OPENAI_API_KEY || "",
  });

  // Normalize model name
  let normalizedName = modelName;
  if (!modelName.includes('/')) {
    const modelMap: Record<string, string> = {
      'gpt-4': 'openai/gpt-4',
      'gpt-4o': 'openai/gpt-4o',
      'gpt-4o-mini': 'openai/gpt-4o-mini',
      'gpt-3.5-turbo': 'openai/gpt-3.5-turbo',
      'gpt-4.1': 'openai/gpt-4o',
      'claude-3-sonnet': 'anthropic/claude-3-sonnet-20240229',
      'claude-3-opus': 'anthropic/claude-3-opus-20240229',
      'claude-sonnet-4': 'anthropic/claude-sonnet-4',
      'claude-3-5-sonnet': 'anthropic/claude-3-5-sonnet-20241022',
      'gemini-pro': 'google/gemini-pro',
      'gemini-1.5-pro': 'google/gemini-1.5-pro',
    };
    
    normalizedName = modelMap[modelName] || `openai/${modelName}`;
  }

  return client(normalizedName) as MastraLanguageModel;
}