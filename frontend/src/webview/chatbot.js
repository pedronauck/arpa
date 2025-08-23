/* eslint-env browser */
/* global acquireVsCodeApi */

const vscode = acquireVsCodeApi();
const chatMessages = document.querySelector('#chatMessages');
const messageInput = document.querySelector('#messageInput');
const sendButton = document.querySelector('#sendButton');
const sendButtonText = document.querySelector('#sendButtonText');

function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    sendButton.disabled = true;
    sendButtonText.textContent = 'Sending...';
    
    vscode.postMessage({
        command: 'sendMessage',
        text: message
    });
    
    messageInput.value = '';
}

function addMessage(message, isUser) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `flex mb-4 ${isUser ? 'justify-end' : ''}`;
    
    const bubble = document.createElement('div');
    bubble.className = `rounded-lg p-3 max-w-md break-words ${
        isUser ? 'ml-auto' : 'mr-auto'}`;
    
    if (isUser) {
        bubble.className += ' message-user';
        bubble.innerHTML = `
            <div class="flex items-center gap-2 mb-1 justify-end">
                <span class="text-sm font-bold">You</span>
                <span class="w-2 h-2 rounded-full status-dot-user"></span>
            </div>
            <p class="text-sm font-medium">${message}</p>
        `;
    } else {
        bubble.className += ' message-ai';
        bubble.innerHTML = `
            <div class="flex items-center gap-2 mb-1">
                <span class="w-2 h-2 rounded-full status-dot-ai"></span>
                <span class="text-sm font-bold">Assistant</span>
            </div>
            <p class="text-sm">${message}</p>
        `;
    }
    
    messageDiv.append(bubble);
    chatMessages.append(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    if (!isUser) {
        sendButton.disabled = false;
        sendButtonText.textContent = 'Send';
    }
}

window.addEventListener('message', event => {
    const message = event.data;
    switch (message.command) {
        case 'addMessage':
            addMessage(message.message, message.isUser);
            break;
    }
});

// Auto-focus the input when the page loads
document.addEventListener('DOMContentLoaded', () => {
    messageInput.focus();
});

// Make sendMessage globally available for inline event handlers
window.sendMessage = sendMessage;