import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('ARPA Chat extension is now active!');

    // Register webview provider for sidebar
    const provider = new ArpaChatViewProvider(context);
    const sidebarView = vscode.window.registerWebviewViewProvider(
        'arpa.chatView',
        provider,
        {
            webviewOptions: {
                retainContextWhenHidden: true
            }
        }
    );

    context.subscriptions.push(sidebarView);
}

export function deactivate() {}

class ArpaChatViewProvider implements vscode.WebviewViewProvider {
    constructor(
        private readonly _extensionContext: vscode.ExtensionContext
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        webviewView.webview.options = {
            enableScripts: true
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const config = vscode.workspace.getConfiguration('arpa');
        const appUrl = config.get<string>('appUrl', 'http://localhost:5173');
        
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>ARPA Chat</title>
                <style>
                    body, html {
                        margin: 0;
                        padding: 0;
                        width: 100%;
                        height: 100vh;
                        overflow: hidden;
                    }
                    iframe {
                        width: 100%;
                        height: 100%;
                        border: none;
                    }
                </style>
            </head>
            <body>
                <iframe src="${appUrl}" allow="clipboard-read; clipboard-write"></iframe>
            </body>
            </html>
        `;
    }
}