import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

/**
 * Get messages for a chat session (limited to prevent DoS)
 * Limits to 200 most recent messages - more than enough for a 15-minute chat
 */
export const list = query({
  args: {
    chatSessionId: v.id("chatSessions"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    // Get current user
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    // Get chat session
    const chatSession = await ctx.db.get(args.chatSessionId);
    if (!chatSession) throw new Error("Chat session not found");

    // Verify user is part of this chat
    if (chatSession.user1Id !== user._id && chatSession.user2Id !== user._id) {
      throw new Error("Unauthorized");
    }

    // Get messages (limited to 200 for DoS protection)
    // Using .take() instead of .collect() prevents fetching unbounded results
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chat_and_time", (q) =>
        q.eq("chatSessionId", args.chatSessionId)
      )
      .order("asc") // Oldest first for display
      .take(200); // Limit to 200 messages max

    // Get other user if in extended phase
    let otherUser = null;
    if (chatSession.phase === "extended") {
      const otherUserId =
        chatSession.user1Id === user._id
          ? chatSession.user2Id
          : chatSession.user1Id;
      otherUser = await ctx.db.get(otherUserId);
    }

    // Determine if other user is typing
    const isUser1 = chatSession.user1Id === user._id;
    const otherUserTyping = isUser1
      ? chatSession.user2Typing
      : chatSession.user1Typing;
    const otherUserLastTyping = isUser1
      ? chatSession.user2LastTyping
      : chatSession.user1LastTyping;

    // Check if typing status is stale (older than 5 seconds)
    const typingTimeout = 5000; // 5 seconds
    const isTypingActive = otherUserTyping &&
      otherUserLastTyping &&
      (Date.now() - otherUserLastTyping) < typingTimeout;

    return {
      messages,
      chatSession,
      otherUser,
      currentUserId: user._id, // Add current user's Convex ID for message ownership comparison
      otherUserIsTyping: isTypingActive || false,
    };
  },
});

/**
 * Send a message in a chat session
 * Includes input validation and rate limiting
 */
export const send = mutation({
  args: {
    chatSessionId: v.id("chatSessions"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    // Validate message content
    const trimmedContent = args.content.trim();

    if (!trimmedContent) {
      throw new Error("Message cannot be empty");
    }

    if (trimmedContent.length > 2000) {
      throw new Error("Message too long (max 2000 characters)");
    }

    // Get current user
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    // Get chat session
    const chatSession = await ctx.db.get(args.chatSessionId);
    if (!chatSession) throw new Error("Chat session not found");

    // Verify user is part of this chat
    if (chatSession.user1Id !== user._id && chatSession.user2Id !== user._id) {
      throw new Error("Unauthorized");
    }

    // Check if chat is still active
    if (chatSession.status !== "active") {
      throw new Error("Chat session is not active");
    }

    // Rate limiting: Check if user sent more than 10 messages in last 10 seconds
    const now = Date.now();
    const tenSecondsAgo = now - 10000;

    const recentMessages = await ctx.db
      .query("messages")
      .withIndex("by_chat_and_time", (q) =>
        q.eq("chatSessionId", args.chatSessionId)
      )
      .order("desc")
      .take(20); // Take recent messages to check

    const userRecentMessages = recentMessages.filter(
      (m) => m.senderId === user._id && m.createdAt > tenSecondsAgo
    );

    if (userRecentMessages.length >= 10) {
      throw new Error(
        "You're sending messages too quickly. Please wait a moment."
      );
    }

    // Insert message
    const messageId = await ctx.db.insert("messages", {
      chatSessionId: args.chatSessionId,
      senderId: user._id,
      content: trimmedContent,
      createdAt: now,
    });

    // Clear typing indicator after sending message
    const isUser1 = chatSession.user1Id === user._id;
    if (isUser1) {
      await ctx.db.patch(args.chatSessionId, {
        user1Typing: false,
      });
    } else {
      await ctx.db.patch(args.chatSessionId, {
        user2Typing: false,
      });
    }

    const message = await ctx.db.get(messageId);
    return message;
  },
});

/**
 * Leave a chat session
 */
export const leaveChat = mutation({
  args: {
    chatSessionId: v.id("chatSessions"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    const chatSession = await ctx.db.get(args.chatSessionId);
    if (!chatSession) throw new Error("Chat session not found");

    // Verify user is part of this chat
    if (chatSession.user1Id !== user._id && chatSession.user2Id !== user._id) {
      throw new Error("Unauthorized");
    }

    // End the session
    await ctx.db.patch(args.chatSessionId, {
      status: "ended",
      endedAt: Date.now(),
    });

    // Delete all messages for privacy
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chat_session", (q) => q.eq("chatSessionId", args.chatSessionId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    return { success: true };
  },
});

/**
 * Set typing indicator for current user
 */
export const setTyping = mutation({
  args: {
    chatSessionId: v.id("chatSessions"),
    isTyping: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    const chatSession = await ctx.db.get(args.chatSessionId);
    if (!chatSession) throw new Error("Chat session not found");

    // Verify user is part of this chat
    if (chatSession.user1Id !== user._id && chatSession.user2Id !== user._id) {
      throw new Error("Unauthorized");
    }

    // Check if chat is still active
    if (chatSession.status !== "active") {
      return { success: false };
    }

    // Determine which user fields to update
    const isUser1 = chatSession.user1Id === user._id;
    const now = Date.now();

    if (isUser1) {
      await ctx.db.patch(args.chatSessionId, {
        user1Typing: args.isTyping,
        user1LastTyping: now,
      });
    } else {
      await ctx.db.patch(args.chatSessionId, {
        user2Typing: args.isTyping,
        user2LastTyping: now,
      });
    }

    return { success: true };
  },
});
