import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  campaignsTable, contentPiecesTable, activityTable, foldersTable, campaignMembersTable,
} from "@workspace/db";
import { eq, sql, and, inArray, or } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

// Shared Clerk email cache (5 min TTL)
const clerkEmailCache = new Map<string, { email: string; expiresAt: number }>();
async function getUserEmail(userId: string): Promise<string | null> {
  const cached = clerkEmailCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.email;
  try {
    const user = await clerkClient.users.getUser(userId);
    const email = user.emailAddresses?.[0]?.emailAddress ?? null;
    if (email) clerkEmailCache.set(userId, { email, expiresAt: Date.now() + 5 * 60 * 1000 });
    return email;
  } catch {
    return null;
  }
}

async function getAllAccessibleCampaignIds(userId: string): Promise<number[]> {
  const ownedRows = await db
    .select({ id: campaignsTable.id })
    .from(campaignsTable)
    .where(eq(campaignsTable.userId, userId));

  let memberIds: number[] = [];
  try {
    const email = await getUserEmail(userId);
    if (email) {
      const memberRows = await db
        .select({ campaignId: campaignMembersTable.campaignId })
        .from(campaignMembersTable)
        .where(and(
          eq(campaignMembersTable.email, email),
          eq(campaignMembersTable.accepted, true),
        ));
      memberIds = memberRows.map(r => r.campaignId);
    }
  } catch { /* non-fatal */ }

  return [...new Set([...ownedRows.map(c => c.id), ...memberIds])];
}

router.get("/dashboard/summary", requireAuth, async (req, res) => {
  const userId = (req as any).userId;

  let allIds: number[];
  try {
    allIds = await getAllAccessibleCampaignIds(userId);
  } catch (err) {
    console.error("DASHBOARD_SUMMARY_ERROR", err);
    console.error("FULL_ERROR_JSON", JSON.stringify(err, Object.getOwnPropertyNames(err as object), 2));
    res.status(500).json({ error: "Failed to load dashboard summary" });
    return;
  }
  const totalCampaigns = allIds.length;

  const [pieceStats] = allIds.length
    ? await db
        .select({ total: sql<number>`count(*)`.mapWith(Number) })
        .from(contentPiecesTable)
        .where(inArray(contentPiecesTable.campaignId, allIds))
    : [{ total: 0 }];

  const statusCounts = allIds.length
    ? await db
        .select({
          status: contentPiecesTable.status,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(contentPiecesTable)
        .where(inArray(contentPiecesTable.campaignId, allIds))
        .groupBy(contentPiecesTable.status)
    : [];

  const campaignStatusCounts = allIds.length
    ? await db
        .select({
          status: campaignsTable.status,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(campaignsTable)
        .where(inArray(campaignsTable.id, allIds))
        .groupBy(campaignsTable.status)
    : [];

  const [folderStats] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(foldersTable)
    .where(eq(foldersTable.userId, userId));

  const statusMap = Object.fromEntries(statusCounts.map(s => [s.status, s.count]));
  const campaignStatusMap = Object.fromEntries(campaignStatusCounts.map(s => [s.status, s.count]));

  res.json({
    totalCampaigns,
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

  try {
    const allIds = await getAllAccessibleCampaignIds(userId);

    if (!allIds.length) return void res.json([]);

    const activity = await db
      .select()
      .from(activityTable)
      .where(inArray(activityTable.entityId, allIds))
      .orderBy(sql`${activityTable.createdAt} desc`)
      .limit(20);

    res.json(activity);
  } catch (err) {
    console.error("DASHBOARD_ACTIVITY_ERROR", err);
    console.error("FULL_ERROR_JSON", JSON.stringify(err, Object.getOwnPropertyNames(err as object), 2));
    res.status(500).json({ error: "Failed to load activity" });
  }
});

export default router;
