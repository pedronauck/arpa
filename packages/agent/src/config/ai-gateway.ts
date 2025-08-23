/**
 * Vercel AI Gateway Configuration for Mastra Agent
 */

/**
 * Normalize model names to AI Gateway format (provider/model)
 */
export function normalizeModelName(modelName: string): string {
  // Handle already formatted names
  if (modelName.includes('/')) {
    return modelName;
  }

  // Map common model names to AI Gateway format
  const modelMap: Record<string, string> = {
    'gpt-4': 'openai/gpt-4',
    'gpt-4o': 'openai/gpt-4o',
    'gpt-4o-mini': 'openai/gpt-4o-mini',
    'gpt-3.5-turbo': 'openai/gpt-3.5-turbo',
    'gpt-4.1': 'openai/gpt-4o', // Map gpt-4.1 to gpt-4o
    'claude-3-sonnet': 'anthropic/claude-3-sonnet-20240229',
    'claude-3-opus': 'anthropic/claude-3-opus-20240229',
    'claude-sonnet-4': 'anthropic/claude-sonnet-4',
    'gemini-pro': 'google/gemini-pro',
    'gemini-1.5-pro': 'google/gemini-1.5-pro',
  };

  return modelMap[modelName] || `openai/${modelName}`;
}