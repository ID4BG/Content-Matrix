import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  campaignsTable,
  contentPiecesTable,
  activityTable,
} from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import {
  CreateCampaignBody,
  UpdateCampaignBody,
  GetCampaignParams,
  UpdateCampaignParams,
  DeleteCampaignParams,
  ApproveCampaignParams,
  UpdateCampaignChannelsBody,
  UpdateCampaignChannelsParams,
  ListCampaignsQueryParams,
  ShareCampaignLinkParams,
  GetSharedCampaignParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

function withCount(campaign: typeof campaignsTable.$inferSelect, count: number) {
  return { ...campaign, contentPieceCount: count };
}

async function getPieceCount(campaignId: number): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(contentPiecesTable)
    .where(eq(contentPiecesTable.campaignId, campaignId));
  return row?.count ?? 0;
}

router.get("/campaigns", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { folderId } = ListCampaignsQueryParams.parse(req.query);

  const conditions = [eq(campaignsTable.userId, userId)];
  if (folderId != null) {
    conditions.push(eq(campaignsTable.folderId, folderId));
  }

  const campaigns = await db
    .select()
    .from(campaignsTable)
    .where(and(...conditions))
    .orderBy(sql`${campaignsTable.createdAt} desc`);

  const counts = await db
    .select({ campaignId: contentPiecesTable.campaignId, count: sql<number>`count(*)`.mapWith(Number) })
    .from(contentPiecesTable)
    .groupBy(contentPiecesTable.campaignId);

  const countMap = new Map(counts.map((c) => [c.campaignId, c.count]));
  res.json(campaigns.map((c) => withCount(c, countMap.get(c.id) ?? 0)));
});

router.post("/campaigns", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const body = CreateCampaignBody.parse(req.body);

  const [campaign] = await db
    .insert(campaignsTable)
    .values({ ...body, userId })
    .returning();

  await db.insert(activityTable).values({
    type: "campaign_created",
    description: `Campaign "${campaign.title}" was created`,
    entityId: campaign.id,
    entityTitle: campaign.title,
  });

  res.status(201).json(withCount(campaign, 0));
});

router.get("/campaigns/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { id } = GetCampaignParams.parse(req.params);

  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, id), eq(campaignsTable.userId, userId)));

  if (!campaign) return res.status(404).json({ error: "Campaign not found" });
  res.json(withCount(campaign, await getPieceCount(id)));
});

router.patch("/campaigns/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { id } = UpdateCampaignParams.parse(req.params);
  const body = UpdateCampaignBody.parse(req.body);

  const [updated] = await db
    .update(campaignsTable)
    .set({ ...body, updatedAt: new Date() })
    .where(and(eq(campaignsTable.id, id), eq(campaignsTable.userId, userId)))
    .returning();

  if (!updated) return res.status(404).json({ error: "Campaign not found" });
  res.json(withCount(updated, await getPieceCount(id)));
});

router.delete("/campaigns/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { id } = DeleteCampaignParams.parse(req.params);
  await db
    .delete(campaignsTable)
    .where(and(eq(campaignsTable.id, id), eq(campaignsTable.userId, userId)));
  res.status(204).send();
});

router.post("/campaigns/:id/approve", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { id } = ApproveCampaignParams.parse(req.params);

  const [updated] = await db
    .update(campaignsTable)
    .set({ status: "approved", approvedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(campaignsTable.id, id), eq(campaignsTable.userId, userId)))
    .returning();

  if (!updated) return res.status(404).json({ error: "Campaign not found" });

  await db.insert(activityTable).values({
    type: "campaign_approved",
    description: `Campaign "${updated.title}" was approved`,
    entityId: updated.id,
    entityTitle: updated.title,
  });

  res.json(withCount(updated, await getPieceCount(id)));
});

router.post("/campaigns/:id/disapprove", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { id } = ApproveCampaignParams.parse(req.params);

  const [updated] = await db
    .update(campaignsTable)
    .set({ status: "draft", approvedAt: null, updatedAt: new Date() })
    .where(and(eq(campaignsTable.id, id), eq(campaignsTable.userId, userId)))
    .returning();

  if (!updated) return res.status(404).json({ error: "Campaign not found" });
  res.json(withCount(updated, await getPieceCount(id)));
});

router.post("/campaigns/:id/share", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { id } = ShareCampaignLinkParams.parse(req.params);

  const token = randomBytes(16).toString("hex");

  const [updated] = await db
    .update(campaignsTable)
    .set({ shareToken: token, updatedAt: new Date() })
    .where(and(eq(campaignsTable.id, id), eq(campaignsTable.userId, userId)))
    .returning();

  if (!updated) return res.status(404).json({ error: "Campaign not found" });
  res.json(withCount(updated, await getPieceCount(id)));
});

router.get("/shared/campaign/:token", async (req, res) => {
  const { token } = GetSharedCampaignParams.parse(req.params);

  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(eq(campaignsTable.shareToken, token));

  if (!campaign) return res.status(404).json({ error: "Shared campaign not found" });

  const pieces = await db
    .select()
    .from(contentPiecesTable)
    .where(and(eq(contentPiecesTable.campaignId, campaign.id), eq(contentPiecesTable.status, "approved")))
    .orderBy(contentPiecesTable.channel);

  const count = await getPieceCount(campaign.id);
  res.json({ campaign: withCount(campaign, count), pieces });
});

router.patch("/campaigns/:id/channels", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { id } = UpdateCampaignChannelsParams.parse(req.params);
  const body = UpdateCampaignChannelsBody.parse(req.body);

  const [updated] = await db
    .update(campaignsTable)
    .set({ channels: body.channels, updatedAt: new Date() })
    .where(and(eq(campaignsTable.id, id), eq(campaignsTable.userId, userId)))
    .returning();

  if (!updated) return res.status(404).json({ error: "Campaign not found" });
  res.json(withCount(updated, await getPieceCount(id)));
});

export default router;
