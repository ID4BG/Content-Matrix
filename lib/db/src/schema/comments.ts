import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { contentPiecesTable } from "./content-pieces";

export const commentsTable = pgTable("comments", {
  id: serial("id").primaryKey(),
  contentPieceId: integer("content_piece_id").notNull().references(() => contentPiecesTable.id, { onDelete: "cascade" }),
  authorName: text("author_name").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCommentSchema = createInsertSchema(commentsTable).omit({ id: true, createdAt: true });
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof commentsTable.$inferSelect;
