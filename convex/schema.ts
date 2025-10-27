import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Convex Schema for Dating App
 * Migrated from PostgreSQL + Drizzle schema
 */

export default defineSchema({
  // Users table (combines Better-auth user with dating app fields)
  users: defineTable({
    // Clerk will provide the user ID
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    emailVerified: v.optional(v.boolean()),
    image: v.optional(v.string()),

    // Dating app specific fields
    age: v.optional(v.number()),
    gender: v.optional(v.union(v.literal("male"), v.literal("female"), v.literal("other"))),
    genderPreference: v.optional(v.union(v.literal("male"), v.literal("female"), v.literal("both"))),
    bio: v.optional(v.string()),
    photos: v.optional(v.array(v.string())),
    isInQueue: v.boolean(),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_queue", ["isInQueue"]),

  // Chat sessions table
  chatSessions: defineTable({
    user1Id: v.id("users"),
    user2Id: v.id("users"),
    phase: v.union(v.literal("speed_dating"), v.literal("extended")),
    status: v.union(v.literal("active"), v.literal("ended"), v.literal("waiting_reveal")),

    user1WantsContinue: v.optional(v.boolean()),
    user2WantsContinue: v.optional(v.boolean()),

    // Typing indicators
    user1Typing: v.optional(v.boolean()),
    user1LastTyping: v.optional(v.number()),
    user2Typing: v.optional(v.boolean()),
    user2LastTyping: v.optional(v.number()),

    startedAt: v.number(),
    speedDatingEndsAt: v.optional(v.number()), // 15 minutes from startedAt
    endedAt: v.optional(v.number()),
  })
    .index("by_user1", ["user1Id"])
    .index("by_user2", ["user2Id"])
    .index("by_status", ["status"])
    .index("by_users", ["user1Id", "user2Id"]),

  // Messages table
  messages: defineTable({
    chatSessionId: v.id("chatSessions"),
    senderId: v.id("users"),
    content: v.string(),
    createdAt: v.number(),
    readAt: v.optional(v.number()),
  })
    .index("by_chat_session", ["chatSessionId"])
    .index("by_chat_and_time", ["chatSessionId", "createdAt"]),

  // Matches table (mutual interest)
  matches: defineTable({
    user1Id: v.id("users"),
    user2Id: v.id("users"),
    chatSessionId: v.id("chatSessions"),
    matchedAt: v.number(),
  })
    .index("by_user1", ["user1Id"])
    .index("by_user2", ["user2Id"])
    .index("by_users", ["user1Id", "user2Id"])
    .index("by_chat_session", ["chatSessionId"]),
});
