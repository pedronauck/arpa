import { useState, useEffect } from 'react';
import type { UIMessage } from 'ai';

export interface SuspendedSession {
  toolName: string;
  sessionId: string;
  currentState: any;
  suspendedStep: any;
  instructions: string;
}

export function useChatSessions(messages: UIMessage[]) {
  const [suspendedSessions, setSuspendedSessions] = useState<Map<string, SuspendedSession>>(new Map());

  // Track suspended sessions from messages
  useEffect(() => {
    const newSuspendedSessions = new Map(suspendedSessions);
    let hasChanges = false;

    messages.forEach(message => {
      if (message.role === 'assistant' && message.parts) {
        message.parts.forEach(part => {
          if (part.type === 'dynamic-tool') {
            const toolPart = part as any;

            // Extract text content from tool output
            let toolOutputText = '';
            if (toolPart.output?.content) {
              toolOutputText = toolPart.output.content
                .filter((item: any) => item.type === 'text')
                .map((item: any) => item.text)
                .join('');
            }

            // Try to parse the output as JSON to check for suspended status
            try {
              if (toolOutputText) {
                const parsedOutput = JSON.parse(toolOutputText);

                // Track suspended sessions
                if (parsedOutput.status === 'suspended' && parsedOutput.sessionId) {
                  if (!newSuspendedSessions.has(parsedOutput.sessionId)) {
                    newSuspendedSessions.set(parsedOutput.sessionId, {
                      toolName: toolPart.toolName,
                      sessionId: parsedOutput.sessionId,
                      currentState: parsedOutput.currentState,
                      suspendedStep: parsedOutput.suspendedStep,
                      instructions: parsedOutput.instructions
                    });
                    hasChanges = true;
                  }
                }
              }
            } catch (e) {
              // Not JSON, continue
            }
          }
        });
      }
    });

    if (hasChanges) {
      setSuspendedSessions(newSuspendedSessions);
    }
  }, [messages]); // Only depend on messages, not suspendedSessions to avoid infinite loop

  return {
    suspendedSessions,
    setSuspendedSessions
  };
}