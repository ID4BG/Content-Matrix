# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Content Hub App

A personal content multiplier dashboard for multi-channel content distribution.

### Features
- Create campaigns (each campaign = one content piece distributed across channels)
- Content piece windows for each channel: Instagram Reel, LinkedIn Post, YouTube Long/Short, Facebook Carousel, Facebook Group Post, Reddit Post, Threads Post, Source Article
- Team collaboration: comments, reviews, inline text editing
- Owner approval workflow per piece and per campaign
- Dashboard with stats and activity feed

### DB Schema (lib/db/src/schema/)
- `campaigns` — campaign metadata with status (draft, in_review, approved, published)
- `content_pieces` — one row per channel per campaign, with status (empty, uploaded, in_review, approved, needs_revision)
- `comments` — threaded comments on content pieces
- `activity` — activity log for dashboard feed

### API Routes (artifacts/api-server/src/routes/)
- `/api/campaigns` — CRUD + approve
- `/api/content-pieces` — CRUD + approve, filterable by campaignId
- `/api/comments` — list by contentPieceId, create, delete
- `/api/dashboard/summary` — stats overview
- `/api/dashboard/activity` — recent activity feed

### Notes
- `lib/api-spec/package.json` codegen script overwrites `lib/api-zod/src/index.ts` after orval runs to avoid duplicate type exports
- `lib/api-spec/orval.config.ts` uses schemas path for types folder; the index.ts fix prevents TS2308 ambiguity errors
