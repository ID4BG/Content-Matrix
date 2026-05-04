import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { commentsTable, contentPiecesTable, activityTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  CreateCommentBody,
  DeleteCommentParams,
  ListCommentsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/comments", async (req, res) => {
  const params = ListCommentsQueryParams.parse(req.query);
  const comments = await db
    .select()
    .from(commentsTable)
    .where(eq(commentsTable.contentPieceId, params.contentPieceId))
    .orderBy(sql`${commentsTable.createdAt} asc`);
  res.json(comments);
});

router.post("/comments", async (req, res) => {
  const body = CreateCommentBody.parse(req.body);
  const [comment] = await db.insert(commentsTable).values(body).returning();

  const [piece] = await db.select().from(contentPiecesTable).where(eq(contentPiecesTable.id, body.contentPieceId));

  if (piece) {
    await db.insert(activityTable).values({
      type: "comment_added",
      description: `${body.authorName} commented on "${piece.title}"`,
      entityId: piece.campaignId,
      entityTitle: piece.title,
    });
  }

  res.status(201).json(comment);
});

router.delete("/comments/:id", async (req, res) => {
  const { id } = DeleteCommentParams.parse(req.params);
  await db.delete(commentsTable).where(eq(commentsTable.id, id));
  res.status(204).send();
});

export default router;
