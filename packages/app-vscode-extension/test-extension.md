# Testing the VS Code Extension

## Build Steps Completed
1. ✅ TypeScript compiled (extension code in `/out`)
2. ✅ Webview built with Vite (assets in `/dist`)
3. ✅ Fixed path resolution for relative assets (./assets/)
4. ✅ Added debug logging to webviewManager

## To Test the Extension

1. **In VS Code where you're developing:**
   ```bash
   cd packages/app-vscode-extension
   # Extension is already compiled
   ```

2. **Open VS Code Extension Host:**
   - Press `F5` in VS Code
   - Or: Run > Start Debugging
   - Or: Command Palette > "Debug: Start Debugging"

3. **In the new VS Code window:**
   - Open Command Palette (`Cmd+Shift+P` or `Ctrl+Shift+P`)
   - Run: "ARPA: Open Chat Interface"
   - Check the Debug Console in the first VS Code window for logs

## Debugging Tips

- **Check Developer Tools:** In the Extension Host window, open Help > Toggle Developer Tools
- **Look for Console errors:** Check for any resource loading errors
- **Check Network tab:** See if assets are being loaded
- **Debug Console:** The console.log statements we added will show:
  - Path where it's loading from
  - If the index.html exists
  - HTML transformation details

## What Was Fixed

1. **Path Resolution:** Changed from absolute paths (`/assets/`) to relative paths (`./assets/`)
2. **CSP Nonce:** Added proper nonce to script tags
3. **WebView URIs:** Properly converting local file paths to webview URIs
4. **Debug Logging:** Added console.log to track HTML loading and transformation

## If Still Blank

Check the Debug Console for:
- "Loading webview from: [path]"
- "File exists: true/false"
- "Original HTML length: [number]"
- "Final HTML length: [number]"

These will tell us if the file is being found and transformed correctly.