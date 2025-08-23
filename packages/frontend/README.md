# ARPA Chatbot

A VSCode extension that provides an AI-powered chatbot interface using OpenAI's API. Features a sleek red, white, and black theme with modern UI components.

## Features

- **AI Chat Interface**: Interactive chatbot powered by OpenAI's GPT models
- **Modern UI**: Clean design with red, white, and black color scheme using Tailwind CSS
- **Easy Configuration**: Supports `.env` file configuration for API keys
- **Multiple Models**: Choose between GPT-3.5-turbo, GPT-4, and GPT-4-turbo
- **Seamless Integration**: Works directly within VSCode as a webview panel

## Prerequisites

- **Bun** runtime and package manager
- **VSCode** (v1.90.0 or higher)
- **OpenAI API Key**

## Setup

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd arpa
   ```

2. **Install dependencies:**

   ```bash
   bun install
   ```

3. **Configure your OpenAI API key:**

   Create a `.env` file in the project root:

   ```bash
   # .env
   OPENAI_API_KEY=your-openai-api-key-here
   ```

   Or configure via VSCode settings (fallback option):
   - File → Preferences → Settings
   - Search for "arpa chatbot"
   - Enter your API key in the "Openai Api Key" field

## Running the Extension

1. **Open the project in VSCode:**

   ```bash
   code .
   ```

2. **Build the extension:**

   ```bash
   bun esbuild:base
   ```

3. **Start debugging (launches Extension Development Host):**
   - Press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux)
   - Type: `Debug: Start Debugging`
   - Or go to **Run → Start Debugging**

4. **Open the chatbot in the Extension Development Host window:**
   - Press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux)
   - Type: `ARPA: Open Chatbot`
   - Select the command

## Usage

- Type your message in the input field
- Press **Enter** or click **Send** to send messages
- The AI will respond using the configured OpenAI model
- Messages appear in real-time with distinct styling for user and AI messages

## Configuration Options

You can customize the extension through VSCode settings:

- **API Key**: Your OpenAI API key
- **Model**: Choose between:
  - `gpt-3.5-turbo` (default)
  - `gpt-4`
  - `gpt-4-turbo`

## Project Structure

```
src/
├── extension.ts          # Main extension logic
└── webview/
    ├── index.html        # Chatbot UI
    └── chatbot.js        # Frontend JavaScript
```

## Development

- **Watch mode**: `bun esbuild:watch` - Auto-rebuilds on file changes
- **Clean build**: `bun clean && bun esbuild:base`
- **Lint**: `bun lint`

## Troubleshooting

**Extension command not found:**

- Ensure the extension is built: `bun esbuild:base`
- Restart the Extension Development Host window
- Check the debug console for errors

**API key not working:**

- Verify the `.env` file is in the project root
- Check your OpenAI API key is valid
- Ensure you have API credits available

**Debug console shows path errors:**

- Check that the workspace folder is correctly set to the `arpa` directory
