import { pgTable, serial, text, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { campaignsTable } from "./campaigns";

export const channelEnum = pgEnum("channel", [
  "instagram_reel",
  "tiktok_post",
  "x_post",
  "linkedin_post",
  "youtube_long",
  "youtube_short",
  "facebook_carousel",
  "facebook_group_post",
  "reddit_post",
  "threads_post",
  "source_article",
]);

export const mediaTypeEnum = pgEnum("media_type", ["image", "video", "carousel", "text", "article"]);

export const contentPieceStatusEnum = pgEnum("content_piece_status", [
  "empty",
  "uploaded",
  "in_review",
  "approved",
  "needs_revision",
]);

export const contentPiecesTable = pgTable("content_pieces", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaignsTable.id, { onDelete: "cascade" }),
  channel: channelEnum("channel").notNull(),
  title: text("title").notNull(),
  bodyText: text("body_text"),
  mediaUrl: text("media_url"),
  mediaType: mediaTypeEnum("media_type"),
  status: contentPieceStatusEnum("status").notNull().default("empty"),
  scheduledDate: timestamp("scheduled_date"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertContentPieceSchema = createInsertSchema(contentPiecesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertContentPiece = z.infer<typeof insertContentPieceSchema>;
export type ContentPiece = typeof contentPiecesTable.$inferSelect;
