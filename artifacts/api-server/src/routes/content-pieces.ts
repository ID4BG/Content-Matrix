import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  contentPiecesTable,
  commentsTable,
  activityTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  CreateContentPieceBody,
  UpdateContentPieceBody,
  GetContentPieceParams,
  UpdateContentPieceParams,
  DeleteContentPieceParams,
  ApproveContentPieceParams,
  ListContentPiecesQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/content-pieces", async (req, res) => {
  const params = ListContentPiecesQueryParams.parse(req.query);

  const pieces = params.campaignId
    ? await db.select().from(contentPiecesTable).where(eq(contentPiecesTable.campaignId, params.campaignId)).orderBy(sql`${contentPiecesTable.createdAt} asc`)
    : await db.select().from(contentPiecesTable).orderBy(sql`${contentPiecesTable.createdAt} desc`);

  const commentCounts = await db
    .select({ contentPieceId: commentsTable.contentPieceId, count: sql<number>`count(*)`.mapWith(Number) })
    .from(commentsTable)
    .groupBy(commentsTable.contentPieceId);

  const countMap = new Map(commentCounts.map((c) => [c.contentPieceId, c.count]));

  res.json(pieces.map((p) => ({ ...p, commentCount: countMap.get(p.id) ?? 0 })));
});

router.post("/content-pieces", async (req, res) => {
  const body = CreateContentPieceBody.parse(req.body);
  const [piece] = await db.insert(contentPiecesTable).values({ ...body, status: "uploaded" }).returning();

  await db.insert(activityTable).values({
    type: "piece_uploaded",
    description: `Content piece "${piece.title}" was uploaded`,
    entityId: piece.id,
    entityTitle: piece.title,
  });

  res.status(201).json({ ...piece, commentCount: 0 });
});

router.get("/content-pieces/:id", async (req, res) => {
  const { id } = GetContentPieceParams.parse(req.params);
  const [piece] = await db.select().from(contentPiecesTable).where(eq(contentPiecesTable.id, id));
  if (!piece) return res.status(404).json({ error: "Content piece not found" });

  const [countRow] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(commentsTable)
    .where(eq(commentsTable.contentPieceId, id));

  res.json({ ...piece, commentCount: countRow?.count ?? 0 });
});

router.patch("/content-pieces/:id", async (req, res) => {
  const { id } = UpdateContentPieceParams.parse(req.params);
  const body = UpdateContentPieceBody.parse(req.body);

  const [updated] = await db
    .update(contentPiecesTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(contentPiecesTable.id, id))
    .returning();

  if (!updated) return res.status(404).json({ error: "Content piece not found" });

  const [countRow] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(commentsTable)
    .where(eq(commentsTable.contentPieceId, id));

  res.json({ ...updated, commentCount: countRow?.count ?? 0 });
});

router.delete("/content-pieces/:id", async (req, res) => {
  const { id } = DeleteContentPieceParams.parse(req.params);
  await db.delete(contentPiecesTable).where(eq(contentPiecesTable.id, id));
  res.status(204).send();
});

router.post("/content-pieces/:id/approve", async (req, res) => {
  const { id } = ApproveContentPieceParams.parse(req.params);
  const [updated] = await db
    .update(contentPiecesTable)
    .set({ status: "approved", approvedAt: new Date(), updatedAt: new Date() })
    .where(eq(contentPiecesTable.id, id))
    .returning();

  if (!updated) return res.status(404).json({ error: "Content piece not found" });

  await db.insert(activityTable).values({
    type: "piece_approved",
    description: `Content piece "${updated.title}" was approved`,
    entityId: updated.id,
    entityTitle: updated.title,
  });

  const [countRow] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(commentsTable)
    .where(eq(commentsTable.contentPieceId, id));

  res.json({ ...updated, commentCount: countRow?.count ?? 0 });
});

export default router;
