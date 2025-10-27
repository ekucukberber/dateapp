# CLAUDE.md

This file provides guidance to Claude Code when working with this codebase.

## Project Overview

**Random speed dating application**: Users are randomly paired for 15-minute anonymous chats. After the timer, both decide if they want to continue. If both say yes → profiles revealed + extended chat. If either says no → chat ends.

**Tech Stack**:
- **Frontend**: TanStack Start (React 19), shadcn/ui, Tailwind CSS v4
- **Backend**: Convex (serverless real-time database)
- **Auth**: Clerk (managed auth with JWT integration)
- **Real-time**: Convex handles WebSockets automatically via `useQuery` hooks

## Key Technical Concepts

### Convex Real-Time
- `useQuery` hooks auto-update when DB changes (no manual subscriptions)
- Types auto-generated in `convex/_generated/`
- See `src/routes/chat/$chatId.tsx` for real-time messaging example

### Matching Algorithm (`convex/queue.ts`)
- Uses atomic operations to prevent race conditions
- "Claim-first, verify-second" pattern prevents duplicate matches
- Random selection from queue with `isInQueue` index

### Authentication (Clerk + Convex)
- **Setup**: Create Clerk JWT template (select "Convex" preset) + `convex/auth.config.js`
- **Frontend**: `ClerkProvider` wraps `ConvexProviderWithClerk` with `useAuth` prop
- **Backend**: Access `ctx.auth.getUserIdentity()` in queries/mutations
- **User sync**: See `convex/users.ts` `getOrCreateCurrentUser` for graceful user creation without webhooks

## Development Workflow

### MCP Servers - REQUIRED for Code Changes
Before implementing ANY code changes, ground your approach using MCP servers:
1. **Research first**: Use context7 for docs, exa for real-world examples
2. **Implement second**: Follow verified patterns from MCP research
3. Use MCP for: TanStack Start/Router, shadcn/ui, React 19 patterns, unfamiliar APIs

### Dev Commands
```bash
# Terminal 1: Convex dev server
npx convex dev

# Terminal 2: Vite dev server
npm run dev

# Production
npm run build && npm run start
npx convex deploy  # Deploy backend
```

## Architecture Quick Reference

### File-Based Routing (TanStack Start)
- Routes in `src/routes/` export `Route` objects via `createFileRoute()`
- `src/routeTree.gen.ts` is auto-generated (never edit)
- Use `head()` function in `__root.tsx` for meta tags (not `<head>` tags)
- Path aliases: `@/*` and `~/*` → `src/*`

### Tailwind CSS v4 (Breaking Changes from v3!)
- Must use `@theme inline` block in `src/styles/app.css`
- CSS variables: prefix with `--color-` (e.g., `--color-border`)
- **NEVER use `@apply` with shadcn tokens** - use CSS properties directly
- Import syntax: `@import 'tailwindcss' source('../');`

### React Best Practices (Critical!)
- **Avoid useEffect for**: data transformation, event handlers, computed values
- **Use useEffect only for**: external systems (browser APIs), post-render side effects
- **Rule**: "User clicked button" → event handler | "Component mounted" → useEffect
- Use refs to prevent infinite loops (see `dashboard.tsx` example)

### shadcn/ui
- Config: `components.json` | Components: `src/components/ui/`
- Add: `npx shadcn@latest add [component-name]`

## Database (Convex)

### Schema (`convex/schema.ts`)
- **Tables**: users, chatSessions, messages, matches
- **No migrations**: Schema changes auto-applied by Convex
- **Key indexes**: `by_clerk_id`, `by_queue`, `by_chat_and_time`
- See `convex/schema.ts` for full schema

### Convex Function Types
- **Queries** (read-only): Use for fetching data
- **Mutations** (writes): Use for creating/updating/deleting
- **Actions** (external APIs): Use for third-party API calls
- **HTTP Actions** (webhooks): See `convex/http.ts` for Clerk webhook handler

### Message Privacy & ID Comparison
- **Privacy**: All messages deleted when chats end (see `convex/messages.ts` leaveChat)
- **CRITICAL**: Always compare Convex IDs to Convex IDs (never mix with Clerk IDs)
- Backend returns `currentUserId` (Convex ID) for message ownership comparison

## Authentication (Clerk)

### Setup
- **Required env vars**: `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `VITE_CONVEX_URL`
- **Config file**: `convex/auth.config.js` (Clerk domain + applicationID: "convex")
- **JWT Template**: Add custom claims for user data
  - In Clerk Dashboard → JWT Templates → Edit Convex template
  - Add: `{"username": "{{user.username}}"}`
  - Required for `identity.username` to be available in Convex functions
- **Webhook** (optional): Set `CLERK_WEBHOOK_SECRET` in Convex Dashboard
  - URL: `https://YOUR-DEPLOYMENT.convex.site/clerk-webhook`
  - Events: `user.created`, `user.updated`, `user.deleted`
  - Handler: `convex/http.ts` with Svix signature verification

### Key Patterns
- **Clerk components**: Use `routing="hash"` (NOT `routing="path"`) to avoid 404s
- **User sync**: Rely on webhooks for user creation (removed `getOrCreateCurrentUser` auto-creation to prevent deleted users from recreating)
- **Frontend**: `useUser()` hook from `@clerk/tanstack-react-start`
- **Backend**: `ctx.auth.getUserIdentity()` returns Clerk identity with `.subject` (Clerk ID)

### User Deletion Pattern (Important!)
**DO NOT auto-create users** - deleted users should stay deleted:
```typescript
// ❌ BAD: Auto-creates deleted users
useEffect(() => {
  if (!userExists) {
    await getOrCreateUser({})
  }
})

// ✅ GOOD: Show error for deleted users
if (queueStatus && !queueStatus.userExists) {
  return <div>Account Not Found - Sign Out</div>
}
```

**Cascade deletion order** (convex/users.ts `deleteFromClerk`):
1. Delete messages where `senderId = user._id`
2. Delete matches where `user1Id = user._id` OR `user2Id = user._id`
3. Delete chat sessions where `user1Id = user._id` OR `user2Id = user._id`
4. Finally delete user

## Design System

### Theme: Minimalist Black & White with 3D Shadows
- No gradients, black/white only, hard-edge shadows (not soft)
- Custom utilities: `.shadow-3d`, `.shadow-3d-sm`, `.shadow-3d-lg`, `.hover-lift`
- Buttons: 2px border + 4px shadow, press = translate(2px, 2px)
- Inputs: 2px border + 4px shadow, focus = 6px shadow + translate(-1px, -1px)

## Implementation Status

### ✅ Completed
- Core features: Auth, matching queue, 15-min speed dating, decision mechanism, extended chat
- Security: Webhook signature verification, race condition prevention, rate limiting, input validation
- Privacy: Message auto-deletion on chat end
- Performance: Query limiting, optimized re-renders, proper React patterns
- User management: Username display priority, cascade deletion from Clerk → Convex, deleted user error handling

### 🚧 Todo
- User profiles (editing, photo upload, Phase 2 visibility)
- Typing indicators, read receipts
- Match history, settings, report/block

## Key Files Reference
- **Backend**: `convex/schema.ts`, `convex/users.ts`, `convex/queue.ts`, `convex/messages.ts`, `convex/decisions.ts`, `convex/http.ts`
- **Frontend**: `src/routes/__root.tsx`, `src/routes/dashboard.tsx`, `src/routes/chat/$chatId.tsx`
- **Config**: `src/styles/app.css`, `vite.config.ts`, `convex/auth.config.js`

## Critical Lessons Learned

### 1. Never Mix ID Types
**Problem**: Messages appeared on wrong side
**Cause**: Compared `message.senderId` (Convex ID) with `user?.id` (Clerk ID)
**Fix**: Backend returns `currentUserId` (Convex ID) for comparison

### 2. Clerk Routing
**Use**: `routing="hash"` (NOT `routing="path"`) to avoid 404s on callbacks
**Add**: `signInFallbackRedirectUrl="/dashboard"` to `ClerkProvider`

### 3. Convex Auth Config
**Required**: `convex/auth.config.js` with Clerk domain + Convex JWT template
**Deploy**: `npx convex deploy -y` after creating auth config

### 4. Index Names
**Always** check `convex/schema.ts` for exact index names (e.g., `by_chat_and_time` not `by_session`)

### 5. Privacy by Default
Messages deleted on chat end in `convex/messages.ts` (leaveChat) and `convex/decisions.ts` (makeDecision)

### 6. Username Priority in JWT Template
**Problem**: Convex stored "First Last" instead of username
**Cause**: `identity.username` not included in default Clerk JWT claims
**Fix**: Add custom claim in Clerk JWT template: `{"username": "{{user.username}}"}`
**Priority order**: `username` → `givenName` → `name` → `nickname` → "User"

### 7. User Deletion Must Cascade
**Problem**: User deletion failed, user auto-recreated after deletion
**Cause**: Related data (messages, matches, sessions) blocked deletion + `getOrCreateCurrentUser` ran on page load
**Fix**:
- Cascade delete: messages → matches → chat sessions → user (in that order)
- Remove auto-creation logic from `dashboard.tsx`
- Show "Account Not Found" error for deleted users instead of recreating them

### 8. Webhook URL Pattern
**Problem**: Webhooks returned 404
**Cause**: Used `.cloud` domain instead of `.site`
**Fix**: Convex HTTP routes deploy to `https://[deployment].convex.site/[path]` (NOT `.cloud`)
**Important**: Run `npx convex dev` to deploy HTTP routes to dev deployment

### 9. React Function Initialization Order
**Problem**: "Cannot access before initialization" error
**Cause**: Function used in early return before being defined
**Fix**: Define all handler functions BEFORE any conditional returns/JSX that use them

## Troubleshooting
- **401 errors**: Check Clerk JWT template + `convex/auth.config.js` + deploy auth config
- **Messages on wrong side**: Backend must return `currentUserId` (Convex ID)
- **404 on callbacks**: Use `routing="hash"` in Clerk components
- **404 on webhooks**: Use `.site` not `.cloud` + ensure `npx convex dev` is running
- **Index errors**: Verify exact index name in `convex/schema.ts`
- **Wrong username displayed**: Add `username` to Clerk JWT template custom claims
- **User auto-recreates after deletion**: Remove `getOrCreateCurrentUser` from dashboard
- **User deletion fails**: Check cascade deletion order (messages → matches → sessions → user)
- **Function initialization error**: Move function definitions before early returns

## Security & Performance (Production-Ready)

### Security Implementations
1. **Webhook verification** (`convex/http.ts`): Svix signature validation (requires `npm install svix` + `CLERK_WEBHOOK_SECRET`)
2. **Race condition prevention** (`convex/queue.ts`): "Claim-first, verify-second" pattern in matching
3. **Query limits** (`convex/messages.ts`): Use `.take(200)` instead of `.collect()`
4. **Input validation**: Max 2000 chars, rate limit 10 msgs/10sec
5. **Active session check**: Prevent queue join during active chat

### Performance Optimizations
1. **useEffect ref pattern**: Use `useRef` to prevent infinite loops (see `dashboard.tsx`)
2. **Timer optimization**: Only update state when value changes (reduces 60 re-renders/min → 1)
3. **Error boundaries**: Handle loading/error states gracefully in `chat/$chatId.tsx`

### Production Checklist
- [ ] Set `CLERK_WEBHOOK_SECRET` in Convex Dashboard
- [ ] Configure webhook URL: `https://YOUR-DEPLOYMENT.convex.site/clerk-webhook` (use `.site` not `.cloud`)
- [ ] Enable webhook events: `user.created`, `user.updated`, `user.deleted`
- [ ] Add `username` to Clerk JWT template: `{"username": "{{user.username}}"}`
- [ ] Test: webhook verification, user creation, user deletion, username display
- [ ] Test: race conditions, rate limiting, error states
- [ ] Verify deleted users cannot recreate themselves
