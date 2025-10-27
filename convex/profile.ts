import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Get current user's profile
 */
export const get = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    return user;
  },
});

/**
 * Generate upload URL for profile photo
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Update user profile
 */
export const update = mutation({
  args: {
    age: v.optional(v.number()),
    gender: v.optional(v.union(v.literal("male"), v.literal("female"), v.literal("other"))),
    genderPreference: v.optional(v.union(v.literal("male"), v.literal("female"), v.literal("both"))),
    bio: v.optional(v.string()),
    photoStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    // Validate age
    if (args.age !== undefined && (args.age < 18 || args.age > 100)) {
      throw new Error("Age must be between 18 and 100");
    }

    // Validate bio length
    if (args.bio !== undefined && args.bio.length > 500) {
      throw new Error("Bio must be 500 characters or less");
    }

    const updateData: any = {
      updatedAt: Date.now(),
    };

    if (args.age !== undefined) updateData.age = args.age;
    if (args.gender !== undefined) updateData.gender = args.gender;
    if (args.genderPreference !== undefined) updateData.genderPreference = args.genderPreference;
    if (args.bio !== undefined) updateData.bio = args.bio;

    // Handle photo update
    if (args.photoStorageId !== undefined) {
      // Get the storage URL
      const photoUrl = await ctx.storage.getUrl(args.photoStorageId);
      if (photoUrl) {
        // Delete old photo if exists
        if (user.photos && user.photos.length > 0) {
          // Note: In a production app, you'd want to track storage IDs to delete old files
          // For now, we just replace the URL
        }
        updateData.photos = [photoUrl];
      }
    }

    await ctx.db.patch(user._id, updateData);

    return { success: true };
  },
});

/**
 * Get profile photo URL from storage ID
 */
export const getPhotoUrl = query({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});
