#!/usr/bin/env bun
/**
 * Test script for the Mastra Code Review MCP Server
 *
 * This script tests the MCP server by:
 * 1. Starting the server as a subprocess
 * 2. Connecting as a client
 * 3. Listing available tools
 * 4. Executing the code review workflow
 */

import * as dotenv from "dotenv";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// Load environment variables
dotenv.config();

async function main() {
    console.log("🚀 Starting MCP Code Review Server test...\n");

    // Create a client transport that launches the server
    const transport = new StdioClientTransport({
        command: "bun",
        args: ["run", "./src/mastra/mcp-server/index.ts"],
    });

    // Create the client
    const client = new Client(
        {
            name: "test-client",
            version: "1.0.0",
        },
        {
            capabilities: {},
        },
    );

    try {
        // Connect to the server
        console.log("📡 Connecting to server...");
        await client.connect(transport);
        console.log("✅ Connected successfully!\n");

        // List available tools
        console.log("🔧 Listing available tools...");
        const tools = await client.listTools();
        console.log("Available tools:", JSON.stringify(tools, null, 2));
        console.log();

        // Test the code review tool
        console.log("🔍 Testing code review workflow...");

        // Step 1: Start the review
        console.log("\n📝 Step 1: Starting code review...");
        const step1Result = await client.callTool({
            name: "code_review",
            arguments: {
                directory: "./src",
                review_type: "full",
                severity_filter: "all",
            },
        });

        console.log("Step 1 Result:", JSON.stringify(step1Result, null, 2));

        // Parse the result to get session ID
        const step1Content = step1Result.content as Array<{
            type: string;
            text: string;
        }>;
        const step1Data = JSON.parse(step1Content[0].text);

        if (step1Data.status === "suspended") {
            const sessionId = step1Data.sessionId;
            console.log(
                `\n⏸️  Workflow suspended with session ID: ${sessionId}`,
            );

            // Step 2: Continue with findings
            console.log(
                "\n📝 Step 2: Continuing with investigation findings...",
            );
            const step2Result = await client.callTool({
                name: "code_review",
                arguments: {
                    sessionId,
                    step: "Deep dive into code quality",
                    step_number: 2,
                    total_steps: 3,
                    next_step_required: true,
                    findings:
                        "Found several areas for improvement:\n- Missing error handling in async functions\n- Inconsistent naming conventions\n- Some functions lack proper TypeScript types",
                    confidence: "medium",
                    files_checked: ["./src/mastra/workflows/codereview.ts"],
                    issues_found: [
                        {
                            severity: "medium",
                            description:
                                "Missing error handling in workflow execution",
                            file: "./src/mastra/workflows/codereview.ts",
                            line: 150,
                        },
                    ],
                },
            });

            console.log("Step 2 Result:", JSON.stringify(step2Result, null, 2));

            // Step 3: Final review
            console.log("\n📝 Step 3: Completing review...");
            const step3Result = await client.callTool({
                name: "code_review",
                arguments: {
                    sessionId,
                    step: "Final validation and recommendations",
                    step_number: 3,
                    total_steps: 3,
                    next_step_required: false, // This completes the workflow
                    findings:
                        "Comprehensive review completed. The code follows most best practices but needs improvements in error handling and type safety.",
                    confidence: "high",
                    files_checked: [
                        "./src/mastra/workflows/codereview.ts",
                        "./src/mastra/prompts/codereview.ts",
                    ],
                    issues_found: [
                        {
                            severity: "medium",
                            description:
                                "Missing error handling in workflow execution",
                            file: "./src/mastra/workflows/codereview.ts",
                            line: 150,
                        },
                        {
                            severity: "low",
                            description:
                                "Consider adding more specific TypeScript types",
                            file: "./src/mastra/workflows/codereview.ts",
                            line: 200,
                        },
                    ],
                },
            });

            console.log("Step 3 Result:", JSON.stringify(step3Result, null, 2));

            const step3Content = step3Result.content as Array<{
                type: string;
                text: string;
            }>;
            const step3Data = JSON.parse(step3Content[0].text);
            if (step3Data.status === "completed") {
                console.log(
                    "\n✅ Code review workflow completed successfully!",
                );
                console.log("Final Review Output:", step3Data.result);
            }
        }
    } catch (error) {
        console.error("❌ Error during test:", error);
    } finally {
        // Disconnect from the server
        console.log("\n🔌 Disconnecting from server...");
        await client.close();
        console.log("👋 Test completed!");
        process.exit(0);
    }
}

// Run the test
main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
