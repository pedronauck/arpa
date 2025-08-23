import { Agent, createTool } from "@mastra/core";
import { RuntimeContext } from "@mastra/core/runtime-context";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { LibSQLStore } from "@mastra/libsql";
import { Memory } from "@mastra/memory";
import { exec } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import { getAIGatewayModel } from "../../config/ai-gateway-model";

const execAsync = promisify(exec);

// Helper function to clean JSON from markdown code blocks
function cleanJsonResponse(text: string): string {
  if (!text) return "";

  // Remove markdown code blocks
  let cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "");
  // Also handle generic code blocks
  cleaned = cleaned.replace(/^```.*$/gm, "");
  // Trim whitespace
  cleaned = cleaned.trim();

  // Try to extract JSON object if text contains other content
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }

  // Attempt to fix common JSON issues
  // Fix trailing commas
  cleaned = cleaned.replace(/,(\s*[}\]])/g, "$1");

  // Check if JSON is incomplete and try to complete it
  const openBraces = (cleaned.match(/\{/g) || []).length;
  const closeBraces = (cleaned.match(/\}/g) || []).length;
  if (openBraces > closeBraces) {
    // Add missing closing braces
    cleaned += "}".repeat(openBraces - closeBraces);
  }

  return cleaned;
}

// Get the project root (4 levels up from this file)
const PROJECT_ROOT = path.resolve(__dirname, '../../../../..');

// File Tools for Agents
const listFilesTool = createTool({
  id: "list_files",
  description: "List files in a directory recursively.",
  inputSchema: z.object({
    dir: z.string().describe("The directory path to list files from"),
  }),
  execute: async ({ context }) => {
    const { dir } = context;
    // Resolve the directory path relative to project root
    const resolvedDir = path.isAbsolute(dir) ? dir : path.join(PROJECT_ROOT, dir);

    // Check if the directory exists
    try {
      await fs.access(resolvedDir);
    } catch (error) {
      // Provide helpful error message for common mistakes
      if (dir.startsWith('package/')) {
        return `Error: Directory '${dir}' does not exist. Did you mean 'packages/' instead of 'package/'?`;
      }
      return `Error: Directory '${dir}' does not exist.`;
    }

    const files: string[] = [];
    const walk = async (currentDir: string) => {
      const entries = await fs.readdir(currentDir, {
        withFileTypes: true,
      });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else {
          // Return relative paths from project root for readability
          files.push(path.relative(PROJECT_ROOT, fullPath));
        }
      }
    };
    await walk(resolvedDir);
    return files;
  },
});

const readFileTool = createTool({
  id: "read_file",
  description: "Read the content of a file.",
  inputSchema: z.object({
    path: z.string().describe("The full path of the file to read"),
  }),
  execute: async ({ context }) => {
    const { path: filePath } = context;
    // Resolve the file path relative to project root
    const resolvedPath = path.isAbsolute(filePath) ? filePath : path.join(PROJECT_ROOT, filePath);
    try {
      return await fs.readFile(resolvedPath, "utf-8");
    } catch (error: any) {
      // Provide helpful error message for common mistakes
      if (error.code === 'ENOENT' && filePath.startsWith('package/')) {
        return `Error: File '${filePath}' does not exist. Did you mean 'packages/' instead of 'package/'?`;
      }
      return `Error reading file: ${(error as Error).message}`;
    }
  },
});

const writeFileTool = createTool({
  id: "write_file",
  description: "Write or overwrite content to a file. Use this to apply code fixes.",
  inputSchema: z.object({
    path: z.string().describe("The full path of the file to write"),
    content: z.string().describe("The content to write to the file"),
  }),
  execute: async ({ context }) => {
    const { path: filePath, content } = context;
    // Resolve the file path relative to project root
    const resolvedPath = path.isAbsolute(filePath) ? filePath : path.join(PROJECT_ROOT, filePath);
    try {
      await fs.writeFile(resolvedPath, content, "utf-8");
      return `File written successfully: ${resolvedPath}`;
    } catch (error) {
      return `Error writing file: ${(error as Error).message}`;
    }
  },
});

const gitDiffTool = createTool({
  id: "get_git_diff",
  description: "Get git diff for staged changes in the directory.",
  inputSchema: z.object({ dir: z.string().describe("The directory path") }),
  execute: async ({ context }) => {
    const { dir } = context;
    // Resolve the directory path relative to project root
    const resolvedDir = path.isAbsolute(dir) ? dir : path.join(PROJECT_ROOT, dir);
    try {
      const { stdout } = await execAsync(`git -C ${resolvedDir} diff --staged`);
      return stdout;
    } catch (error) {
      return `Error getting git diff: ${(error as Error).message}`;
    }
  },
});

// Dynamic Agent Base for Custom Model Selection, now with File Tools
const dynamicReviewAgent = (contextKey: string) =>
  new Agent({
    name: "Dynamic Code Review Agent",
    instructions: async ({ runtimeContext }) => {
      const model = runtimeContext.get(contextKey) as string;
      return `You are a code review expert using ${model}. You will be given a directory path containing code files. Use the list_files and read_file tools to access and read the necessary files for review. Analyze the code for issues (bugs, security, performance, architecture). Rate confidence (exploring, low, medium, high, certain). List issues from critical to low, note good patterns. If needed, suggest fixes.`;
    },
    model: ({ runtimeContext }) => {
      const modelName = runtimeContext.get(contextKey) as string;
      return getAIGatewayModel(modelName);
    },
    tools: {
      list_files: listFilesTool,
      read_file: readFileTool,
      write_file: writeFileTool,
      get_git_diff: gitDiffTool,
    },
    memory: ({ runtimeContext }) =>
      new Memory({
        storage: new LibSQLStore({ url: "file:/tmp/temp-review.db" }),
        options: {
          lastMessages: 10,
          semanticRecall: false, // Disable semantic recall to avoid vector store requirement
        },
      }),
  });

// Single stateful step with suspend/resume for step-by-step review
const codeReviewStep = createStep({
  id: "code-review",
  description: "Step-by-step code review with suspension between investigation phases",
  inputSchema: z.object({
    // Initial configuration
    directory: z.string(),
    relevant_files: z.array(z.string()).optional(),
    review_type: z.enum(["full", "security", "performance", "quick"]).default("full"),
    focus_on: z.string().optional(),
    standards: z.string().optional(),
    severity_filter: z.enum(["critical", "high", "medium", "low", "all"]).default("all"),
    models: z.object({
      main: z.string(),
      expert: z.string().optional(),
    }),
    review_validation_type: z.enum(["internal", "external"]).default("external"),
  }),
  outputSchema: z.object({
    finalReport: z.object({
      issues: z.array(
        z.object({
          severity: z.enum(["critical", "high", "medium", "low"]),
          description: z.string(),
          file: z.string().optional(),
          line: z.number().optional(),
          confidence: z.string(),
        })
      ),
      status: z.string(),
      findings: z.string(),
      confidence: z.enum([
        "exploring",
        "low",
        "medium",
        "high",
        "very_high",
        "almost_certain",
        "certain",
      ]),
      files_checked: z.array(z.string()),
      relevant_context: z.array(z.string()),
    }),
  }),
  suspendSchema: z.object({
    currentState: z.object({
      step_number: z.number(),
      total_steps: z.number(),
      findings: z.string(),
      issues_found: z.array(z.any()),
      files_checked: z.array(z.string()),
      relevant_context: z.array(z.string()),
      confidence: z.string(),
      continuation_id: z.string().optional(),
    }),
  }),
  resumeSchema: z.object({
    step: z.string(),
    step_number: z.number(),
    total_steps: z.number(),
    next_step_required: z.boolean(),
    findings: z.string(),
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
    files_checked: z.array(z.string()).optional(),
    relevant_context: z.array(z.string()).optional(),
    confidence: z.enum([
      "exploring",
      "low",
      "medium",
      "high",
      "very_high",
      "almost_certain",
      "certain",
    ]),
    continuation_id: z.string().optional(),
    backtrack_from_step: z.number().optional(),
  }),
  execute: async ({ inputData, resumeData, suspend, mastra, runtimeContext }) => {
    const { directory, models, review_type, review_validation_type } = inputData;

    // Load the comprehensive prompt with workflow instructions
    const { prompt: basePrompt } = await import("../prompts/codereview");

    // Add workflow-specific instructions
    const CODEREVIEW_WORKFLOW_PROMPT = `
${basePrompt}

ADDITIONAL WORKFLOW INSTRUCTIONS FOR STEP-BY-STEP REVIEW:

CRITICAL WORKFLOW RULES:
1. You MUST follow a structured, multi-step investigation process
2. Each step requires calling this tool with updated findings
3. You cannot complete the entire review in one step
4. The workflow will suspend after each step for you to investigate

STEP STRUCTURE:
- Step 1: Plan your review strategy, set total_steps (min 2, max 5)
- Step 2+: Execute investigation, update findings progressively
- Final Step: Set next_step_required=false when complete

WORKFLOW STATE REQUIREMENTS:
- step: Description of current investigation
- step_number: Current step (starts at 1)
- total_steps: Estimated steps needed
- next_step_required: true to continue, false when done
- findings: Accumulated discoveries
- issues_found: Array with severity levels (critical/high/medium/low)
- confidence: exploring/low/medium/high/very_high/almost_certain/certain
- files_checked: List of files examined
- relevant_context: Key methods/functions involved

CONFIDENCE PROGRESSION:
- exploring: Just starting investigation
- low: Early findings, need more evidence
- medium: Some patterns identified
- high: Strong evidence gathered
- very_high: Comprehensive understanding
- almost_certain: Nearly complete confidence
- certain: 100% confidence, ready for final report

IMPORTANT: After each step, the workflow will suspend. You must:
1. Perform the investigation described in your step
2. Use the file tools to examine code
3. Resume the workflow with your findings
4. Continue until next_step_required=false`;

    // Initialize or get resume state
    let currentState;
    if (resumeData) {
      // Continuing from a previous step
      currentState = {
        step_number: resumeData.step_number,
        total_steps: resumeData.total_steps,
        findings: resumeData.findings,
        issues_found: resumeData.issues_found || [],
        files_checked: resumeData.files_checked || [],
        relevant_context: resumeData.relevant_context || [],
        confidence: resumeData.confidence,
        continuation_id: resumeData.continuation_id,
      };

      // Check if we're done
      if (!resumeData.next_step_required) {
        // Perform expert analysis if configured
        if (review_validation_type === "external" && models.expert) {
          let expertAnalysis = {
            validatedIssues: [],
            additionalFindings: "Expert validation skipped due to error",
            recommendation: "Review completed based on initial analysis"
          };
          
          try {
            // Call expert model for validation
            console.log(`Starting expert validation with model: ${models.expert}`);
            const expertAgent = dynamicReviewAgent("models.expert");
            const expertContext = new RuntimeContext();
            expertContext.set("models.expert", models.expert);

            const expertResponse = await expertAgent.streamVNext(
              {
                role: "user",
                content: `Perform expert validation of this code review:
Directory: ${directory}
Review Type: ${review_type}
Findings: ${currentState.findings}
Issues: ${JSON.stringify(currentState.issues_found)}
Confidence: ${currentState.confidence}

Validate the findings and provide your expert analysis. Output in strict JSON format:
{ "validatedIssues": [...], "additionalFindings": "...", "recommendation": "..." }`,
              },
              { runtimeContext: expertContext, format: "aisdk" }
            );

            let expertText = "";
            try {
              // Safely iterate through the text stream with error handling
              if (expertResponse && expertResponse.textStream) {
                for await (const chunk of expertResponse.textStream) {
                  if (chunk) {
                    expertText += chunk;
                  }
                }
              }
            } catch (streamError) {
              console.error("Error reading expert response stream:", streamError);
              expertText = ""; // Continue with empty text
            }

            // Try to parse the expert response
            try {
              // Only try to parse if we have actual content
              if (expertText && expertText.trim()) {
                const cleanedExpertText = cleanJsonResponse(expertText);
                if (!cleanedExpertText) {
                  throw new Error("Expert response is empty after cleaning");
                }
                expertAnalysis = JSON.parse(cleanedExpertText);
              } else {
                // No expert text received, use default
                throw new Error("No expert response received");
              }
            } catch (parseError) {
              console.error("Failed to parse expert response:", expertText ? expertText.substring(0, 1000) : "Empty response");
              console.error("Parse error:", parseError);
              // Keep the default expert analysis on parse error
            }
          } catch (expertError) {
            console.error("Error during expert validation:", expertError);
            // Keep the default expert analysis
          }

          // Merge expert findings
          return {
            finalReport: {
              issues: [...currentState.issues_found, ...(expertAnalysis.validatedIssues || [])],
              status: "completed",
              findings: `${currentState.findings}\n\nExpert Analysis: ${expertAnalysis.additionalFindings || expertAnalysis.recommendation}`,
              confidence: currentState.confidence,
              files_checked: currentState.files_checked,
              relevant_context: currentState.relevant_context,
            },
          };
        }

        // Return final report without expert analysis
        return {
          finalReport: {
            issues: currentState.issues_found,
            status: "completed",
            findings: currentState.findings,
            confidence: currentState.confidence,
            files_checked: currentState.files_checked,
            relevant_context: currentState.relevant_context,
          },
        };
      }
    } else {
      // First call - initialize state
      currentState = {
        step_number: 1,
        total_steps: 3, // Will be set by agent
        findings: "",
        issues_found: [],
        files_checked: [],
        relevant_context: [],
        confidence: "exploring",
        continuation_id: crypto.randomUUID(),
      };
    }

    // Create agent for current step
    const agent = dynamicReviewAgent("models.main");
    const rtContext = runtimeContext || new RuntimeContext();
    rtContext.set("models.main", models.main);

    // Build prompt for current step
    const stepPrompt = `${CODEREVIEW_WORKFLOW_PROMPT}

CURRENT STATE:
- Step Number: ${currentState.step_number}
- Total Steps: ${currentState.total_steps}
- Confidence: ${currentState.confidence}
- Files Checked: ${JSON.stringify(currentState.files_checked)}
- Issues Found So Far: ${JSON.stringify(currentState.issues_found)}
- Previous Findings: ${currentState.findings}

YOUR TASK:
${
  currentState.step_number === 1
    ? `This is Step 1. You must:
1. Use the list_files and read_file tools to explore the directory: ${directory}
2. Understand the overall structure and identify key files
3. Plan your review strategy and set total_steps (2-5)
4. Begin initial assessment of obvious issues
5. Output your step plan and initial findings`
    : `This is Step ${currentState.step_number}. Continue your investigation:
1. Deep dive into specific areas identified in previous steps
2. Use tools to examine suspicious code sections
3. Validate or refute initial hypotheses
4. Update findings with new discoveries
5. Determine if more investigation is needed`
}

Review Configuration:
- Directory: ${directory}
- Review Type: ${review_type}
- Focus: ${inputData.focus_on || "General review"}
- Standards: ${inputData.standards || "Best practices"}
- Severity Filter: ${inputData.severity_filter}

Output your response in strict JSON format:
{
    "step": "Description of what you did in this step",
    "step_number": ${currentState.step_number},
    "total_steps": <your estimate>,
    "next_step_required": <true/false>,
    "findings": "Detailed findings from this step",
    "issues_found": [{"severity": "...", "description": "...", "file": "...", "line": ...}],
    "files_checked": ["..."],
    "relevant_context": ["..."],
    "confidence": "<exploring/low/medium/high/very_high/almost_certain/certain>"
}`;

    const response = await agent.streamVNext(
      {
        role: "user",
        content: stepPrompt,
      },
      { runtimeContext: rtContext, format: "aisdk" }
    );

    // Collect the response
    let fullText = "";
    for await (const chunk of response.textStream) {
      fullText += chunk;
    }

    let stepResult;
    try {
      const cleanedText = cleanJsonResponse(fullText);
      if (!cleanedText) {
        throw new Error("Step response is empty after cleaning");
      }
      stepResult = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("Failed to parse step response:", fullText.substring(0, 1000));
      console.error("Parse error:", parseError);
      // Return a basic step result on parse error
      stepResult = {
        step_number: currentState.step_number,
        total_steps: currentState.total_steps,
        findings: "Step could not be parsed - continuing with previous state",
        issues_found: [],
        files_checked: [],
        relevant_context: [],
        confidence: currentState.confidence,
        next_step_required: false
      };
    }

    // Update state with step results
    currentState = {
      ...currentState,
      step_number: stepResult.step_number,
      total_steps: stepResult.total_steps,
      findings: currentState.findings + "\n\n" + stepResult.findings,
      issues_found: [...currentState.issues_found, ...(stepResult.issues_found || [])],
      files_checked: [
        ...new Set([...currentState.files_checked, ...(stepResult.files_checked || [])]),
      ],
      relevant_context: [
        ...new Set([...currentState.relevant_context, ...(stepResult.relevant_context || [])]),
      ],
      confidence: stepResult.confidence,
    };

    // If more steps are needed, suspend
    if (stepResult.next_step_required) {
      await suspend({ currentState });
      // This return is reached only if suspend is mocked in tests
      return {
        finalReport: {
          issues: [],
          status: "suspended",
          findings: "Suspended for investigation",
          confidence: "exploring",
          files_checked: [],
          relevant_context: [],
        },
      };
    }

    // Final step completed - prepare for expert analysis or return
    // This will be handled in the next resume call
    await suspend({ currentState });
    return {
      finalReport: {
        issues: currentState.issues_found,
        status: "pending_final",
        findings: currentState.findings,
        confidence: currentState.confidence,
        files_checked: currentState.files_checked,
        relevant_context: currentState.relevant_context,
      },
    };
  },
});

// Code Review Workflow - Updated Input
export const codeReviewWorkflow = createWorkflow({
  id: "code-review-workflow",
  description: "Migrated Zen MCP Code Review with Directory and File Tools",
  inputSchema: z.object({
    // Initial configuration (step 1 only)
    directory: z.string().describe("Path to the directory containing code files for review"),
    relevant_files: z.array(z.string()).describe("Files/directories to review").optional(),
    review_type: z.enum(["full", "security", "performance", "quick"]).default("full"),
    focus_on: z.string().optional(),
    standards: z.string().optional(),
    severity_filter: z.enum(["critical", "high", "medium", "low", "all"]).default("all"),

    // Model configuration
    models: z.object({
      main: z.string(),
      expert: z.string().optional(), // For external validation
    }),
    review_validation_type: z.enum(["internal", "external"]).default("external"),
  }),
  outputSchema: z.object({
    finalReport: z.object({
      issues: z.array(
        z.object({
          severity: z.enum(["critical", "high", "medium", "low"]),
          description: z.string(),
          file: z.string().optional(),
          line: z.number().optional(),
          confidence: z.string(),
        })
      ),
      status: z.string(),
      findings: z.string(),
      confidence: z.enum([
        "exploring",
        "low",
        "medium",
        "high",
        "very_high",
        "almost_certain",
        "certain",
      ]),
      files_checked: z.array(z.string()),
      relevant_context: z.array(z.string()),
    }),
  }),
})
  .then(codeReviewStep)
  .commit();
