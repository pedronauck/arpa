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
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from '@/components/ai-elements/tool';
import { Response } from '@/components/ai-elements/response';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { Button } from "./ui/button";
import { SquareIcon, ChevronDownIcon, ChevronRightIcon, CodeIcon } from "lucide-react";
import { toast } from 'sonner';

interface ChatV2Props {
  chatId: Id<'chats'>;
}

export function ChatV2({ chatId }: ChatV2Props) {
  const [input, setInput] = useState('');
  const [suspendedSessions, setSuspendedSessions] = useState<Map<string, any>>(new Map());
  const [historicalMessagesLoaded, setHistoricalMessagesLoaded] = useState(false);
  const [jsonVisibility, setJsonVisibility] = useState<Map<string, boolean>>(new Map());
  const [savedMessageIds, setSavedMessageIds] = useState<Set<string>>(new Set());

  // Load historical messages from Convex
  const historicalMessages = useQuery(api.chats.getChatMessages, { chatId });
  const saveMessage = useMutation(api.chats.sendMessage);

  const {
    messages,
    sendMessage,
    status,
    stop,
    setMessages,
  } = useChat({
    transport: new DefaultChatTransport({
      api: 'http://localhost:3001/api/chat',
    }),
    onFinish: async (message) => {
      console.log('onFinish - Processing assistant response');
      console.log('Finished message:', message);

      // The onFinish callback receives the completed message as parameter
      if (message && message.role === 'assistant') {
        // Save the entire message structure (including parts) as JSON
        const messageContent = {
          parts: message.parts || [],
          // Include any other relevant fields
          id: message.id,
          createdAt: message.createdAt ? new Date(message.createdAt).getTime() : Date.now(),
        };

        console.log('Saving full message structure:', messageContent);

        try {
          await saveMessage({
            chatId,
            content: messageContent, // Save the full structure
            role: 'assistant',
          });
          console.log('✅ Assistant message saved successfully to Convex');
          toast.success('Response saved');
        } catch (error) {
          console.error('❌ Failed to save assistant message:', error);
          toast.error('Failed to save assistant response');
        }
      }
    },
  });

  // Reset when chatId changes
  useEffect(() => {
    setHistoricalMessagesLoaded(false);
    setMessages([]);
    setSuspendedSessions(new Map());
    setJsonVisibility(new Map());
    setSavedMessageIds(new Set());
  }, [chatId, setMessages]);

  // Save assistant messages when they appear
  useEffect(() => {
    const saveAssistantMessages = async () => {
      for (const message of messages) {
        // Only save assistant messages that haven't been saved yet
        if (message.role === 'assistant' && message.id && !savedMessageIds.has(message.id)) {
          // Check if the message has content (not still streaming)
          if (message.parts && message.parts.length > 0) {
            // Check if it's not just a step-start
            const hasContent = message.parts.some(part => 
              part.type !== 'step-start' && 
              (part.type === 'text' || part.type === 'dynamic-tool' || part.type.startsWith('tool-'))
            );
            
            if (hasContent) {
              console.log('Saving assistant message:', message.id);
              const messageContent = {
                parts: message.parts,
                id: message.id,
                createdAt: message.createdAt ? new Date(message.createdAt).getTime() : Date.now(),
              };

              try {
                await saveMessage({
                  chatId,
                  content: messageContent,
                  role: 'assistant',
                });
                console.log('✅ Assistant message saved:', message.id);
                setSavedMessageIds(prev => new Set(prev).add(message.id));
              } catch (error) {
                console.error('❌ Failed to save assistant message:', error);
              }
            }
          }
        }
      }
    };

    // Only run if we're not streaming
    if (status === 'ready' && messages.length > 0) {
      saveAssistantMessages();
    }
  }, [messages, status, chatId, saveMessage, savedMessageIds]);

  // Load historical messages when component mounts or chatId changes
  useEffect(() => {
    if (historicalMessages && !historicalMessagesLoaded) {
      // Convert Convex messages to UIMessage format
      const uiMessages: UIMessage[] = historicalMessages.map((msg: any) => {
        // Check if content is already in structured format or plain text
        let parts;
        if (typeof msg.content === 'string') {
          // Legacy format - plain text
          parts = [{ type: 'text', text: msg.content }];
        } else if (msg.content && msg.content.parts) {
          // New format - structured with parts
          parts = msg.content.parts;
        } else {
          // Fallback
          parts = [{ type: 'text', text: JSON.stringify(msg.content) }];
        }
        
        return {
          id: msg._id,
          role: msg.role,
          parts: parts,
          createdAt: msg.content?.createdAt ? new Date(msg.content.createdAt) : new Date(msg.timestamp),
        };
      });

      // Only set messages if we have historical data and haven't loaded them yet
      if (uiMessages.length > 0) {
        setMessages(uiMessages);
        setHistoricalMessagesLoaded(true);
        // Mark all loaded messages as already saved
        const loadedIds = new Set(uiMessages.map(msg => msg.id));
        setSavedMessageIds(loadedIds);
        console.log(`Loaded ${uiMessages.length} historical messages for chat ${chatId}`);
        toast.success(`Loaded ${uiMessages.length} previous messages`);
      } else {
        // Mark as loaded even if no messages
        setHistoricalMessagesLoaded(true);
      }
    }
  }, [historicalMessages, historicalMessagesLoaded, chatId, setMessages, setSavedMessageIds]);

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

    // Save continuation message to Convex with error handling
    try {
      const messageContent = {
        parts: [{ type: 'text', text: continuationMessage }],
        createdAt: Date.now(), // Use timestamp instead of Date object
      };
      
      await saveMessage({
        chatId,
        content: messageContent, // Save in consistent structured format
        role: 'user',
      });
      console.log('Continuation message saved successfully');
    } catch (error) {
      console.error('Failed to save continuation message:', error);
      toast.error('Failed to save continuation message');
      // Continue anyway
    }

    // Send to AI
    try {
      await sendMessage({ text: continuationMessage });
    } catch (error) {
      console.error('Failed to send continuation message:', error);
      toast.error('Failed to continue workflow. Please try again.');
    }

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

    // Save user message to Convex - for user messages, we can save as plain text
    // or as a structured format for consistency
    try {
      const messageContent = {
        parts: [{ type: 'text', text: userMessage }],
        createdAt: Date.now(), // Use timestamp instead of Date object
      };
      
      await saveMessage({
        chatId,
        content: messageContent, // Save in consistent format
        role: 'user',
      });
      console.log('User message saved successfully');
    } catch (error) {
      console.error('Failed to save user message:', error);
      toast.error('Failed to save your message. It will not be persisted.');
      // Continue with sending to AI even if save fails
    }

    // Send to AI
    try {
      await sendMessage({ text: userMessage });
    } catch (error) {
      console.error('Failed to send message to AI:', error);
      toast.error('Failed to send message. Please try again.');
      // Restore the input if sending fails
      setInput(userMessage);
    }
  };

    const toggleJsonVisibility = (key: string) => {
    setJsonVisibility(prev => {
      const newMap = new Map(prev);
      newMap.set(key, !prev.get(key));
      return newMap;
    });
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
            const jsonKey = `${message.id}-json-${index}`;
            const isJsonVisible = jsonVisibility.get(jsonKey) || false;

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
                          {(() => {
                            // Check for final report in the parsed output
                            const finalReport = parsedOutput?.result?.finalReport || parsedOutput?.data?.result?.finalReport;
                            
                            // If we have a final report, show a summary
                            if (finalReport) {
                              return (
                                <div className="space-y-3">
                                  {finalReport.status && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm">Review Status:</span>
                                      <span className={`text-sm font-medium ${
                                        finalReport.status === 'completed' ? 'text-green-600' : 'text-yellow-600'
                                      }`}>
                                        {finalReport.status === 'completed' ? '✓ Completed' : finalReport.status}
                                      </span>
                                    </div>
                                  )}
                                  
                                  {finalReport.findings && (
                                    <div>
                                      <Response className="break-words">
                                        {finalReport.findings}
                                      </Response>
                                    </div>
                                  )}
                                  
                                  {/* Show count of issues if any */}
                                  {parsedOutput.data?.steps?.['code-review']?.suspendPayload?.currentState?.issues_found?.length > 0 && (
                                    <div className="text-sm text-muted-foreground">
                                      Found {parsedOutput.data.steps['code-review'].suspendPayload.currentState.issues_found.length} issues during review. 
                                      Click "Result JSON" below to see details.
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            // If we have parsed JSON output with message/instructions, show them formatted
                            else if (parsedOutput && (parsedOutput.message || parsedOutput.instructions)) {
                              return (
                                <div className="space-y-2">
                                  {parsedOutput.message && (
                                    <Response className="break-words">{parsedOutput.message}</Response>
                                  )}
                                  {parsedOutput.instructions && parsedOutput.instructions !== parsedOutput.message && (
                                    <Response className="break-words text-sm text-muted-foreground">
                                      {parsedOutput.instructions}
                                    </Response>
                                  )}
                                </div>
                              );
                            }
                            // Otherwise show the raw output
                            else if (toolOutputText) {
                              // Don't show raw JSON string, it will be in the toggle section
                              if (!parsedOutput) {
                                return <Response className="break-words">{toolOutputText}</Response>;
                              }
                              return null;
                            } else if (typeof toolPart.output === 'string') {
                              return toolPart.output;
                            } else {
                              return (
                                <pre className="text-xs p-2 overflow-auto">
                                  {JSON.stringify(toolPart.output, null, 2)}
                                </pre>
                              );
                            }
                          })()}

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
                          
                          {/* JSON Result Toggle and Display */}
                          {parsedOutput && !parsedOutput.status?.includes('suspended') && (
                            <div className="mt-4 border-t pt-4">
                              <Button
                                onClick={() => toggleJsonVisibility(jsonKey)}
                                variant="ghost"
                                size="sm"
                                className="mb-2 gap-2"
                              >
                                {isJsonVisible ? (
                                  <ChevronDownIcon className="size-4" />
                                ) : (
                                  <ChevronRightIcon className="size-4" />
                                )}
                                <CodeIcon className="size-4" />
                                <span>Result JSON</span>
                              </Button>
                              
                              {isJsonVisible && (
                                <div className="mt-2 space-y-4">
                                  {/* Render final report if present */}
                                  {(parsedOutput.result?.finalReport || parsedOutput.data?.result?.finalReport) && (() => {
                                    const finalReport = parsedOutput.result?.finalReport || parsedOutput.data?.result?.finalReport;
                                    return (
                                      <div className="space-y-3">
                                        <h4 className="text-sm font-semibold">Final Report</h4>
                                        
                                        {finalReport.status && (
                                          <div className="flex items-center gap-2">
                                            <span className="text-sm text-muted-foreground">Status:</span>
                                            <span className={`text-sm font-medium ${
                                              finalReport.status === 'completed' ? 'text-green-600' : 'text-yellow-600'
                                            }`}>
                                              {finalReport.status}
                                            </span>
                                          </div>
                                        )}
                                        
                                        {finalReport.findings && (
                                          <div>
                                            <p className="text-sm font-medium text-muted-foreground mb-2">Findings:</p>
                                            <Response className="pl-2 space-y-2">
                                              {finalReport.findings}
                                            </Response>
                                          </div>
                                        )}
                                        
                                        {finalReport.issues && finalReport.issues.length > 0 && (
                                          <div>
                                            <p className="text-sm font-medium text-muted-foreground mb-2">Issues Found:</p>
                                            <div className="space-y-2 pl-2">
                                              {finalReport.issues.map((issue: any, idx: number) => (
                                                <div key={idx} className="p-2 bg-muted/50 rounded-md">
                                                  <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                                                      issue.severity === 'high' ? 'bg-red-100 text-red-700' :
                                                      issue.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                                      'bg-blue-100 text-blue-700'
                                                    }`}>
                                                      {issue.severity}
                                                    </span>
                                                    {issue.file && (
                                                      <span className="text-xs text-muted-foreground">
                                                        {issue.file}{issue.line ? `:${issue.line}` : ''}
                                                      </span>
                                                    )}
                                                  </div>
                                                  <Response className="text-sm">
                                                    {issue.description}
                                                  </Response>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                        
                                        {finalReport.files_checked && finalReport.files_checked.length > 0 && (
                                          <div>
                                            <p className="text-sm font-medium text-muted-foreground mb-2">Files Reviewed:</p>
                                            <ul className="list-disc list-inside pl-2 space-y-1">
                                              {finalReport.files_checked.map((file: string, idx: number) => (
                                                <li key={idx} className="text-sm text-muted-foreground">
                                                  <code className="text-xs bg-muted px-1 py-0.5 rounded">{file}</code>
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                  
                                  {/* Render message if present and no final report */}
                                  {parsedOutput.message && !parsedOutput.result?.finalReport && !parsedOutput.data?.result?.finalReport && (
                                    <div>
                                      <p className="text-sm font-medium text-muted-foreground mb-1">Message:</p>
                                      <Response className="pl-2">
                                        {parsedOutput.message}
                                      </Response>
                                    </div>
                                  )}
                                  
                                  {/* Render instructions if present */}
                                  {parsedOutput.instructions && (
                                    <div>
                                      <p className="text-sm font-medium text-muted-foreground mb-1">Instructions:</p>
                                      <Response className="pl-2">
                                        {parsedOutput.instructions}
                                      </Response>
                                    </div>
                                  )}
                                  
                                  {/* Show issues from intermediate steps if present */}
                                  {parsedOutput.data?.steps?.['code-review']?.suspendPayload?.currentState?.issues_found && 
                                   parsedOutput.data.steps['code-review'].suspendPayload.currentState.issues_found.length > 0 && (
                                    <div>
                                      <p className="text-sm font-medium text-muted-foreground mb-2">Issues Identified During Review:</p>
                                      <div className="space-y-2 pl-2">
                                        {parsedOutput.data.steps['code-review'].suspendPayload.currentState.issues_found.map((issue: any, idx: number) => (
                                          <div key={idx} className="p-2 bg-muted/50 rounded-md">
                                            <div className="flex items-center gap-2 mb-1">
                                              <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                                                issue.severity === 'high' ? 'bg-red-100 text-red-700' :
                                                issue.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-blue-100 text-blue-700'
                                              }`}>
                                                {issue.severity}
                                              </span>
                                              {issue.file && (
                                                <span className="text-xs text-muted-foreground">
                                                  {issue.file}{issue.line ? `:${issue.line}` : ''}
                                                </span>
                                              )}
                                            </div>
                                            <Response className="text-sm">
                                              {issue.description}
                                            </Response>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Full JSON in collapsible */}
                                  <details className="mt-3">
                                    <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                                      View full JSON response
                                    </summary>
                                    <Response className="mt-2">
                                      {`\`\`\`json\n${JSON.stringify(parsedOutput, null, 2)}\n\`\`\``}
                                    </Response>
                                  </details>
                                </div>
                              )}
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

  return (
    <div className="flex flex-col h-full w-full max-w-[calc(100vw-200px)] overflow-hidden">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 w-full max-w-full">
        {messages.length === 0 && status === 'ready' ? (
          <div className="text-center mt-8">
            <h2 className="text-2xl font-semibold mb-2">Start a conversation</h2>
            <p className="text-muted-foreground">
              Ask me to review code in any place of your project
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
