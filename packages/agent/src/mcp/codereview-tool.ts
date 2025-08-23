import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { mastra } from "../mastra/index";

// State management for suspended workflow runs
const workflowRuns = new Map<
  string,
  {
    run: any; // Run instance from createRunAsync()
    state: any;
    createdAt: Date;
  }
>();

// Clean up old runs (older than 1 hour)
setInterval(
  () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    for (const [sessionId, runData] of workflowRuns.entries()) {
      if (runData.createdAt < oneHourAgo) {
        workflowRuns.delete(sessionId);
      }
    }
  },
  10 * 60 * 1000
); // Clean up every 10 minutes

// Input schema for the MCP tool
export const codeReviewInputSchema = z.object({
  // Session management
  sessionId: z.string().optional().describe("Session ID for resuming a suspended review"),

  // Initial configuration (for new reviews)
  directory: z.string().optional().describe("Directory to review"),
  relevant_files: z.array(z.string()).optional().describe("Specific files to review"),
  review_type: z.enum(["full", "security", "performance", "quick"]).default("full"),
  focus_on: z.string().optional().describe("Specific aspects to focus on"),
  standards: z.string().optional().describe("Coding standards to enforce"),
  severity_filter: z.enum(["critical", "high", "medium", "low", "all"]).default("all"),

  // Resume data (for continuing reviews)
  step: z.string().optional().describe("Current step description"),
  step_number: z.number().optional().describe("Current step number"),
  total_steps: z.number().optional().describe("Total estimated steps"),
  next_step_required: z.boolean().optional().describe("Whether to continue"),
  findings: z.string().optional().describe("Accumulated findings"),
  confidence: z
    .enum(["exploring", "low", "medium", "high", "very_high", "almost_certain", "certain"])
    .optional(),
  files_checked: z.array(z.string()).optional(),
  relevant_context: z.array(z.string()).optional(),
  issues_found: z
    .array(
      z.object({
        severity: z.enum(["critical", "high", "medium", "low"]),
        description: z.string(),
        file: z.string().optional(),
        line: z.number().optional(),
      })
    )
    .optional(),
});

export type CodeReviewInput = z.infer<typeof codeReviewInputSchema>;

export const codeReviewTool = {
  name: "code_review",
  description:
    "Performs comprehensive code review with step-by-step analysis. Supports suspension and resumption for detailed investigation between steps.",
  inputSchema: zodToJsonSchema(codeReviewInputSchema),

  execute: async (args: CodeReviewInput) => {
    try {
      let sessionId =
        args.sessionId || `review-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      let workflowRun: any; // Run instance
      let isResuming = false;

      // Check if this is a resume operation
      if (args.sessionId && workflowRuns.has(args.sessionId)) {
        const runData = workflowRuns.get(args.sessionId)!;
        workflowRun = runData.run;
        isResuming = true;
      } else {
        // Create a new workflow run through Mastra instance
        const workflow = mastra.getWorkflow("code-review-workflow");
        workflowRun = await workflow.createRunAsync();
        workflowRuns.set(sessionId, {
          run: workflowRun,
          state: null,
          createdAt: new Date(),
        });
      }

      let result;

      if (isResuming && args.step_number && args.step_number > 1) {
        // Resume the workflow with accumulated data
        result = await workflowRun.resume({
          step: ["code-review"], // Use array format for the step path
          resumeData: {
            step: args.step || "",
            step_number: args.step_number,
            total_steps: args.total_steps || 3,
            next_step_required: args.next_step_required !== false,
            findings: args.findings || "",
            confidence: args.confidence || "exploring",
            files_checked: args.files_checked || [],
            relevant_context: args.relevant_context || [],
            issues_found: args.issues_found || [],
            continuation_id: sessionId,
          },
        });
      } else {
        // Start a new review
        result = await workflowRun.start({
          inputData: {
            directory: args.directory || ".",
            relevant_files: args.relevant_files || [],
            review_type: args.review_type,
            focus_on: args.focus_on,
            standards: args.standards,
            severity_filter: args.severity_filter,
            step: "Initial code review assessment",
            step_number: 1,
            total_steps: 3,
            next_step_required: true,
            findings: "",
            confidence: "exploring",
            files_checked: [],
            relevant_context: [],
            issues_found: [],
            review_validation_type: "external",
            models: {
              main: "gpt-4.1",
              expert: "gpt-4.1",
            },
          },
        });
      }

      // Handle the result
      if (result.status === "suspended") {
        // Workflow is suspended
        // Extract the suspended step path
        const suspendedStepPath = result.suspended?.[0] || ["code-review"];

        // Get the actual suspended state from the workflow step
        // The state is stored in the step's suspend data
        const stepState = result.steps?.["code-review"]?.suspendData?.currentState || {};

        // Save the state for resumption
        if (workflowRuns.has(sessionId)) {
          workflowRuns.get(sessionId)!.state = stepState;
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "suspended",
                  sessionId,
                  message:
                    "Code review step completed. Continue with next step by providing findings.",
                  currentState: stepState,
                  suspendedStep: suspendedStepPath,
                  instructions:
                    "Call this tool again with the sessionId and your investigation findings to continue.",
                },
                null,
                2
              ),
            },
          ],
          isError: false,
        };
      } else if (result.status === "completed") {
        // Workflow completed, clean up and return final results
        workflowRuns.delete(sessionId);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "completed",
                  result: result.output,
                  message: "Code review completed successfully.",
                },
                null,
                2
              ),
            },
          ],
          isError: false,
        };
      } else if (result.status === "failed") {
        // Workflow failed
        workflowRuns.delete(sessionId);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "failed",
                  error: result.error || "Unknown error occurred during code review.",
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: result.status,
                  data: result,
                },
                null,
                2
              ),
            },
          ],
          isError: false,
        };
      }
    } catch (error) {
      // Clean up on error
      if (args.sessionId) {
        workflowRuns.delete(args.sessionId);
      }

      return {
        content: [
          {
            type: "text",
            text: `Code review failed: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
};
