import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * Send a chat request to a matched user
 */
export const send = mutation({
  args: {
    matchId: v.id("matches"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    // Get the match
    const match = await ctx.db.get(args.matchId);
    if (!match) throw new Error("Match not found");

    // Verify user is part of this match
    if (match.user1Id !== user._id && match.user2Id !== user._id) {
      throw new Error("Unauthorized");
    }

    // Determine the other user
    const toUserId = match.user1Id === user._id ? match.user2Id : match.user1Id;

    // Check if there's already a pending request between these users
    const existingRequest = await ctx.db
      .query("chatRequests")
      .filter((q) =>
        q.and(
          q.eq(q.field("matchId"), args.matchId),
          q.eq(q.field("status"), "pending")
        )
      )
      .first();

    if (existingRequest) {
      throw new Error("A request is already pending for this match");
    }

    // Check if there's an active chat session
    const activeSession = await ctx.db
      .query("chatSessions")
      .filter((q) =>
        q.and(
          q.or(
            q.and(
              q.eq(q.field("user1Id"), match.user1Id),
              q.eq(q.field("user2Id"), match.user2Id)
            ),
            q.and(
              q.eq(q.field("user1Id"), match.user2Id),
              q.eq(q.field("user2Id"), match.user1Id)
            )
          ),
          q.eq(q.field("status"), "active")
        )
      )
      .first();

    if (activeSession) {
      throw new Error("You already have an active chat with this person");
    }

    // Create the request
    const requestId = await ctx.db.insert("chatRequests", {
      fromUserId: user._id,
      toUserId,
      matchId: args.matchId,
      status: "pending",
      createdAt: Date.now(),
    });

    return { requestId };
  },
});

/**
 * Get pending requests for the current user
 */
export const listPending = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    // Get all pending requests to this user
    const requests = await ctx.db
      .query("chatRequests")
      .withIndex("by_to_user_and_status", (q) =>
        q.eq("toUserId", user._id).eq("status", "pending")
      )
      .order("desc")
      .collect();

    // Get sender details for each request
    const requestsWithSender = await Promise.all(
      requests.map(async (request) => {
        const sender = await ctx.db.get(request.fromUserId);
        const match = await ctx.db.get(request.matchId);

        return {
          _id: request._id,
          fromUser: sender
            ? {
                _id: sender._id,
                name: sender.name,
                age: sender.age,
                gender: sender.gender,
                bio: sender.bio,
                photos: sender.photos,
              }
            : null,
          matchId: request.matchId,
          chatSessionId: match?.chatSessionId,
          createdAt: request.createdAt,
        };
      })
    );

    return requestsWithSender.filter((r) => r.fromUser !== null);
  },
});

/**
 * Accept a chat request
 */
export const accept = mutation({
  args: {
    requestId: v.id("chatRequests"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    // Get the request
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Request not found");

    // Verify this request is for the current user
    if (request.toUserId !== user._id) {
      throw new Error("Unauthorized");
    }

    // Verify request is still pending
    if (request.status !== "pending") {
      throw new Error("Request is no longer pending");
    }

    // Get the match
    const match = await ctx.db.get(request.matchId);
    if (!match) throw new Error("Match not found");

    // Create a new chat session
    const sessionId = await ctx.db.insert("chatSessions", {
      user1Id: request.fromUserId,
      user2Id: request.toUserId,
      phase: "extended", // Skip speed dating for reconnections
      status: "active",
      startedAt: Date.now(),
    });

    // Update the match record to point to the new chat session
    await ctx.db.patch(request.matchId, {
      chatSessionId: sessionId,
    });

    // Update the request status
    await ctx.db.patch(args.requestId, {
      status: "accepted",
      respondedAt: Date.now(),
    });

    return { chatSessionId: sessionId };
  },
});

/**
 * Decline a chat request
 */
export const decline = mutation({
  args: {
    requestId: v.id("chatRequests"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    // Get the request
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Request not found");

    // Verify this request is for the current user
    if (request.toUserId !== user._id) {
      throw new Error("Unauthorized");
    }

    // Update the request status
    await ctx.db.patch(args.requestId, {
      status: "declined",
      respondedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Get request status for a match
 */
export const getStatusForMatch = query({
  args: {
    matchId: v.id("matches"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    // Check for pending request
    const pendingRequest = await ctx.db
      .query("chatRequests")
      .filter((q) =>
        q.and(
          q.eq(q.field("matchId"), args.matchId),
          q.eq(q.field("status"), "pending")
        )
      )
      .first();

    if (!pendingRequest) return { hasPending: false, isSender: false };

    return {
      hasPending: true,
      isSender: pendingRequest.fromUserId === user._id,
      requestId: pendingRequest._id,
    };
  },
});
