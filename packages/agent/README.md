# Arpa Agent

AI-powered code review and analysis agent with MCP (Model Context Protocol) server integration.

## Overview

The Arpa Agent package provides intelligent code review capabilities through a combination of Mastra workflows and an MCP server interface. It performs comprehensive code analysis including security, performance, and quality reviews with step-by-step workflows.

## Features

- **Comprehensive Code Review**: Multi-step analysis with configurable review types
- **MCP Server Integration**: Expose workflows as tools for Claude Desktop, Cursor, and other MCP clients
- **Stateful Workflows**: Maintain context between review steps with session management
- **Issue Tracking**: Identify and categorize issues by severity (critical, high, medium, low)
- **Flexible Review Types**: Full, security, performance, or quick reviews
- **Progressive Confidence Tracking**: From exploring to certain confidence levels

## Installation

```bash
# Install dependencies
bun install
```

## Project Structure

```
packages/agent/
├── src/
│   └── mastra/
│       ├── agents/          # Agent implementations
│       ├── workflows/        # Workflow definitions
│       │   └── codereview.ts
│       ├── prompts/          # Prompt templates
│       │   └── codereview.ts
│       ├── tools/            # Tool integrations
│       ├── mcp-server/       # MCP server implementation
│       │   ├── index.ts      # Main server entry point
│       │   └── codereview-tool.ts
│       └── index.ts          # Package exports
├── test/
│   └── mcp.ts                # MCP server test script
├── package.json
└── tsconfig.json
```

## Usage

### As an MCP Server

The agent can be run as an MCP server to integrate with various AI tools:

#### Starting the Server

```bash
# Run directly
bun run src/mcp/index.ts

# Or make it executable
chmod +x src/mcp/index.ts
./src/mcp/index.ts
```

#### Claude Desktop Integration

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "arpa-mcp": {
      "command": "bun",
      "args": [
        "run",
        "/path/to/packages/agent/src/mcp/index.ts"
      ]
    }
  }
}
```

#### Cursor Integration

Add to your Cursor settings:

```json
{
  "mcp.servers": {
    "arpa-mcp": {
      "command": "bun",
      "args": [
        "run",
        "/path/to/packages/agent/src/mcp/index.ts"
      ]
    }
  }
}
```

### As a Library

```typescript
import { codeReviewWorkflow } from "@arpa/agent";

// Use the workflow directly in your application
const result = await codeReviewWorkflow.execute({
  directory: "./src",
  review_type: "full",
  // ... other options
});
```

## Code Review Tool

The `code_review` tool performs comprehensive code analysis with suspension points for investigation.

### Parameters

#### Initial Review (Step 1)

```typescript
{
  directory?: string;           // Directory to review (default: ".")
  relevant_files?: string[];    // Specific files to review
  review_type?: "full" | "security" | "performance" | "quick";
  focus_on?: string;           // Specific aspects to focus on
  standards?: string;          // Coding standards to enforce
  severity_filter?: "critical" | "high" | "medium" | "low" | "all";
}
```

#### Resume Review (Steps 2+)

```typescript
{
  sessionId: string;           // Session ID from previous step
  step?: string;              // Current step description
  step_number?: number;       // Current step number
  total_steps?: number;       // Total estimated steps
  next_step_required?: boolean; // Continue or complete
  findings?: string;          // Accumulated findings
  confidence?: "exploring" | "low" | "medium" | "high" | "very_high" | "almost_certain" | "certain";
  files_checked?: string[];   // Files examined
  issues_found?: Array<{
    severity: "critical" | "high" | "medium" | "low";
    description: string;
    file?: string;
    line?: number;
  }>;
}
```

### Workflow Example

```javascript
// Step 1: Start review
const result1 = await callTool("code_review", {
  directory: "./src",
  review_type: "full",
});
// Returns: { status: 'suspended', sessionId: 'xxx', ... }

// Step 2: Continue with findings
const result2 = await callTool("code_review", {
  sessionId: "xxx",
  step_number: 2,
  findings: "Found potential security issue...",
  issues_found: [{ severity: "high", description: "..." }],
  next_step_required: true,
});

// Step 3: Complete review
const result3 = await callTool("code_review", {
  sessionId: "xxx",
  step_number: 3,
  next_step_required: false,
  findings: "Final analysis complete...",
});
// Returns: { status: 'completed', result: { ... } }
```

## Testing

Run the test script to verify the MCP server is working:

```bash
bun run test/mcp.ts
```

This will:

1. Start the MCP server as a subprocess
2. Connect as a client
3. List available tools
4. Execute a sample code review workflow

## Architecture

### Core Components

- **Workflows**: Mastra-based workflow definitions for complex multi-step processes
- **MCP Server**: Protocol server exposing workflows as tools via stdio transport
- **Session Management**: In-memory session storage with automatic cleanup (1 hour TTL)
- **Tool Wrapper**: Bridges between MCP protocol and Mastra workflow execution

### Key Design Decisions

- **Stateful Workflows**: Maintains workflow state between suspension points
- **Schema Validation**: Zod schemas for input validation and type safety
- **Error Handling**: Graceful error recovery with detailed error messages
- **Modular Design**: Separation of concerns between MCP protocol and business logic

## Development

### Environment Variables

Create a `.env` file in the package root:

```bash
# Add any required API keys or configuration
OPENAI_API_KEY=your_key_here
# Other environment variables as needed
```

### Building

```bash
# Type checking
bun run typecheck

# Linting
bun run lint

# Format code
bun run format
```

## Contributing

1. Follow the existing code structure and patterns
2. Ensure all TypeScript types are properly defined
3. Add appropriate error handling
4. Update tests for new functionality
5. Run linting and type checking before submitting

## License

See the root repository LICENSE file for details.
