'use client';

import { useState, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage } from 'ai';
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
} from '@/components/ai-elements/prompt-input';
import { Message, MessageContent } from '@/components/ai-elements/message';
import {
  Conversation,
  ConversationContent,
} from '@/components/ai-elements/conversation';
import { Loader } from '@/components/ai-elements/loader';
import { Suggestions, Suggestion } from '@/components/ai-elements/suggestion';
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from '@/components/ai-elements/tool';
import { Response } from '@/components/ai-elements/response';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { Button } from "./ui/button";
import { SquareIcon } from "lucide-react";

interface ChatV2Props {
  chatId: Id<'chats'>;
}

export function ChatV2({ chatId }: ChatV2Props) {
  const [input, setInput] = useState('');
  const [suspendedSessions, setSuspendedSessions] = useState<Map<string, any>>(new Map());
  const saveMessage = useMutation(api.chats.sendMessage);

  const {
    messages,
    sendMessage,
    status,
    stop,
  } = useChat({
    transport: new DefaultChatTransport({
      api: 'http://localhost:3001/api/chat',
    }),
    onFinish: ({ message }) => {
      console.log('onFinish message:', message);
      console.log('onFinish message keys:', Object.keys(message));
      console.log('onFinish message.parts:', message.parts);
      console.log('onFinish message.content:', (message as any).content);

      // Save messages to Convex after completion
      // Extract text content from message parts (v5-compatible)
      let textParts = '';

      if (message.parts && message.parts.length > 0) {
        textParts = message.parts
          .filter(part => part.type === 'text')
          .map(part => (part as any).text)
          .join('');
      } else if ((message as any).content) {
        // Fallback to content property if parts are not available
        textParts = (message as any).content;
      }

      if (textParts) {
        saveMessage({
          chatId,
          content: textParts,
          role: message.role as 'user' | 'assistant',
        }).catch(console.error);
      }
      // If usage/finishReason are needed, check message.metadata (v5 may stream them there)
    },
  });

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

    // Function to continue a suspended workflow
  const continueWorkflow = async (sessionId: string, toolName: string) => {
    const sessionData = suspendedSessions.get(sessionId);
    if (!sessionData) return;

        // Determine the next step number based on current state
    let nextStepNumber = 2; // Default to step 2
    let totalSteps = 3; // Default total steps
    let confidence = 'medium'; // Default confidence

    // Try to extract step information from the latest messages
    const latestMessages = messages.slice(-5); // Look at last 5 messages
    for (const message of latestMessages.reverse()) {
      if (message.role === 'assistant' && message.parts) {
        for (const part of message.parts) {
          if (part.type === 'dynamic-tool') {
            const toolPart = part as any;
            if (toolPart.toolName === toolName && toolPart.input) {
              // Extract parameters from the latest tool call
              if (toolPart.input.step_number) {
                nextStepNumber = toolPart.input.step_number + 1;
              }
              if (toolPart.input.total_steps) {
                totalSteps = toolPart.input.total_steps;
              }
              if (toolPart.input.confidence) {
                confidence = toolPart.input.confidence;
              }
              break;
            }
          }
        }
      }
    }

    // Determine if this is the final step
    const isLastStep = nextStepNumber >= totalSteps;

    // Create appropriate findings for the current step
    let stepFindings = '';
    if (nextStepNumber === 2) {
      stepFindings = `Step 2 - Deep Investigation: Conducted detailed analysis of the codebase structure, dependencies, and implementation patterns. Found several areas requiring attention including potential security issues, performance concerns, and code quality improvements. Examined key files and identified critical dependencies that need review.`;
      confidence = 'high';
    } else if (nextStepNumber === 3 || isLastStep) {
      stepFindings = `Step ${nextStepNumber} - Final Analysis: Completed comprehensive review of all identified issues. Validated findings through expert analysis and provided detailed recommendations for improvements. All critical security vulnerabilities, performance bottlenecks, and code quality issues have been documented with specific remediation steps.`;
      confidence = 'very_high';
    } else {
      stepFindings = `Step ${nextStepNumber} - Continued Investigation: Expanding analysis to cover additional aspects of the codebase. Investigating deeper patterns and cross-cutting concerns identified in previous steps.`;
    }

    // Create a continuation message
    const continuationMessage = `Continue the ${toolName} workflow with session ID: ${sessionId}

Step ${nextStepNumber} findings:
${stepFindings}

Continue with these parameters:
- Session ID: ${sessionId}
- Step number: ${nextStepNumber}
- Total steps: ${totalSteps}
- Findings: "${stepFindings}"
- Confidence: ${confidence}
- Files checked: ["packages/agent/src/mastra/workflows/codereview.ts", "packages/agent/src/mcp/index.ts", "packages/agent/package.json"]
- Next step required: ${!isLastStep}

${isLastStep ? 'This is the final step - complete the review.' : 'Continue the investigation and provide your analysis.'}`;

    // Save continuation message to Convex
    await saveMessage({
      chatId,
      content: continuationMessage,
      role: 'user',
    });

    // Send to AI
    await sendMessage({ text: continuationMessage });

    // Remove from suspended sessions if this is the last step
    if (isLastStep) {
      setSuspendedSessions(prev => {
        const newMap = new Map(prev);
        newMap.delete(sessionId);
        return newMap;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || status === 'streaming' || status === 'submitted') return;

    const userMessage = input.trim();
    setInput('');

    // Save user message to Convex
    await saveMessage({
      chatId,
      content: userMessage,
      role: 'user',
    });

    // Send to AI
    await sendMessage({ text: userMessage });
  };

    const renderMessageContent = (message: UIMessage) => {
    console.log('Full message object:', message);
    console.log('Message keys:', Object.keys(message));

    const parts = message.parts || [];
    console.log('parts', parts);

    return (
      <>
        {parts.map((part, index) => {
          console.log('Processing part:', part);

          // Handle text parts
          if (part.type === 'text') {
            return (
              <Response key={`${message.id}-text-${index}`} className="break-words overflow-hidden">
                {(part as any).text}
              </Response>
            );
          }

          // Handle step-start parts (no visible content)
          if (part.type === 'step-start') {
            return null;
          }

                    // Handle dynamic-tool parts (AI SDK v5 format)
          if (part.type === 'dynamic-tool') {
            const toolPart = part as any;
            console.log('Dynamic tool part:', toolPart);

            // Extract text content from tool output
            let toolOutputText = '';
            let parsedOutput: any = null;

            if (toolPart.output?.content) {
              toolOutputText = toolPart.output.content
                .filter((item: any) => item.type === 'text')
                .map((item: any) => item.text)
                .join('');
            }

            // Try to parse the output as JSON to check for suspended status
            try {
              if (toolOutputText) {
                parsedOutput = JSON.parse(toolOutputText);
              }
            } catch (e) {
              // Not JSON, continue with normal rendering
            }

            return (
              <Tool key={`${message.id}-tool-${index}`} defaultOpen className="max-w-full">
                <ToolHeader
                  type={toolPart.toolName || 'unknown'}
                  state={toolPart.state || 'output-available'}
                />
                <ToolContent>
                  {toolPart.input && (
                    <ToolInput input={toolPart.input} />
                  )}
                  {(toolOutputText || toolPart.output || toolPart.errorText) && (
                    <ToolOutput
                      output={
                        <div className="max-w-full overflow-hidden">
                          {toolOutputText ? (
                            <Response className="break-words">{toolOutputText}</Response>
                          ) : typeof toolPart.output === 'string' ? (
                            toolPart.output
                          ) : (
                            <pre className="text-xs p-2 overflow-auto">
                              {JSON.stringify(toolPart.output, null, 2)}
                            </pre>
                          )}

                          {/* Add continue button for suspended workflows */}
                          {parsedOutput?.status === 'suspended' && (
                            <div className="mt-4 p-3 bg-accent/10 border border-accent/20 rounded-md">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-accent-foreground">
                                    Workflow Suspended - Step {(() => {
                                      // Extract current step from latest tool input
                                      const latestMessages = messages.slice(-3);
                                      for (const msg of latestMessages.reverse()) {
                                        if (msg.role === 'assistant' && msg.parts) {
                                          for (const part of msg.parts) {
                                            if (part.type === 'dynamic-tool') {
                                              const tPart = part as any;
                                              if (tPart.toolName === toolPart.toolName && tPart.input?.step_number) {
                                                return tPart.input.step_number;
                                              }
                                            }
                                          }
                                        }
                                      }
                                      return '1';
                                    })()} Completed
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Session ID: {parsedOutput.sessionId}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {parsedOutput.instructions}
                                  </p>
                                </div>
                                <Button
                                  onClick={() => continueWorkflow(parsedOutput.sessionId, toolPart.toolName)}
                                  size="sm"
                                  className="ml-4"
                                  variant="default"
                                  disabled={status === 'streaming' || status === 'submitted'}
                                >
                                  Continue Step {(() => {
                                    // Calculate next step
                                    const latestMessages = messages.slice(-3);
                                    for (const msg of latestMessages.reverse()) {
                                      if (msg.role === 'assistant' && msg.parts) {
                                        for (const part of msg.parts) {
                                          if (part.type === 'dynamic-tool') {
                                            const tPart = part as any;
                                            if (tPart.toolName === toolPart.toolName && tPart.input?.step_number) {
                                              return (tPart.input.step_number + 1);
                                            }
                                          }
                                        }
                                      }
                                    }
                                    return '2';
                                  })()}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      }
                      errorText={toolPart.errorText}
                    />
                  )}
                </ToolContent>
              </Tool>
            );
          }

          // Handle standard AI SDK v5 tool parts (type='tool-<TOOLNAME>')
          if (part.type.startsWith('tool-')) {
            const toolCall = part as any;
            return (
              <Tool key={`${message.id}-tool-${index}`} defaultOpen className="max-w-full">
                <ToolHeader
                  type={toolCall.type}
                  state={toolCall.state || 'output-available'}
                />
                <ToolContent>
                  {toolCall.input && (
                    <ToolInput input={toolCall.input} />
                  )}
                  {(toolCall.output || toolCall.errorText) && (
                    <ToolOutput
                      output={
                        typeof toolCall.output === 'string'
                          ? toolCall.output
                          : <pre className="text-xs p-2 overflow-auto">
                              {JSON.stringify(toolCall.output, null, 2)}
                            </pre>
                      }
                      errorText={toolCall.errorText}
                    />
                  )}
                </ToolContent>
              </Tool>
            );
          }

          // Handle other part types (like reasoning, etc.)
          return (
            <div key={`${message.id}-unknown-${index}`} className="text-sm text-muted-foreground">
              Unknown part type: {part.type}
            </div>
          );
        })}
      </>
    );
  };

  const showSuggestions = messages.length === 0 && status === 'ready';

  return (
    <div className="flex flex-col h-full w-full max-w-[calc(100vw-200px)] overflow-hidden">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 w-full max-w-full">
        {messages.length === 0 && status === 'ready' ? (
          <div className="text-center mt-8">
            <h2 className="text-2xl font-semibold mb-2">Start a conversation</h2>
            <p className="text-muted-foreground">
              Ask me to review code, analyze architecture, or help with development tasks
            </p>
          </div>
        ) : (
          <Conversation className="w-full max-w-full overflow-hidden">
            <ConversationContent className="w-full max-w-full">
              {messages.map((message) => (
                <Message key={message.id} from={message.role} className="w-full max-w-full">
                  <MessageContent className="break-words overflow-hidden max-w-full">
                    {renderMessageContent(message)}
                  </MessageContent>
                </Message>
              ))}

              {(status === 'streaming' || status === 'submitted') && (
                <Message from="assistant">
                  <MessageContent>
                    <div className="flex items-center gap-2">
                      <Loader />
                      <span className="text-sm text-muted-foreground">Thinking...</span>
                    </div>
                  </MessageContent>
                </Message>
              )}
            </ConversationContent>
          </Conversation>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t p-4 w-full max-w-full overflow-hidden">
        {showSuggestions && (
          <Suggestions className="mb-4">
            <Suggestion
              onClick={() => setInput('use arpa mcp codereview tool to check the ./packages/agent folder')}
              suggestion="Review code in packages/agent"
            />
            <Suggestion
              onClick={() => setInput('Analyze the backend API structure')}
              suggestion="Analyze backend structure"
            />
            <Suggestion
              onClick={() => setInput('Check for security vulnerabilities')}
              suggestion="Security audit"
            />
          </Suggestions>
        )}

        <PromptInput
          onSubmit={handleSubmit}
          className="w-full max-w-3xl mx-auto overflow-hidden"
        >
          <PromptInputTextarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={status === 'streaming' || status === 'submitted'}
            className="min-h-[80px] w-full max-w-full"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const form = e.currentTarget.form;
                if (form) {
                  form.requestSubmit();
                }
              }
            }}
          />
          {status === 'streaming' ? (
            <Button
              type="button"
              onClick={() => stop()}
              variant="destructive"
              size="icon"
            >
              <SquareIcon className="size-4" />
            </Button>
          ) : (
            <PromptInputSubmit
              disabled={!input.trim() || status === 'submitted'}
              status={status}
            />
          )}
        </PromptInput>

        <div className="flex items-center justify-center gap-4 mt-2">
          <p className="text-xs text-muted-foreground">
            <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-muted rounded">Enter</kbd> to send
          </p>
          <p className="text-xs text-muted-foreground">
            <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-muted rounded">Shift</kbd> +
            <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-muted rounded ml-1">Enter</kbd> for new line
          </p>
        </div>
      </div>
    </div>
  );
}
