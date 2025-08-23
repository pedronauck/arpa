# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical Instructions

<critical>
- **YOU MUST** use Serena MCP to discover and find out, **BUT NOT TO EDIT**
- **YOU MUST** use Zen MCP (with Gemini 2.5 Pro) to debug, analyze and trace complex flows
- **YOU MUST ALWAYS** show all recommendations/issues from a Zen MCP review, regardless of whether they are related to your task or not
</critical>

## Project Overview

ARPA is a monorepo project using Bun as the runtime and package manager, structured with a frontend (React) and backend (Hono) architecture.

### Tech Stack

- **Runtime**: Bun (not Node.js)
- **Package Manager**: Bun workspaces
- **Backend**: Hono framework
- **Frontend**: React 19 with Bun bundler
- **Build Tool**: Turbo for monorepo orchestration
- **Linting**: oxlint
- **Formatting**: Prettier
- **Type Checking**: TypeScript with strict mode

## Development Commands

### Essential Commands

```bash
# Install dependencies
bun install

# Run all packages in development mode
bun dev

# Build all packages
bun build

# Run tests
bun test

# Type checking
bun typecheck

# Linting
bun lint

# Format code
bun format

# Check formatting
bun format:check
```

### Package-Specific Commands

```bash
# Run specific package commands using workspace filters
bun --filter '@arpa/backend' dev
bun --filter '@arpa/frontend' dev

# Run a single test file
bun test path/to/test.ts
```

## Architecture

### Monorepo Structure

```
/
├── packages/
│   ├── backend/         # Hono API server (port 3001)
│   │   ├── src/
│   │   │   └── index.ts # Main server entry
│   │   └── package.json
│   └── frontend/        # React application
│       ├── src/
│       │   ├── index.tsx # React entry point
│       │   └── index.html
│       └── package.json
├── package.json         # Root workspace configuration
├── tsconfig.json        # Shared TypeScript config
└── turbo.json          # Turbo build orchestration
```

### Key Architectural Decisions

1. **Bun Runtime**: The project uses Bun exclusively - avoid Node.js APIs or npm/yarn/pnpm commands
2. **Workspace Setup**: Uses Bun workspaces for monorepo management with packages in `packages/*`
3. **TypeScript Path Aliases**: Configured with `@arpa/*` pointing to package sources
4. **Turbo Integration**: Build tasks are orchestrated through Turbo for optimal caching and parallelization

## Backend Development (Hono)

Follow the comprehensive Hono best practices defined in `.cursor/rules/hono.mdc`:

### Structure Pattern

- `/routes` - HTTP route handlers (keep thin, delegate to services)
- `/services` - Business logic layer
- `/repositories` - Data access layer
- `/middleware` - Reusable middleware components
- `/utils` - Utility functions and error classes

### Key Principles

- Pragmatic clean architecture - avoid over-engineering
- Dependency injection for testability
- Comprehensive error handling with custom error classes
- Input validation using Zod schemas
- Middleware for cross-cutting concerns (auth, CORS, rate limiting)

## Frontend Development

### React Setup

- React 19 with Bun's built-in bundler
- Uses `react-jsx` transform (no React imports needed)
- Entry point at `packages/frontend/src/index.tsx`
- HTML template at `packages/frontend/src/index.html`

## Bun-Specific Guidelines

Per `.cursor/rules/use-bun-instead-of-node-vite-npm-pnpm.mdc`:

### Use Bun APIs Instead Of:

- `Bun.serve()` instead of Express
- `bun:sqlite` instead of better-sqlite3
- `Bun.$\`command\`` instead of execa
- Built-in WebSocket support instead of ws package
- Native `.env` loading (no dotenv needed)

### Commands

- `bun <file>` instead of `node <file>`
- `bun test` instead of jest/vitest
- `bun build` for bundling
- `bun install` for dependencies
- `bun run <script>` for scripts

## Testing Strategy

- Use Bun's built-in test runner (`bun test`)
- Structure: `describe`, `it`, `expect`, `beforeEach`, `mock`
- Test business logic in services
- Integration tests for API endpoints
- Mock external dependencies appropriately

## Configuration Files

- **TypeScript**: Strict mode enabled, ESNext modules, Bundler resolution
- **Turbo**: Configured for build, dev, test, typecheck, lint tasks
- **Linting**: Uses oxlint for fast linting
- **Formatting**: Prettier with specific rules for JS/TS/JSON/CSS/MD files
