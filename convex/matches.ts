import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * Get current user's match history
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    // Get all matches where user is involved
    const matches = await ctx.db
      .query("matches")
      .filter((q) =>
        q.or(
          q.eq(q.field("user1Id"), user._id),
          q.eq(q.field("user2Id"), user._id)
        )
      )
      .order("desc")
      .collect();

    // Get match details with other user's profile
    const matchesWithProfiles = await Promise.all(
      matches.map(async (match) => {
        const otherUserId =
          match.user1Id === user._id ? match.user2Id : match.user1Id;
        const otherUser = await ctx.db.get(otherUserId);

        // Check if there's an active chat session for this match
        const chatSession = await ctx.db.get(match.chatSessionId);
        const hasActiveChat = chatSession?.status === "active";

        // Check for pending request
        const pendingRequest = await ctx.db
          .query("chatRequests")
          .filter((q) =>
            q.and(
              q.eq(q.field("matchId"), match._id),
              q.eq(q.field("status"), "pending")
            )
          )
          .first();

        return {
          _id: match._id,
          matchedAt: match.matchedAt,
          chatSessionId: match.chatSessionId,
          hasActiveChat,
          hasPendingRequest: !!pendingRequest,
          isRequestSender: pendingRequest?.fromUserId === user._id,
          otherUser: otherUser
            ? {
                _id: otherUser._id,
                name: otherUser.name,
                age: otherUser.age,
                gender: otherUser.gender,
                bio: otherUser.bio,
                photos: otherUser.photos,
              }
            : null,
        };
      })
    );

    return matchesWithProfiles.filter((m) => m.otherUser !== null);
  },
});
