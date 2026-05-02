import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  contentPiecesTable,
  commentsTable,
  activityTable,
  campaignMembersTable,
  campaignsTable,
} from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import {
  CreateContentPieceBody,
  UpdateContentPieceBody,
  GetContentPieceParams,
  UpdateContentPieceParams,
  DeleteContentPieceParams,
  ApproveContentPieceParams,
  DisapproveContentPieceParams,
  SubmitContentPieceForReviewParams,
  SubmitContentPieceForReviewBody,
  ListContentPiecesQueryParams,
} from "@workspace/api-zod";
import { sendReviewNotification } from "../email";

const router: IRouter = Router();

async function getPieceWithCommentCount(pieceId: number) {
  const [countRow] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(commentsTable)
    .where(eq(commentsTable.contentPieceId, pieceId));
  return countRow?.count ?? 0;
}

router.get("/content-pieces", async (req, res) => {
  const params = ListContentPiecesQueryParams.parse(req.query);

  const conditions: ReturnType<typeof eq>[] = [];
  if (params.campaignId) conditions.push(eq(contentPiecesTable.campaignId, params.campaignId));
  if (params.channel) conditions.push(eq(contentPiecesTable.channel, params.channel as any));

  const pieces = conditions.length
    ? await db.select().from(contentPiecesTable).where(and(...conditions)).orderBy(sql`${contentPiecesTable.scheduledDate} asc nulls last, ${contentPiecesTable.createdAt} asc`)
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
  const insertData: any = {
    campaignId: body.campaignId,
    channel: body.channel,
    title: body.title,
    bodyText: body.bodyText ?? null,
    mediaUrl: body.mediaUrl ?? null,
    mediaType: body.mediaType ?? null,
    status: "uploaded",
  };
  if (body.scheduledDate) insertData.scheduledDate = new Date(body.scheduledDate);

  const [piece] = await db.insert(contentPiecesTable).values(insertData).returning();

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
  const commentCount = await getPieceWithCommentCount(id);
  res.json({ ...piece, commentCount });
});

router.patch("/content-pieces/:id", async (req, res) => {
  const { id } = UpdateContentPieceParams.parse(req.params);
  const body = UpdateContentPieceBody.parse(req.body);

  const updateData: any = { updatedAt: new Date() };
  if (body.title !== undefined) updateData.title = body.title;
  if (body.bodyText !== undefined) updateData.bodyText = body.bodyText;
  if (body.mediaUrl !== undefined) updateData.mediaUrl = body.mediaUrl;
  if (body.mediaType !== undefined) updateData.mediaType = body.mediaType;
  if (body.status !== undefined) updateData.status = body.status;
  if (body.scheduledDate !== undefined) {
    updateData.scheduledDate = body.scheduledDate ? new Date(body.scheduledDate) : null;
  }

  const [updated] = await db
    .update(contentPiecesTable)
    .set(updateData)
    .where(eq(contentPiecesTable.id, id))
    .returning();

  if (!updated) return res.status(404).json({ error: "Content piece not found" });
  const commentCount = await getPieceWithCommentCount(id);
  res.json({ ...updated, commentCount });
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

  const commentCount = await getPieceWithCommentCount(id);
  res.json({ ...updated, commentCount });
});

router.post("/content-pieces/:id/disapprove", async (req, res) => {
  const { id } = DisapproveContentPieceParams.parse(req.params);
  const [piece] = await db.select().from(contentPiecesTable).where(eq(contentPiecesTable.id, id));
  if (!piece) return res.status(404).json({ error: "Content piece not found" });
  if (piece.status !== "approved") return res.status(400).json({ error: "Piece is not approved" });

  const [updated] = await db
    .update(contentPiecesTable)
    .set({ status: "needs_revision", approvedAt: null, updatedAt: new Date() })
    .where(eq(contentPiecesTable.id, id))
    .returning();

  const commentCount = await getPieceWithCommentCount(id);
  res.json({ ...updated, commentCount });
});

router.post("/content-pieces/:id/submit-review", async (req, res) => {
  const { id } = SubmitContentPieceForReviewParams.parse(req.params);
  const body = SubmitContentPieceForReviewBody.parse(req.body);

  const [piece] = await db.select().from(contentPiecesTable).where(eq(contentPiecesTable.id, id));
  if (!piece) return res.status(404).json({ error: "Content piece not found" });

  const [updated] = await db
    .update(contentPiecesTable)
    .set({ status: "in_review", updatedAt: new Date() })
    .where(eq(contentPiecesTable.id, id))
    .returning();

  if (body.reviewerMemberId) {
    const [reviewer] = await db
      .select()
      .from(campaignMembersTable)
      .where(eq(campaignMembersTable.id, body.reviewerMemberId));

    if (reviewer) {
      const [campaign] = await db
        .select()
        .from(campaignsTable)
        .where(eq(campaignsTable.id, piece.campaignId));

      const domain = process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost";
      const pieceUrl = `https://${domain}/campaigns/${piece.campaignId}/pieces/${piece.id}`;

      await sendReviewNotification({
        to: reviewer.email,
        reviewerName: reviewer.firstName
          ? `${reviewer.firstName} ${reviewer.lastName}`.trim()
          : reviewer.email,
        pieceTitle: piece.title,
        campaignTitle: campaign?.title ?? "Campaign",
        note: body.note,
        pieceUrl,
      }).catch(() => {});
    }
  }

  const commentCount = await getPieceWithCommentCount(id);
  res.json({ ...updated, commentCount });
});

export default router;
