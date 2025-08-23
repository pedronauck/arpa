import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

// Create a new chat
export const createChat = mutation({
    args: {
        title: v.string(),
        userId: v.string(),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        const chatId = await ctx.db.insert('chats', {
            title: args.title,
            createdAt: now,
            updatedAt: now,
            userId: args.userId,
        });

        return chatId;
    },
});

// Get all chats for a user
export const getChats = query({
    args: {
        userId: v.string(),
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query('chats')
            .withIndex('by_user', (q) => q.eq('userId', args.userId))
            .order('desc')
            .collect();
    },
});

// Get messages for a specific chat
export const getChatMessages = query({
    args: {
        chatId: v.id('chats'),
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query('messages')
            .withIndex('by_chat', (q) => q.eq('chatId', args.chatId))
            .order('asc')
            .collect();
    },
});

// Add a message to a chat
export const addMessage = mutation({
    args: {
        chatId: v.id('chats'),
        content: v.any(), // Changed to v.any() to support both strings and complex JSON
        role: v.union(v.literal('user'), v.literal('assistant')),
    },
    handler: async (ctx, args) => {
        // Get the current message count for this chat to set the order
        const existingMessages = await ctx.db
            .query('messages')
            .withIndex('by_chat', (q) => q.eq('chatId', args.chatId))
            .collect();

        const order = existingMessages.length;

        // Add the message
        const messageId = await ctx.db.insert('messages', {
            chatId: args.chatId,
            content: args.content,
            role: args.role,
            timestamp: Date.now(),
            order,
        });

        // Update the chat's updatedAt timestamp
        await ctx.db.patch(args.chatId, {
            updatedAt: Date.now(),
        });

        return messageId;
    },
});

// Update chat title
export const updateChatTitle = mutation({
    args: {
        chatId: v.id('chats'),
        title: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.chatId, {
            title: args.title,
            updatedAt: Date.now(),
        });
    },
});

// Delete a chat and all its messages
export const deleteChat = mutation({
    args: {
        chatId: v.id('chats'),
    },
    handler: async (ctx, args) => {
        // Delete all messages in the chat
        const messages = await ctx.db
            .query('messages')
            .withIndex('by_chat', (q) => q.eq('chatId', args.chatId))
            .collect();

        for (const message of messages) {
            await ctx.db.delete(message._id);
        }

        // Delete the chat
        await ctx.db.delete(args.chatId);
    },
});

// Aliases for compatibility
export const list = getChats;
export const create = createChat;
export const remove = deleteChat;
export const sendMessage = addMessage;
export const getMessages = getChatMessages;
