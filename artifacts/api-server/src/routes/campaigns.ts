import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  campaignsTable,
  contentPiecesTable,
  activityTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  CreateCampaignBody,
  UpdateCampaignBody,
  GetCampaignParams,
  UpdateCampaignParams,
  DeleteCampaignParams,
  ApproveCampaignParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/campaigns", async (req, res) => {
  const campaigns = await db.select().from(campaignsTable).orderBy(sql`${campaignsTable.createdAt} desc`);

  const counts = await db
    .select({ campaignId: contentPiecesTable.campaignId, count: sql<number>`count(*)`.mapWith(Number) })
    .from(contentPiecesTable)
    .groupBy(contentPiecesTable.campaignId);

  const countMap = new Map(counts.map((c) => [c.campaignId, c.count]));

  res.json(campaigns.map((c) => ({ ...c, contentPieceCount: countMap.get(c.id) ?? 0 })));
});

router.post("/campaigns", async (req, res) => {
  const body = CreateCampaignBody.parse(req.body);
  const [campaign] = await db.insert(campaignsTable).values({ ...body }).returning();

  await db.insert(activityTable).values({
    type: "campaign_created",
    description: `Campaign "${campaign.title}" was created`,
    entityId: campaign.id,
    entityTitle: campaign.title,
  });

  res.status(201).json({ ...campaign, contentPieceCount: 0 });
});

router.get("/campaigns/:id", async (req, res) => {
  const { id } = GetCampaignParams.parse(req.params);
  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });

  const [countRow] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(contentPiecesTable)
    .where(eq(contentPiecesTable.campaignId, id));

  res.json({ ...campaign, contentPieceCount: countRow?.count ?? 0 });
});

router.patch("/campaigns/:id", async (req, res) => {
  const { id } = UpdateCampaignParams.parse(req.params);
  const body = UpdateCampaignBody.parse(req.body);

  const [updated] = await db
    .update(campaignsTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(campaignsTable.id, id))
    .returning();

  if (!updated) return res.status(404).json({ error: "Campaign not found" });

  const [countRow] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(contentPiecesTable)
    .where(eq(contentPiecesTable.campaignId, id));

  res.json({ ...updated, contentPieceCount: countRow?.count ?? 0 });
});

router.delete("/campaigns/:id", async (req, res) => {
  const { id } = DeleteCampaignParams.parse(req.params);
  await db.delete(campaignsTable).where(eq(campaignsTable.id, id));
  res.status(204).send();
});

router.post("/campaigns/:id/approve", async (req, res) => {
  const { id } = ApproveCampaignParams.parse(req.params);
  const [updated] = await db
    .update(campaignsTable)
    .set({ status: "approved", approvedAt: new Date(), updatedAt: new Date() })
    .where(eq(campaignsTable.id, id))
    .returning();

  if (!updated) return res.status(404).json({ error: "Campaign not found" });

  await db.insert(activityTable).values({
    type: "campaign_approved",
    description: `Campaign "${updated.title}" was approved`,
    entityId: updated.id,
    entityTitle: updated.title,
  });

  const [countRow] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(contentPiecesTable)
    .where(eq(contentPiecesTable.campaignId, id));

  res.json({ ...updated, contentPieceCount: countRow?.count ?? 0 });
});

export default router;
