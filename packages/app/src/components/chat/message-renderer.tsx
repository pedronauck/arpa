'use client';

import { useState } from 'react';
import type { UIMessage, ChatStatus } from 'ai';
import { Button } from '@/components/ui/button';
import { ChevronDownIcon, ChevronRightIcon, CodeIcon } from 'lucide-react';
import { Response } from '@/components/ai-elements/response';
import { FinalReport } from '@/components/ai-elements/final-report';
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from '@/components/ai-elements/tool';
import type { WorkflowContinuation } from './workflow-continuation';

interface MessageRendererProps {
  message: UIMessage;
  messages: UIMessage[];
  status: ChatStatus;
  workflowContinuation: WorkflowContinuation;
}

export function MessageRenderer({ 
  message, 
  messages,
  status,
  workflowContinuation 
}: MessageRendererProps) {
  const [jsonVisibility, setJsonVisibility] = useState<Map<string, boolean>>(new Map());
  
  const toggleJsonVisibility = (key: string) => {
    setJsonVisibility(prev => {
      const newMap = new Map(prev);
      newMap.set(key, !prev.get(key));
      return newMap;
    });
  };

  const parts = message.parts || [];
  const finalReports: any[] = [];

  return (
    <>
      {parts.map((part, index) => {
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

          // Try to parse the output as JSON
          try {
            if (toolOutputText) {
              parsedOutput = JSON.parse(toolOutputText);
            }
          } catch (e) {
            // Not JSON, continue with normal rendering
          }

          // Extract final report if present
          const finalReport = parsedOutput?.result?.finalReport || parsedOutput?.data?.result?.finalReport;
          if (finalReport) {
            // Get intermediate issues from suspend payload
            const intermediateIssues = parsedOutput?.data?.steps?.['code-review']?.suspendPayload?.currentState?.issues_found || [];
            const intermediateContext = parsedOutput?.data?.steps?.['code-review']?.suspendPayload?.currentState?.relevant_context || [];

            // Get workflow data
            const workflowData = {
              startedAt: parsedOutput?.data?.steps?.['code-review']?.startedAt,
              endedAt: parsedOutput?.data?.steps?.['code-review']?.endedAt,
              suspendedAt: parsedOutput?.data?.steps?.['code-review']?.suspendedAt,
              resumedAt: parsedOutput?.data?.steps?.['code-review']?.resumedAt,
              continuation_id: parsedOutput?.data?.steps?.['code-review']?.suspendPayload?.currentState?.continuation_id,
              review_type: parsedOutput?.data?.steps?.input?.review_type || parsedOutput?.data?.steps?.['code-review']?.payload?.review_type,
              directory: parsedOutput?.data?.steps?.input?.directory || parsedOutput?.data?.steps?.['code-review']?.payload?.directory,
              models: parsedOutput?.data?.steps?.input?.models || parsedOutput?.data?.steps?.['code-review']?.payload?.models,
              steps: parsedOutput?.data?.steps
            };

            // Store it for rendering after the tool output
            finalReports.push({
              ...finalReport,
              relevant_context: [...(finalReport.relevant_context || []), ...intermediateContext],
              intermediate_issues: intermediateIssues,
              workflow_data: workflowData
            });
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
                          // Don't show final report here - it will be rendered separately
                          if (finalReport) {
                            return (
                              <div className="text-sm text-muted-foreground">
                                Review completed. See the report below for details.
                              </div>
                            );
                          }
                          // If we have parsed JSON output with message/instructions
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

                        {/* Continue button for suspended workflows */}
                        {parsedOutput?.status === 'suspended' && (
                          <div className="mt-4 p-3 bg-accent/10 border border-accent/20 rounded-md">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-accent-foreground">
                                  Workflow Suspended - Step {getStepNumber()} Completed
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Session ID: {parsedOutput.sessionId}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {parsedOutput.instructions}
                                </p>
                              </div>
                              <Button
                                onClick={() => workflowContinuation.continueWorkflow(parsedOutput.sessionId, toolPart.toolName)}
                                size="sm"
                                className="ml-4"
                                variant="primary"
                                disabled={status === 'streaming' || status === 'submitted'}
                              >
                                Continue Step {getNextStepNumber()}
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* JSON Result Toggle */}
                        {parsedOutput && !parsedOutput.status?.includes('suspended') && !finalReport && (
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
                                {parsedOutput.message && (
                                  <div>
                                    <p className="text-sm font-medium text-muted-foreground mb-1">Message:</p>
                                    <Response className="pl-2">
                                      {parsedOutput.message}
                                    </Response>
                                  </div>
                                )}

                                {parsedOutput.instructions && (
                                  <div>
                                    <p className="text-sm font-medium text-muted-foreground mb-1">Instructions:</p>
                                    <Response className="pl-2">
                                      {parsedOutput.instructions}
                                    </Response>
                                  </div>
                                )}

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

          function getStepNumber() {
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
          }

          function getNextStepNumber() {
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
          }
        }

        // Handle standard AI SDK v5 tool parts
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

        // Handle other part types
        return (
          <div key={`${message.id}-unknown-${index}`} className="text-sm text-muted-foreground">
            Unknown part type: {part.type}
          </div>
        );
      })}

      {/* Render Final Reports after all tool outputs */}
      {finalReports.map((report, idx) => (
        <FinalReport
          key={`${message.id}-final-report-${idx}`}
          status={report.status}
          findings={report.findings}
          issues={report.issues}
          files_checked={report.files_checked}
          confidence={report.confidence}
          relevant_context={report.relevant_context}
          workflow_data={report.workflow_data}
          intermediate_issues={report.intermediate_issues}
        />
      ))}
    </>
  );
}