import { pgTable, serial, text, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { campaignsTable } from "./campaigns";

export const campaignMembersTable = pgTable("campaign_members", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaignsTable.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  firstName: text("first_name").notNull().default(""),
  lastName: text("last_name").notNull().default(""),
  role: text("role").notNull().default("team_member"),
  permissions: jsonb("permissions").$type<string[]>().notNull().default([]),
  accepted: boolean("accepted").notNull().default(false),
  invitedAt: timestamp("invited_at").notNull().defaultNow(),
});

export type CampaignMember = typeof campaignMembersTable.$inferSelect;
