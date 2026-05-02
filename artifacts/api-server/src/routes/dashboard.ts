import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { campaignsTable, contentPiecesTable, activityTable, foldersTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/dashboard/summary", requireAuth, async (req, res) => {
  const userId = (req as any).userId;

  const [campaignStats] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(campaignsTable)
    .where(eq(campaignsTable.userId, userId));

  const campaignIds = await db
    .select({ id: campaignsTable.id })
    .from(campaignsTable)
    .where(eq(campaignsTable.userId, userId));

  const ids = campaignIds.map((c) => c.id);

  const [pieceStats] = ids.length
    ? await db
        .select({ total: sql<number>`count(*)`.mapWith(Number) })
        .from(contentPiecesTable)
        .where(sql`${contentPiecesTable.campaignId} = ANY(${sql.raw(`ARRAY[${ids.join(",")}]`)})`)
    : [{ total: 0 }];

  const statusCounts = ids.length
    ? await db
        .select({
          status: contentPiecesTable.status,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(contentPiecesTable)
        .where(sql`${contentPiecesTable.campaignId} = ANY(${sql.raw(`ARRAY[${ids.join(",")}]`)})`)
        .groupBy(contentPiecesTable.status)
    : [];

  const campaignStatusCounts = await db
    .select({
      status: campaignsTable.status,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(campaignsTable)
    .where(eq(campaignsTable.userId, userId))
    .groupBy(campaignsTable.status);

  const [folderStats] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(foldersTable)
    .where(eq(foldersTable.userId, userId));

  const statusMap = Object.fromEntries(statusCounts.map((s) => [s.status, s.count]));
  const campaignStatusMap = Object.fromEntries(campaignStatusCounts.map((s) => [s.status, s.count]));

  res.json({
    totalCampaigns: campaignStats?.total ?? 0,
    totalContentPieces: pieceStats?.total ?? 0,
    approvedPieces: statusMap["approved"] ?? 0,
    pendingReview: statusMap["in_review"] ?? 0,
    needsRevision: statusMap["needs_revision"] ?? 0,
    totalFolders: folderStats?.total ?? 0,
    campaignsByStatus: campaignStatusMap,
  });
});

router.get("/dashboard/activity", requireAuth, async (req, res) => {
  const userId = (req as any).userId;

  const campaignIds = await db
    .select({ id: campaignsTable.id })
    .from(campaignsTable)
    .where(eq(campaignsTable.userId, userId));

  const ids = campaignIds.map((c) => c.id);

  const activity = ids.length
    ? await db
        .select()
        .from(activityTable)
        .where(sql`${activityTable.entityId} = ANY(${sql.raw(`ARRAY[${ids.join(",")}]`)})`)
        .orderBy(sql`${activityTable.createdAt} desc`)
        .limit(20)
    : await db
        .select()
        .from(activityTable)
        .orderBy(sql`${activityTable.createdAt} desc`)
        .limit(20);

  res.json(activity);
});

export default router;
