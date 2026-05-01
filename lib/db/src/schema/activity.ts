import { pgTable, serial, text, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";

export const activityTypeEnum = pgEnum("activity_type", [
  "campaign_created",
  "piece_uploaded",
  "piece_approved",
  "comment_added",
  "campaign_approved",
]);

export const activityTable = pgTable("activity", {
  id: serial("id").primaryKey(),
  type: activityTypeEnum("type").notNull(),
  description: text("description").notNull(),
  entityId: integer("entity_id").notNull(),
  entityTitle: text("entity_title").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
