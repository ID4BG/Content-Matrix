import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { campaignsTable, contentPiecesTable, activityTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res) => {
  const [campaignStats] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(campaignsTable);

  const [pieceStats] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(contentPiecesTable);

  const statusCounts = await db
    .select({
      status: contentPiecesTable.status,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(contentPiecesTable)
    .groupBy(contentPiecesTable.status);

  const campaignStatusCounts = await db
    .select({
      status: campaignsTable.status,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(campaignsTable)
    .groupBy(campaignsTable.status);

  const statusMap = Object.fromEntries(statusCounts.map((s) => [s.status, s.count]));
  const campaignStatusMap = Object.fromEntries(campaignStatusCounts.map((s) => [s.status, s.count]));

  res.json({
    totalCampaigns: campaignStats?.total ?? 0,
    totalContentPieces: pieceStats?.total ?? 0,
    approvedPieces: statusMap["approved"] ?? 0,
    pendingReview: statusMap["in_review"] ?? 0,
    needsRevision: statusMap["needs_revision"] ?? 0,
    campaignsByStatus: campaignStatusMap,
  });
});

router.get("/dashboard/activity", async (_req, res) => {
  const activity = await db
    .select()
    .from(activityTable)
    .orderBy(sql`${activityTable.createdAt} desc`)
    .limit(20);
  res.json(activity);
});

export default router;
