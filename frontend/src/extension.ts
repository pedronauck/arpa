import * as fs from 'fs';
import * as path from 'path';

import * as vscode from 'vscode';

import { api } from '../convex/_generated/api';
import { convexClient, initializeConvexClient } from './convexClient';

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
    
    // 4. .env.local for Convex
    possiblePaths.push(path.join(context.extensionPath, '.env.local'));
    
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

/**
 * Initialize Convex client
 */
async function initializeConvex(context: vscode.ExtensionContext) {
    try {
        const envVars = loadEnvFile(context);
        const convexUrl = envVars.CONVEX_URL || "https://aware-badger-44.convex.cloud";
        
        console.log('Convex initializing with URL:', convexUrl);
        
        // Initialize the Convex client with the loaded URL
        initializeConvexClient(convexUrl);
        
        console.log('Convex client initialized successfully');
        
    } catch (error) {
        console.error('Failed to initialize Convex:', error);
    }
}

export function activate(context: vscode.ExtensionContext) {
    console.log('ARPA Chatbot extension is now active!');

    // Initialize Convex
    initializeConvex(context);

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
                    await handleWebviewMessage(message, panel.webview, context);
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
            await handleWebviewMessage(message, webviewView.webview, this._context);
        });
    }
}

/**
 * Handle messages from the webview
 */
async function handleWebviewMessage(message: any, webview: vscode.Webview, context: vscode.ExtensionContext) {
    switch (message.command) {
        case 'sendMessage':
            await handleChatMessage(message.text, message.chatId, webview, context);
            break;
        case 'createChat':
            await handleCreateChat(message.title, message.userId, webview, context);
            break;
        case 'getChats':
            await handleGetChats(message.userId, webview, context);
            break;
        case 'getChatMessages':
            await handleGetChatMessages(message.chatId, webview, context);
            break;
    }
}

/**
 * Handle creating a new chat using Convex
 */
async function handleCreateChat(title: string, userId: string, webview: vscode.Webview, context: vscode.ExtensionContext) {
    try {
        console.log('handleCreateChat - Creating chat with title:', title, 'userId:', userId);
        
        // Call Convex to create a new chat
        const chatId = await convexClient.mutation(api.chats.createChat, {
            title,
            userId
        });
        
        console.log('Created chat in Convex with ID:', chatId);
        
        // Send response back to webview
        webview.postMessage({
            command: 'setCurrentChat',
            chatId,
            title
        });
        
        console.log('Sent setCurrentChat message to webview with chatId:', chatId);
        
    } catch (error) {
        console.error('Failed to create chat in Convex:', error);
        webview.postMessage({
            command: 'error',
            message: 'Failed to create chat'
        });
    }
}

/**
 * Handle getting chats from Convex
 */
async function handleGetChats(userId: string, webview: vscode.Webview, context: vscode.ExtensionContext) {
    try {
        // Call Convex to get chats
        const chats = await convexClient.query(api.chats.getChats, { userId });
        
        console.log('Retrieved chats from Convex:', chats);
        
        webview.postMessage({
            command: 'renderChatList',
            chats
        });
        
    } catch (error) {
        console.error('Failed to get chats from Convex:', error);
        webview.postMessage({
            command: 'error',
            message: 'Failed to load chats'
        });
    }
}

/**
 * Handle getting chat messages from Convex
 */
async function handleGetChatMessages(chatId: string, webview: vscode.Webview, context: vscode.ExtensionContext) {
    try {
        // Call Convex to get messages
        const messages = await convexClient.query(api.chats.getChatMessages, { chatId: chatId as any });
        
        console.log('Retrieved messages from Convex:', messages);
        
        webview.postMessage({
            command: 'loadChatMessages',
            messages
        });
        
    } catch (error) {
        console.error('Failed to get messages from Convex:', error);
        webview.postMessage({
            command: 'error',
            message: 'Failed to load chat messages'
        });
    }
}

async function handleChatMessage(userMessage: string, chatId: string | null, webview: vscode.Webview, context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration('arpa-chatbot');
    const envVars = loadEnvFile(context);
    
    // const apiKey = envVars.OPENAI_API_KEY || config.get<string>('openaiApiKey');
    // const model = config.get<string>('model') || 'gpt-3.5-turbo';

    // if (!apiKey) {
    //     webview.postMessage({
    //         command: 'addMessage',
    //         message: 'Please configure your OpenAI API key in a .env file (OPENAI_API_KEY=your-key) or in VSCode settings.',
    //         isUser: false
    //     });
    //     return;
    // }

    // User message is already displayed in the frontend, no need to send it back

    try {
        // const openai = new OpenAI({ apiKey });
        
        // const completion = await openai.chat.completions.create({
        //     messages: [{ role: 'user', content: userMessage }],
        //     model,
        // });

        const response = 'Hello world red buill';
        
        // Save messages to Convex if we have a chat ID
        console.log('handleChatMessage - chatId:', chatId, 'userMessage:', userMessage, 'response:', response);
        
        if (chatId) {
            try {
                console.log('Saving user message to Convex...');
                await convexClient.mutation(api.chats.addMessage, {
                    chatId: chatId as any,
                    content: userMessage,
                    role: 'user'
                });
                console.log('User message saved successfully');
                
                console.log('Saving AI response to Convex...');
                await convexClient.mutation(api.chats.addMessage, {
                    chatId: chatId as any,
                    content: response,
                    role: 'assistant'
                });
                console.log('AI response saved successfully');
                
                console.log('All messages saved to Convex successfully');
            } catch (error) {
                console.error('Failed to save messages to Convex:', error);
            }
        } else {
            console.log('No chat ID available (chatId is null/undefined) - messages not saved to Convex');
        }
        
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
