import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { Webhook } from "svix";

const http = httpRouter();

/**
 * Clerk webhook payload types
 */
interface ClerkWebhookPayload {
  type: string;
  data: {
    id: string;
    email_addresses?: Array<{ email_address: string }>;
    first_name?: string;
    username?: string;
    image_url?: string;
  };
}

/**
 * Validates incoming webhook request using Svix signature verification
 * @param request - The incoming HTTP request
 * @returns The validated webhook payload or null if verification fails
 */
async function validateRequest(
  request: Request
): Promise<ClerkWebhookPayload | null> {
  // Extract webhook secret from environment
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("CLERK_WEBHOOK_SECRET not configured");
    return null;
  }

  // Get the raw payload as text (required for signature verification)
  const payloadString = await request.text();

  // Extract Svix headers
  const svixHeaders = {
    "svix-id": request.headers.get("svix-id")!,
    "svix-timestamp": request.headers.get("svix-timestamp")!,
    "svix-signature": request.headers.get("svix-signature")!,
  };

  // Check if all required headers are present
  if (!svixHeaders["svix-id"] || !svixHeaders["svix-timestamp"] || !svixHeaders["svix-signature"]) {
    console.error("Missing required Svix headers");
    return null;
  }

  // Verify the webhook signature using Svix
  const wh = new Webhook(webhookSecret);

  try {
    return wh.verify(payloadString, svixHeaders) as unknown as ClerkWebhookPayload;
  } catch (error) {
    console.error("Webhook signature verification failed:", error);
    return null;
  }
}

/**
 * Clerk webhook handler
 * Syncs user data from Clerk to Convex with signature verification
 */
http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Validate the webhook signature
    const payload = await validateRequest(request);

    if (!payload) {
      console.error("Webhook validation failed");
      return new Response("Unauthorized - Invalid webhook signature", { status: 401 });
    }

    console.log(`Received webhook event: ${payload.type}`);

    // Handle user.created and user.updated events
    if (payload.type === "user.created" || payload.type === "user.updated") {
      const user = payload.data;

      await ctx.runMutation(internal.users.upsertFromClerk, {
        clerkId: user.id,
        email: user.email_addresses?.[0]?.email_address || "",
        name: user.username || user.first_name || "User", // Prioritize username, then first_name
        imageUrl: user.image_url,
      });

      console.log(`✅ Successfully processed ${payload.type} for user ${user.id}`);
    } else if (payload.type === "user.deleted") {
      const user = payload.data;

      console.log(`🗑️  Attempting to delete user ${user.id} from Convex...`);

      await ctx.runMutation(internal.users.deleteFromClerk, {
        clerkId: user.id,
      });

      console.log(`✅ Successfully deleted user ${user.id} from Convex`);
    } else {
      console.log(`⚠️  Ignored webhook event type: ${payload.type}`);
    }

    return new Response(null, { status: 200 });
  }),
});

export default http;
