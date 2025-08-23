import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import OpenAI from 'openai';

function loadEnvFile(context: vscode.ExtensionContext): { [key: string]: string } {
    const envVars: { [key: string]: string } = {};
    
    // Try multiple possible locations for .env file
    const possiblePaths = [];
    
    // 1. Workspace folder
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
        possiblePaths.push(path.join(workspaceFolders[0].uri.fsPath, '.env'));
    }
    
    // 2. Extension root directory
    possiblePaths.push(path.join(context.extensionPath, '.env'));
    
    // 3. Parent directory of extension (for development)
    possiblePaths.push(path.join(path.dirname(context.extensionPath), '.env'));
    
    for (const envPath of possiblePaths) {
        console.log(`Checking for .env file at: ${envPath}`);
        try {
            if (fs.existsSync(envPath)) {
                console.log(`Found .env file at: ${envPath}`);
                const envContent = fs.readFileSync(envPath, 'utf8');
                const lines = envContent.split('\n');
                
                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine && !trimmedLine.startsWith('#')) {
                        const [key, ...valueParts] = trimmedLine.split('=');
                        if (key && valueParts.length > 0) {
                            const value = valueParts.join('=').replaceAll(/^["']|["']$/g, '');
                            envVars[key.trim()] = value.trim();
                            console.log(`Loaded env var: ${key.trim()}`);
                        }
                    }
                }
                break; // Stop after finding first .env file
            }
        } catch (error) {
            console.error(`Error loading .env file from ${envPath}:`, error);
        }
    }
    
    return envVars;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('ARPA Chatbot extension is now active!');

    const provider = new ChatbotViewProvider(context.extensionUri, context);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ChatbotViewProvider.viewType, provider)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('arpa-chatbot.openChatbot', () => {
            const panel = vscode.window.createWebviewPanel(
                'arpaChatbot',
                'ARPA Chatbot',
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            panel.webview.html = getWebviewContent(context.extensionPath);

            panel.webview.onDidReceiveMessage(
                async message => {
                    switch (message.command) {
                        case 'sendMessage':
                            await handleChatMessage(message.text, panel.webview, context);
                            break;
                    }
                },
                undefined,
                context.subscriptions
            );
        })
    );
}

class ChatbotViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'arpaChatbot';

    constructor(private readonly _extensionUri: vscode.Uri, private readonly _context: vscode.ExtensionContext) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = getWebviewContent(this._context.extensionPath);

        webviewView.webview.onDidReceiveMessage(async message => {
            switch (message.command) {
                case 'sendMessage':
                    await handleChatMessage(message.text, webviewView.webview, this._context);
                    break;
            }
        });
    }
}

async function handleChatMessage(userMessage: string, webview: vscode.Webview, context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration('arpa-chatbot');
    const envVars = loadEnvFile(context);
    
    const apiKey = envVars.OPENAI_API_KEY || config.get<string>('openaiApiKey');
    const model = config.get<string>('model') || 'gpt-3.5-turbo';

    if (!apiKey) {
        webview.postMessage({
            command: 'addMessage',
            message: 'Please configure your OpenAI API key in a .env file (OPENAI_API_KEY=your-key) or in VSCode settings.',
            isUser: false
        });
        return;
    }

    webview.postMessage({
        command: 'addMessage',
        message: userMessage,
        isUser: true
    });

    try {
        const openai = new OpenAI({ apiKey });
        
        const completion = await openai.chat.completions.create({
            messages: [{ role: 'user', content: userMessage }],
            model,
        });

        const response = completion.choices[0]?.message?.content || 'No response from AI';
        
        webview.postMessage({
            command: 'addMessage',
            message: response,
            isUser: false
        });
    } catch (error) {
        webview.postMessage({
            command: 'addMessage',
            message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            isUser: false
        });
    }
}

function getWebviewContent(extensionPath: string): string {
    const htmlPath = path.join(extensionPath, 'src', 'webview', 'index.html');
    const jsPath = path.join(extensionPath, 'src', 'webview', 'chatbot.js');
    
    try {
        let htmlContent = fs.readFileSync(htmlPath, 'utf8');
        const jsContent = fs.readFileSync(jsPath, 'utf8');
        
        // Replace the external script reference with inline script
        htmlContent = htmlContent.replace(
            '<script src="chatbot.js"></script>',
            `<script>${jsContent}</script>`
        );
        
        return htmlContent;
    } catch (error) {
        console.error('Error loading webview files:', error);
        return '<html><body><h1>Error loading chatbot interface</h1></body></html>';
    }
}

export function deactivate() {}
