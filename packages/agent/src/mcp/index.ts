#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import * as dotenv from "dotenv";
import { codeReviewInputSchema, codeReviewTool } from "./codereview-tool";

// Load environment variables from .env file
dotenv.config();

// Initialize the MCP server
const server = new Server(
  {
    name: "Arpa MCP",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing requests
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: codeReviewTool.name,
      description: codeReviewTool.description,
      inputSchema: codeReviewTool.inputSchema,
    },
  ],
}));

// Handle tool execution requests
server.setRequestHandler(CallToolRequestSchema, async request => {
  try {
    switch (request.params.name) {
      case "code_review": {
        // Parse and validate the arguments
        const args = codeReviewInputSchema.parse(request.params.arguments);

        // Execute the tool
        const result = await codeReviewTool.execute(args);

        return result;
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: `Unknown tool: ${request.params.name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    // Handle validation errors
    if (error instanceof Error && error.name === "ZodError") {
      const zodError = error as any;
      return {
        content: [
          {
            type: "text",
            text: `Invalid arguments: ${zodError.errors.map((e: any) => `${e.path.join(".")}: ${e.message}`).join(", ")}`,
          },
        ],
        isError: true,
      };
    }

    // Handle other errors
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server with stdio transport
async function main() {
  const transport = new StdioServerTransport();

  // Connect the server to the transport
  await server.connect(transport);

  // Log to stderr (stdout is used for MCP communication)
  console.error("Arpa MCP started");

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    console.error("Shutting down Arpa MCP...");
    await server.close();
    process.exit(0);
  });
}

// Run the server
main().catch(error => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
