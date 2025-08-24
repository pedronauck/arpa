# ARPA VS Code Extension

This VS Code extension packages the ARPA chat interface as a native VS Code extension that can be installed and used directly within the editor.

## Features

- 🤖 AI-powered chat interface within VS Code
- 💬 Chat panel in the sidebar and as a separate webview
- 🔄 Real-time streaming responses
- 💾 Persistent chat history
- 🎨 Theme-aware UI that adapts to VS Code themes

## Installation

### From VSIX Package

1. Build the extension:
   ```bash
   cd packages/app-vscode-extension
   bun install
   bun run build
   bun run package
   ```

2. Install the generated `.vsix` file:
   - Open VS Code
   - Go to Extensions view (Cmd/Ctrl + Shift + X)
   - Click on the "..." menu
   - Select "Install from VSIX..."
   - Choose the generated `arpa-chat-*.vsix` file

### Development Installation

1. Open the extension folder in VS Code:
   ```bash
   code packages/app-vscode-extension
   ```

2. Install dependencies:
   ```bash
   bun install
   cd webview && bun install
   ```

3. Build the webview:
   ```bash
   bun run build-webview
   ```

4. Press F5 to launch the Extension Development Host

## Usage

### Opening the Chat Interface

1. **Command Palette**: 
   - Press `Cmd/Ctrl + Shift + P`
   - Type "ARPA: Open Chat Interface"
   - Press Enter

2. **Activity Bar**:
   - Click on the ARPA icon in the activity bar (left sidebar)
   - The chat will open in the sidebar panel

3. **Separate Window**:
   - Use the command "ARPA: Open Chat Interface" to open in a separate panel

### Configuration

Configure the extension in VS Code settings:

```json
{
  "arpa.apiEndpoint": "http://localhost:3001",
  "arpa.convexUrl": "your-convex-deployment-url"
}
```

## Development

### Project Structure

```
app-vscode-extension/
├── src/                     # Extension source code
│   ├── extension.ts        # Main extension entry point
│   └── utils/              # Utility functions
├── webview/                # React app (copied from packages/app)
│   ├── src/                # React source code
│   ├── vite.config.ts      # Vite configuration
│   └── package.json        # Frontend dependencies
├── dist/                   # Built webview assets
├── out/                    # Compiled extension code
└── package.json            # Extension manifest
```

### Development Workflow

1. **Watch Mode for Extension**:
   ```bash
   bun run watch
   ```

2. **Watch Mode for Webview** (in another terminal):
   ```bash
   bun run watch-webview
   ```

3. **Launch Extension**:
   - Press F5 in VS Code to launch Extension Development Host
   - The extension will automatically reload when you make changes

### Building for Production

1. **Build Everything**:
   ```bash
   bun run build
   ```

2. **Package Extension**:
   ```bash
   bun run package
   ```

   This creates a `.vsix` file that can be distributed and installed.

### Publishing to Marketplace

1. Install vsce if not already installed:
   ```bash
   npm install -g @vscode/vsce
   ```

2. Create a Personal Access Token on Azure DevOps

3. Publish:
   ```bash
   vsce publish
   ```

## Scripts

- `bun run compile` - Compile TypeScript extension code
- `bun run build-webview` - Build React webview app
- `bun run build` - Build both extension and webview
- `bun run watch` - Watch extension TypeScript files
- `bun run watch-webview` - Watch webview React files
- `bun run package` - Create VSIX package
- `bun run clean` - Clean build artifacts

## Troubleshooting

### Webview Not Loading

If the webview shows "ARPA Chat not built":
1. Run `bun run build-webview`
2. Reload the VS Code window (Cmd/Ctrl + R)

### API Connection Issues

1. Ensure the backend is running on the configured port
2. Check the `arpa.apiEndpoint` setting in VS Code settings
3. Look for errors in the Output panel (View > Output > ARPA)

### Development Hot Reload

For the best development experience:
1. Run `bun run watch-webview` for React hot reload
2. The extension will need manual reload (Cmd/Ctrl + R in Extension Host)

## Architecture

The extension works by:
1. Creating a webview panel in VS Code
2. Loading the built React application into the webview
3. Proxying API requests through the extension to handle CORS
4. Managing state persistence using VS Code's globalState API
5. Integrating with VS Code themes and commands

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test in Extension Development Host
5. Submit a pull request

## License

[Your License Here]
