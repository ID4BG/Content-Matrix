import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  contentPiecesTable,
  commentsTable,
  activityTable,
  campaignMembersTable,
  campaignsTable,
} from "@workspace/db";
import { eq, sql, and, max } from "drizzle-orm";
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
import { requireAuth } from "../middlewares/requireAuth";
import { clerkClient } from "@clerk/express";

const router: IRouter = Router();

const ROLE_PERMISSIONS: Record<string, string[]> = {
  owner:       ["view", "comment", "create", "edit", "delete", "approve"],
  marketer:    ["view", "comment", "create", "edit"],
  team_member: ["view", "comment"],
};

async function getPieceWithCommentCount(pieceId: number) {
  const [countRow] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(commentsTable)
    .where(eq(commentsTable.contentPieceId, pieceId));
  return countRow?.count ?? 0;
}

async function getUserRoleForCampaign(userId: string, campaignId: number): Promise<string | null> {
  const [campaign] = await db
    .select({ userId: campaignsTable.userId })
    .from(campaignsTable)
    .where(eq(campaignsTable.id, campaignId));
  if (!campaign) return null;
  if (campaign.userId === userId) return "owner";
  try {
    const clerkUser = await clerkClient.users.getUser(userId);
    const email = clerkUser.emailAddresses?.[0]?.emailAddress;
    if (!email) return null;
    const [member] = await db
      .select({ role: campaignMembersTable.role })
      .from(campaignMembersTable)
      .where(and(
        eq(campaignMembersTable.campaignId, campaignId),
        eq(campaignMembersTable.email, email),
        eq(campaignMembersTable.accepted, true),
      ));
    return member?.role ?? null;
  } catch {
    return null;
  }
}

function can(role: string | null, permission: string): boolean {
  if (!role) return false;
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission);
}

router.get("/content-pieces", requireAuth, async (req, res) => {
  const params = ListContentPiecesQueryParams.parse(req.query);

  const conditions: ReturnType<typeof eq>[] = [];
  if (params.campaignId) conditions.push(eq(contentPiecesTable.campaignId, params.campaignId));
  if (params.channel) conditions.push(eq(contentPiecesTable.channel, params.channel as any));

  const pieces = conditions.length
    ? await db.select().from(contentPiecesTable).where(and(...conditions)).orderBy(sql`${contentPiecesTable.sortOrder} asc, ${contentPiecesTable.id} asc`)
    : await db.select().from(contentPiecesTable).orderBy(sql`${contentPiecesTable.createdAt} desc`);

  const commentCounts = await db
    .select({ contentPieceId: commentsTable.contentPieceId, count: sql<number>`count(*)`.mapWith(Number) })
    .from(commentsTable)
    .groupBy(commentsTable.contentPieceId);

  const countMap = new Map(commentCounts.map((c) => [c.contentPieceId, c.count]));
  res.json(pieces.map((p) => ({ ...p, commentCount: countMap.get(p.id) ?? 0 })));
});

router.post("/content-pieces/reorder", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { items } = req.body as { items: { id: number; sortOrder: number }[] };
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "items must be a non-empty array" });
  const [firstPiece] = await db
    .select({ campaignId: contentPiecesTable.campaignId })
    .from(contentPiecesTable)
    .where(eq(contentPiecesTable.id, items[0].id));
  if (firstPiece) {
    const role = await getUserRoleForCampaign(userId, firstPiece.campaignId);
    if (!can(role, "edit")) return res.status(403).json({ error: "You do not have permission to reorder content" });
  }
  for (const item of items) {
    await db
      .update(contentPiecesTable)
      .set({ sortOrder: item.sortOrder, updatedAt: new Date() })
      .where(eq(contentPiecesTable.id, item.id));
  }
  res.json({ ok: true });
});

router.post("/content-pieces", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const body = CreateContentPieceBody.parse(req.body);

  const role = await getUserRoleForCampaign(userId, body.campaignId);
  if (!can(role, "create")) return res.status(403).json({ error: "You do not have permission to create content" });

  const [maxRow] = await db
    .select({ maxOrder: max(contentPiecesTable.sortOrder) })
    .from(contentPiecesTable)
    .where(and(eq(contentPiecesTable.campaignId, body.campaignId), eq(contentPiecesTable.channel, body.channel as any)));

  const insertData: any = {
    campaignId: body.campaignId,
    channel: body.channel,
    title: body.title,
    bodyText: body.bodyText ?? null,
    mediaUrl: body.mediaUrl ?? null,
    mediaType: body.mediaType ?? null,
    status: "uploaded",
    sortOrder: (maxRow?.maxOrder ?? 0) + 1,
  };
  if (body.scheduledDate) insertData.scheduledDate = new Date(body.scheduledDate);

  const [piece] = await db.insert(contentPiecesTable).values(insertData).returning();

  await db.insert(activityTable).values({
    type: "piece_uploaded",
    description: `Content piece "${piece.title}" was uploaded`,
    entityId: piece.campaignId,
    entityTitle: piece.title,
  });

  res.status(201).json({ ...piece, commentCount: 0 });
});

router.get("/content-pieces/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { id } = GetContentPieceParams.parse(req.params);
  const [piece] = await db.select().from(contentPiecesTable).where(eq(contentPiecesTable.id, id));
  if (!piece) return res.status(404).json({ error: "Content piece not found" });
  const role = await getUserRoleForCampaign(userId, piece.campaignId);
  if (!can(role, "view")) return res.status(403).json({ error: "Access denied" });
  const commentCount = await getPieceWithCommentCount(id);
  res.json({ ...piece, commentCount });
});

router.patch("/content-pieces/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { id } = UpdateContentPieceParams.parse(req.params);
  const body = UpdateContentPieceBody.parse(req.body);

  const [piece] = await db
    .select({ campaignId: contentPiecesTable.campaignId })
    .from(contentPiecesTable)
    .where(eq(contentPiecesTable.id, id));
  if (!piece) return res.status(404).json({ error: "Content piece not found" });

  const role = await getUserRoleForCampaign(userId, piece.campaignId);
  if (!can(role, "edit")) return res.status(403).json({ error: "You do not have permission to edit content" });

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

router.delete("/content-pieces/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { id } = DeleteContentPieceParams.parse(req.params);

  const [piece] = await db
    .select({ campaignId: contentPiecesTable.campaignId })
    .from(contentPiecesTable)
    .where(eq(contentPiecesTable.id, id));
  if (!piece) return res.status(404).json({ error: "Content piece not found" });

  const role = await getUserRoleForCampaign(userId, piece.campaignId);
  if (role !== "owner") return res.status(403).json({ error: "Only the campaign owner can delete content pieces" });

  const [deleted] = await db
    .delete(contentPiecesTable)
    .where(eq(contentPiecesTable.id, id))
    .returning({ id: contentPiecesTable.id });
  if (!deleted) return res.status(404).json({ error: "Content piece not found" });
  res.status(204).send();
});

router.post("/content-pieces/:id/approve", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { id } = ApproveContentPieceParams.parse(req.params);

  const [piece] = await db
    .select({ campaignId: contentPiecesTable.campaignId })
    .from(contentPiecesTable)
    .where(eq(contentPiecesTable.id, id));
  if (!piece) return res.status(404).json({ error: "Content piece not found" });

  const role = await getUserRoleForCampaign(userId, piece.campaignId);
  if (role !== "owner") return res.status(403).json({ error: "Only the campaign owner can approve content pieces" });

  const [updated] = await db
    .update(contentPiecesTable)
    .set({ status: "approved", approvedAt: new Date(), updatedAt: new Date() })
    .where(eq(contentPiecesTable.id, id))
    .returning();

  if (!updated) return res.status(404).json({ error: "Content piece not found" });

  await db.insert(activityTable).values({
    type: "piece_approved",
    description: `Content piece "${updated.title}" was approved`,
    entityId: updated.campaignId,
    entityTitle: updated.title,
  });

  const commentCount = await getPieceWithCommentCount(id);
  res.json({ ...updated, commentCount });
});

router.post("/content-pieces/:id/disapprove", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { id } = DisapproveContentPieceParams.parse(req.params);

  const [piece] = await db.select().from(contentPiecesTable).where(eq(contentPiecesTable.id, id));
  if (!piece) return res.status(404).json({ error: "Content piece not found" });
  if (piece.status !== "approved") return res.status(400).json({ error: "Piece is not approved" });

  const role = await getUserRoleForCampaign(userId, piece.campaignId);
  if (role !== "owner") return res.status(403).json({ error: "Only the campaign owner can disapprove content pieces" });

  const [updated] = await db
    .update(contentPiecesTable)
    .set({ status: "needs_revision", approvedAt: null, updatedAt: new Date() })
    .where(eq(contentPiecesTable.id, id))
    .returning();

  const commentCount = await getPieceWithCommentCount(id);
  res.json({ ...updated, commentCount });
});

router.post("/content-pieces/:id/submit-review", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { id } = SubmitContentPieceForReviewParams.parse(req.params);
  const body = SubmitContentPieceForReviewBody.parse(req.body);

  const [piece] = await db.select().from(contentPiecesTable).where(eq(contentPiecesTable.id, id));
  if (!piece) return res.status(404).json({ error: "Content piece not found" });

  const role = await getUserRoleForCampaign(userId, piece.campaignId);
  if (!can(role, "edit")) return res.status(403).json({ error: "You do not have permission to submit content for review" });

  const [updated] = await db
    .update(contentPiecesTable)
    .set({ status: "in_review", updatedAt: new Date() })
    .where(eq(contentPiecesTable.id, id))
    .returning();

  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(eq(campaignsTable.id, piece.campaignId));

  await db.insert(activityTable).values({
    type: "piece_submitted_for_review",
    description: `"${piece.title}" was submitted for review`,
    entityId: piece.campaignId,
    entityTitle: piece.title,
  });

  const domain = process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost";
  const pieceUrl = `https://${domain}/campaigns/${piece.campaignId}/pieces/${piece.id}`;

  const owners = await db
    .select()
    .from(campaignMembersTable)
    .where(and(eq(campaignMembersTable.campaignId, piece.campaignId), eq(campaignMembersTable.role, "owner")));

  for (const owner of owners) {
    if (body.reviewerMemberId && owner.id === body.reviewerMemberId) continue;
    await sendReviewNotification({
      to: owner.email,
      reviewerName: owner.firstName ? `${owner.firstName} ${owner.lastName}`.trim() : owner.email,
      pieceTitle: piece.title,
      campaignTitle: campaign?.title ?? "Campaign",
      note: body.note,
      pieceUrl,
    }).catch(() => {});
  }

  if (body.reviewerMemberId) {
    const [reviewer] = await db
      .select()
      .from(campaignMembersTable)
      .where(eq(campaignMembersTable.id, body.reviewerMemberId));

    if (reviewer) {
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
