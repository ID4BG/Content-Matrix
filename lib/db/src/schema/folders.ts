import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const foldersTable = pgTable("folders", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  parentFolderName: text("parent_folder_name"),
  description: text("description"),
  shareToken: text("share_token"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Folder = typeof foldersTable.$inferSelect;
