/* eslint-env browser */
/* global acquireVsCodeApi */

const vscode = acquireVsCodeApi();

// Chat state
let currentChatId = null;
let currentChatTitle = "New Chat";
let isNewChat = true;

// DOM elements
const chatMessages = document.querySelector('#chatMessages');
const messageInput = document.querySelector('#messageInput');
const sendButton = document.querySelector('#sendButton');
const sendButtonText = document.querySelector('#sendButtonText');
const newChatBtn = document.querySelector('#newChatBtn');
const chatList = document.querySelector('#chatList');
const currentChatTitleElement = document.querySelector('#currentChatTitle');

// Initialize the app
async function initializeApp() {
    // Load existing chats
    await loadChats();
    
    // Set up event listeners
    newChatBtn.addEventListener('click', createNewChat);
    
    // Focus input
    messageInput.focus();
}

// Create a new chat
async function createNewChat() {
    // Clear current chat
    currentChatId = null;
    currentChatTitle = "New Chat";
    isNewChat = true;
    
    // Update UI
    currentChatTitleElement.textContent = currentChatTitle;
    clearChatMessages();
    
    // Add welcome message
    addMessage("Hello! I'm your AI assistant. How can I help you today?", false);
    
    // Focus input
    messageInput.focus();
}

// Load existing chats from Convex
async function loadChats() {
    try {
        const response = await vscode.postMessage({
            command: 'getChats',
            userId: 'default-user' // For now, using a default user ID
        });
        
        // This will be handled by the extension
    } catch (error) {
        console.error('Error loading chats:', error);
    }
}

// Load messages for a specific chat
async function loadChatMessages(chatId) {
    try {
        const response = await vscode.postMessage({
            command: 'getChatMessages',
            chatId: chatId
        });
        
        // This will be handled by the extension
    } catch (error) {
        console.error('Error loading chat messages:', error);
    }
}

// Switch to a different chat
async function switchToChat(chatId, title) {
    currentChatId = chatId;
    currentChatTitle = title;
    isNewChat = false;
    
    // Update UI
    currentChatTitleElement.textContent = currentChatTitle;
    
    // Load messages for this chat
    await loadChatMessages(chatId);
    
    // Update active state in sidebar
    updateActiveChatInSidebar(chatId);
}

// Update active chat in sidebar
function updateActiveChatInSidebar(activeChatId) {
    // Remove active class from all chat items
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Add active class to current chat
    if (activeChatId) {
        const activeItem = document.querySelector(`[data-chat-id="${activeChatId}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }
    }
}

// Clear chat messages
function clearChatMessages() {
    chatMessages.innerHTML = '';
}

// Send message
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    sendButton.disabled = true;
    sendButtonText.textContent = 'Sending...';
    
    // Add user message to UI immediately
    addMessage(message, true);
    
    // Clear input
    messageInput.value = '';
    
    // If this is a new chat, create it first
    if (isNewChat) {
        try {
            const response = await vscode.postMessage({
                command: 'createChat',
                title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
                userId: 'default-user'
            });
            
            // This will be handled by the extension
        } catch (error) {
            console.error('Error creating chat:', error);
        }
    }
    
    // Send message to backend
    try {
        const response = await vscode.postMessage({
            command: 'sendMessage',
            text: message,
            chatId: currentChatId
        });
        
        // This will be handled by the extension
    } catch (error) {
        console.error('Error sending message:', error);
        addMessage('Error: Failed to send message', false);
        sendButton.disabled = false;
        sendButtonText.textContent = 'Send';
    }
}

// Add message to chat UI
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

// Render chat list in sidebar
function renderChatList(chats) {
    chatList.innerHTML = '';
    
    chats.forEach(chat => {
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item p-3 rounded-lg cursor-pointer';
        chatItem.setAttribute('data-chat-id', chat._id);
        
        // Format date
        const date = new Date(chat.updatedAt);
        const formattedDate = date.toLocaleDateString();
        
        chatItem.innerHTML = `
            <div class="text-sm font-medium text-white mb-1">${chat.title}</div>
            <div class="text-xs text-gray-400">${formattedDate}</div>
        `;
        
        chatItem.addEventListener('click', () => switchToChat(chat._id, chat.title));
        
        chatList.appendChild(chatItem);
    });
}

// Handle messages from the extension
window.addEventListener('message', event => {
    const message = event.data;
    switch (message.command) {
        case 'addMessage':
            addMessage(message.message, message.isUser);
            break;
        case 'setCurrentChat':
            currentChatId = message.chatId;
            currentChatTitle = message.title;
            isNewChat = false;
            currentChatTitleElement.textContent = currentChatTitle;
            break;
        case 'renderChatList':
            renderChatList(message.chats);
            break;
        case 'loadChatMessages':
            clearChatMessages();
            message.messages.forEach(msg => {
                addMessage(msg.content, msg.role === 'user');
            });
            break;
        case 'error':
            addMessage(`Error: ${message.message}`, false);
            sendButton.disabled = false;
            sendButtonText.textContent = 'Send';
            break;
    }
});

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);

// Make sendMessage globally available for inline event handlers
window.sendMessage = sendMessage;