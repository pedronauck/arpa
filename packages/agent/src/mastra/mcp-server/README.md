# Mastra Code Review MCP Server

This MCP (Model Context Protocol) server exposes the Mastra code review workflow as a tool that can be used by any MCP-compatible client (Claude Desktop, Cursor, etc.).

## Features

- **Step-by-step code review**: Performs comprehensive code review with suspension points for investigation
- **Stateful workflow**: Maintains state between steps using session IDs
- **Configurable review types**: Full, security, performance, or quick reviews
- **Issue tracking**: Tracks issues with severity levels (critical, high, medium, low)
- **Confidence tracking**: Progressive confidence levels from exploring to certain

## Installation

```bash
# Install dependencies
bun install
```

## Usage

### Starting the Server

The server uses stdio transport (standard input/output):

```bash
# Run directly
bun run ./src/mastra/mcp-server/index.ts

# Or make it executable
chmod +x ./src/mastra/mcp-server/index.ts
./src/mastra/mcp-server/index.ts
```

### Using with Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
    "mcpServers": {
        "mastra-code-review": {
            "command": "bun",
            "args": ["run", "/path/to/packages/agent/src/mastra/mcp-server/index.ts"]
        }
    }
}
```

### Using with Cursor

Add to your Cursor settings:

```json
{
    "mcp.servers": {
        "mastra-code-review": {
            "command": "bun",
            "args": ["run", "/path/to/packages/agent/src/mastra/mcp-server/index.ts"]
        }
    }
}
```

## Tool: code_review

The server exposes a single tool called `code_review` that performs comprehensive code review with step-by-step analysis.

### Parameters

#### Initial Review (Step 1)

```typescript
{
  // Configuration
  directory?: string;           // Directory to review (default: ".")
  relevant_files?: string[];    // Specific files to review
  review_type?: "full" | "security" | "performance" | "quick";  // default: "full"
  focus_on?: string;           // Specific aspects to focus on
  standards?: string;          // Coding standards to enforce
  severity_filter?: "critical" | "high" | "medium" | "low" | "all";  // default: "all"
}
```

#### Resume Review (Steps 2+)

```typescript
{
  sessionId: string;           // Session ID from previous step
  step?: string;              // Current step description
  step_number?: number;       // Current step number
  total_steps?: number;       // Total estimated steps
  next_step_required?: boolean; // Whether to continue (false to complete)
  findings?: string;          // Accumulated findings
  confidence?: "exploring" | "low" | "medium" | "high" | "very_high" | "almost_certain" | "certain";
  files_checked?: string[];   // Files examined
  relevant_context?: string[]; // Key methods/functions
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
const result1 = await callTool('code_review', {
  directory: './src',
  review_type: 'full'
});
// Returns: { status: 'suspended', sessionId: 'xxx', ... }

// Step 2: Continue with findings
const result2 = await callTool('code_review', {
  sessionId: 'xxx',
  step_number: 2,
  findings: 'Found XSS vulnerability...',
  issues_found: [{ severity: 'critical', ... }],
  next_step_required: true
});

// Step 3: Complete review
const result3 = await callTool('code_review', {
  sessionId: 'xxx',
  step_number: 3,
  next_step_required: false,  // Completes workflow
  findings: 'Final analysis...'
});
// Returns: { status: 'completed', result: { ... } }
```

## Testing

Run the test script to verify the server is working:

```bash
bun run test-mcp-server.ts
```

## Architecture

- **index.ts**: Main MCP server implementation using stdio transport
- **codereview-tool.ts**: Wrapper around the Mastra workflow, handles state management
- **../workflows/codereview.ts**: The actual Mastra workflow implementation

## Session Management

- Sessions are stored in memory with automatic cleanup after 1 hour
- Each session maintains the workflow run instance and current state
- Session IDs are generated automatically and must be used for resuming

## Error Handling

- Input validation using Zod schemas
- Graceful error messages for invalid inputs
- Automatic session cleanup on errors
