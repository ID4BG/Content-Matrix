import { pgTable, serial, text, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const campaignStatusEnum = pgEnum("campaign_status", ["draft", "in_review", "approved", "published"]);

export const campaignsTable = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: campaignStatusEnum("status").notNull().default("draft"),
  folderId: integer("folder_id"),
  channels: text("channels").array().notNull().default(["source_article","instagram_reel","linkedin_post","youtube_long","youtube_short","facebook_carousel","facebook_group_post","reddit_post","threads_post"]),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCampaignSchema = createInsertSchema(campaignsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaignsTable.$inferSelect;
