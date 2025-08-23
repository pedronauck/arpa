import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  chats: defineTable({
    title: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    userId: v.string(), // For future user management
  }).index("by_user", ["userId"]),
  
  messages: defineTable({
    chatId: v.id("chats"),
    content: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    timestamp: v.number(),
    order: v.number(), // To maintain message order within a chat
  }).index("by_chat", ["chatId"]),
});
