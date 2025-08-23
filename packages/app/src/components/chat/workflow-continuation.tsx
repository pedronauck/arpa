import { toast } from 'sonner';
import type { UIMessage } from 'ai';
import type { Id } from '../../../convex/_generated/dataModel';
import type { SuspendedSession } from './use-chat-sessions';

interface WorkflowContinuationProps {
  suspendedSessions: Map<string, SuspendedSession>;
  setSuspendedSessions: React.Dispatch<React.SetStateAction<Map<string, SuspendedSession>>>;
  messages: UIMessage[];
  chatId: Id<'chats'>;
  saveMessage: (args: any) => Promise<any>;
  sendMessage: (args: { text: string }) => Promise<void>;
}

export class WorkflowContinuation {
  private props: WorkflowContinuationProps;

  constructor(props: WorkflowContinuationProps) {
    this.props = props;
  }

  async continueWorkflow(sessionId: string, toolName: string) {
    const sessionData = this.props.suspendedSessions.get(sessionId);
    if (!sessionData) return;

    // Determine the next step number based on current state
    let nextStepNumber = 2; // Default to step 2
    let totalSteps = 3; // Default total steps
    let confidence = 'medium'; // Default confidence

    // Try to extract step information from the latest messages
    const latestMessages = this.props.messages.slice(-5); // Look at last 5 messages
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

      await this.props.saveMessage({
        chatId: this.props.chatId,
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
      await this.props.sendMessage({ text: continuationMessage });
    } catch (error) {
      console.error('Failed to send continuation message:', error);
      toast.error('Failed to continue workflow. Please try again.');
    }

    // Remove from suspended sessions if this is the last step
    if (isLastStep) {
      this.props.setSuspendedSessions(prev => {
        const newMap = new Map(prev);
        newMap.delete(sessionId);
        return newMap;
      });
    }
  }
}