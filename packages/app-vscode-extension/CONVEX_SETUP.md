# Convex Setup for VS Code Extension

## Problem
The error `Could not find public function for 'chats:list'` indicates that the Convex functions haven't been deployed to the backend.

## Solution

The VS Code extension is configured to use the Convex deployment at:
- **URL**: `https://warmhearted-ladybug-683.convex.cloud`

### Option 1: Deploy Functions (Production)

1. Get a deploy key from the Convex dashboard:
   - Go to https://dashboard.convex.dev
   - Find the `warmhearted-ladybug-683` project
   - Go to Settings → Deploy Keys
   - Create a new deploy key

2. Deploy the functions:
   ```bash
   cd packages/app-vscode-extension/webview
   export CONVEX_DEPLOY_KEY="<your-deploy-key>"
   npx convex deploy
   ```

### Option 2: Development Mode (Recommended for Testing)

1. Start the Convex dev server:
   ```bash
   cd packages/app-vscode-extension/webview
   npx convex dev
   ```

2. When prompted:
   - Choose to use an existing project
   - Select `warmhearted-ladybug-683`
   - The functions will be automatically synced

### Function Definitions

The extension uses the following Convex functions (defined in `webview/convex/chats.ts`):
- `chats.list` (alias for `getChats`) - Get all chats for a user
- `chats.create` (alias for `createChat`) - Create a new chat
- `chats.remove` (alias for `deleteChat`) - Delete a chat
- `chats.sendMessage` (alias for `addMessage`) - Add a message to a chat
- `chats.getMessages` (alias for `getChatMessages`) - Get messages for a chat

### Verification

Once deployed, the functions should be accessible and the error will be resolved. You can verify by:
1. Rebuilding the extension
2. Testing in VS Code
3. Checking the browser console for successful Convex connection logs