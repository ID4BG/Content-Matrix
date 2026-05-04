import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { campaignsTable, contentPiecesTable, activityTable, foldersTable, campaignMembersTable } from "@workspace/db";
import { eq, sql, and, inArray } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
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

  // Campaigns owned by this user
  const ownedRows = await db
    .select({ id: campaignsTable.id })
    .from(campaignsTable)
    .where(eq(campaignsTable.userId, userId));

  // Campaigns where this user is an invited member (looked up by email)
  let memberIds: number[] = [];
  try {
    const clerkUser = await clerkClient.users.getUser(userId);
    const email = clerkUser.emailAddresses?.[0]?.emailAddress;
    if (email) {
      const memberRows = await db
        .select({ campaignId: campaignMembersTable.campaignId })
        .from(campaignMembersTable)
        .innerJoin(campaignsTable, eq(campaignMembersTable.campaignId, campaignsTable.id))
        .where(
          and(
            eq(campaignMembersTable.email, email),
            eq(campaignMembersTable.accepted, true)
          )
        );
      memberIds = memberRows.map((r) => r.campaignId);
    }
  } catch {
    // Non-fatal — proceed with owned campaigns only
  }

  const allIds = [...new Set([...ownedRows.map((c) => c.id), ...memberIds])];

  if (!allIds.length) {
    return res.json([]);
  }

  const activity = await db
    .select()
    .from(activityTable)
    .where(inArray(activityTable.entityId, allIds))
    .orderBy(sql`${activityTable.createdAt} desc`)
    .limit(20);

  res.json(activity);
});

export default router;
