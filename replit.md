# Content Matrix

A multi-user content distribution dashboard built with a React + Vite frontend, Express API backend, and PostgreSQL database.

## Architecture

### Monorepo Structure
- `artifacts/content-hub/` — React + Vite frontend (@workspace/content-hub)
- `artifacts/api-server/` — Express API server (@workspace/api-server)
- `lib/api-spec/` — OpenAPI specification source of truth
- `lib/api-zod/` — Generated Zod schemas (from codegen)
- `lib/api-client-react/` — Generated React Query hooks (from codegen)

### Tech Stack
- **Frontend**: React 18, Vite, Wouter (routing), TanStack Query, shadcn/ui, Tailwind CSS v4, Montserrat font
- **Auth**: Clerk (Replit-managed, appId: app_3DATT9lSpYZx1etDuDv4QJ7naBs)
- **Backend**: Express, TypeScript, Drizzle ORM
- **Database**: PostgreSQL (via DATABASE_URL)
- **API Contract**: OpenAPI → codegen (Orval) → Zod schemas + React Query hooks

## Key Features

1. **Campaigns** — Create multi-channel content campaigns with 9 supported channels:
   - Instagram Reel, LinkedIn Post, YouTube Long/Short
   - Facebook Carousel, Facebook Group Post, Reddit Post, Threads Post, Source Article
2. **Folders** — Organize campaigns into folders, share folders via public token links
3. **Content Pieces** — Upload files per channel, inline editing, status workflow (draft → in_review → approved)
4. **Comments** — Threaded comments on each content piece for collaboration
5. **Dashboard** — Personal per-user dashboard with summary stats and recent activity
6. **Settings** — User profile, sign out via Clerk

## Database Schema

Tables: `campaigns`, `content_pieces`, `comments`, `folders`

- `campaigns`: id, title, description, status, userId (Clerk user ID), folderId, channels (text[]), createdAt, updatedAt
- `folders`: id, title, description, userId, shareToken (for public sharing), campaignCount (computed)
- `content_pieces`: id, campaignId, channel, title, body, fileUrl, status, createdAt, updatedAt
- `comments`: id, contentPieceId, authorName, text, createdAt

## Auth Pattern

- Clerk auth with `requireAuth` middleware on all private API routes
- All data scoped to `userId` from Clerk JWT
- Frontend uses `Show when="signed-in/signed-out"` for conditional rendering
- Clerk proxy (`clerkProxyMiddleware`) wired in `app.ts` for production

## API Routes

All routes prefixed with `/api`:
- `GET/POST /api/campaigns` — list (user-scoped) / create
- `GET/PUT/DELETE /api/campaigns/:id` — get / update / delete
- `POST /api/campaigns/:id/approve` — approve campaign
- `PATCH /api/campaigns/:id/channels` — update channel list
- `GET/POST /api/campaigns/:id/content-pieces` — list / create pieces
- `GET/PUT /api/content-pieces/:id` — get / update piece
- `POST /api/content-pieces/:id/approve` — approve piece
- `GET/POST /api/content-pieces/:id/comments` — list / create comments
- `GET/POST /api/folders` — list / create folders
- `GET/PUT/DELETE /api/folders/:id` — get / update / delete folder
- `POST /api/folders/:id/share` — generate share token
- `GET /api/folders/shared/:token` — public shared folder view
- `GET /api/dashboard/summary` — user dashboard summary
- `GET /api/dashboard/recent-activity` — recent activity feed

## Codegen

Run after changing `lib/api-spec/src/openapi.yaml`:
```bash
pnpm --filter @workspace/api-spec run codegen
```

## Environment Variables / Secrets

- `DATABASE_URL` — PostgreSQL connection string
- `SESSION_SECRET` — Session secret
- `CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` — Clerk auth (Replit-managed)
- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk publishable key for frontend

## Design

- White, elegant aesthetic
- Montserrat font throughout
- Black/white primary palette with subtle borders
- Sharp corners (no border-radius) for editorial feel
- All typography uses uppercase tracking for labels
