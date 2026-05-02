import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { campaignsTable } from "./campaigns";

export const campaignMembersTable = pgTable("campaign_members", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaignsTable.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull().default("team_member"),
  accepted: boolean("accepted").notNull().default(false),
  invitedAt: timestamp("invited_at").notNull().defaultNow(),
});

export type CampaignMember = typeof campaignMembersTable.$inferSelect;
