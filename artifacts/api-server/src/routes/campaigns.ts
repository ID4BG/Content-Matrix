import { Router } from "express";
import { db } from "@workspace/db";
import {
  campaignsTable,
  contentPiecesTable,
  activityTable,
  campaignMembersTable,
} from "@workspace/db";
import { eq, sql, and, or, inArray } from "drizzle-orm";
import { randomBytes } from "crypto";
import { clerkClient } from "@clerk/express";
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

const router = Router();

function withCount(
  campaign: typeof campaignsTable.$inferSelect,
  count: number,
  isOwner = true,
  currentUserRole?: string,
) {
  return {
    ...campaign,
    contentPieceCount: count,
    isOwner,
    currentUserRole: currentUserRole ?? (isOwner ? "owner" : "team_member"),
  };
}

async function getPieceCount(campaignId: number): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(contentPiecesTable)
    .where(eq(contentPiecesTable.campaignId, campaignId));

  return row?.count ?? 0;
}

async function getMemberCampaignIds(userId: string): Promise<number[]> {
  try {
    const clerkUser = await clerkClient.users.getUser(userId);
    const email = clerkUser.emailAddresses?.[0]?.emailAddress;

    if (!email) return [];

    const rows = await db
      .select({ campaignId: campaignMembersTable.campaignId })
      .from(campaignMembersTable)
      .where(
        and(
          eq(campaignMembersTable.email, email),
          eq(campaignMembersTable.accepted, true),
        ),
      );

    return rows.map((r) => r.campaignId);
  } catch {
    return [];
  }
}

async function getMemberRole(
  userId: string,
  campaignId: number,
): Promise<string | null> {
  try {
    const clerkUser = await clerkClient.users.getUser(userId);
    const email = clerkUser.emailAddresses?.[0]?.emailAddress;

    if (!email) return null;

    const [row] = await db
      .select({ role: campaignMembersTable.role })
      .from(campaignMembersTable)
      .where(
        and(
          eq(campaignMembersTable.campaignId, campaignId),
          eq(campaignMembersTable.email, email),
          eq(campaignMembersTable.accepted, true),
        ),
      );

    return row?.role ?? null;
  } catch {
    return null;
  }
}

router.get("/campaigns", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { folderId } = ListCampaignsQueryParams.parse(req.query);

  const memberCampaignIds = await getMemberCampaignIds(userId);

  const ownerCondition = eq(campaignsTable.userId, userId);
  const accessCondition =
    memberCampaignIds.length > 0
      ? or(ownerCondition, inArray(campaignsTable.id, memberCampaignIds))
      : ownerCondition;

  const whereClause =
    folderId != null
      ? and(accessCondition, eq(campaignsTable.folderId, folderId))
      : accessCondition;

  const campaigns = await db
    .select()
    .from(campaignsTable)
    .where(whereClause)
    .orderBy(sql`${campaignsTable.createdAt} desc`);

  const counts = await db
    .select({
      campaignId: contentPiecesTable.campaignId,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(contentPiecesTable)
    .groupBy(contentPiecesTable.campaignId);

  const countMap = new Map(counts.map((c) => [c.campaignId, c.count]));

  const nonOwnedIds = campaigns
    .filter((c) => c.userId !== userId)
    .map((c) => c.id);
  const memberRoleMap = new Map<number, string>();

  if (nonOwnedIds.length > 0) {
    try {
      const clerkUser = await clerkClient.users.getUser(userId);
      const email = clerkUser.emailAddresses?.[0]?.emailAddress;

      if (email) {
        const roleRows = await db
          .select({
            campaignId: campaignMembersTable.campaignId,
            role: campaignMembersTable.role,
          })
          .from(campaignMembersTable)
          .where(
            and(
              inArray(campaignMembersTable.campaignId, nonOwnedIds),
              eq(campaignMembersTable.email, email),
              eq(campaignMembersTable.accepted, true),
            ),
          );

        for (const r of roleRows) {
          memberRoleMap.set(r.campaignId, r.role);
        }
      }
    } catch {
      // non-fatal
    }
  }

  res.json(
    campaigns.map((c) => {
      const isCreator = c.userId === userId;
      const memberRole = memberRoleMap.get(c.id);
      const effectiveOwner = isCreator || memberRole === "owner";

      return withCount(
        c,
        countMap.get(c.id) ?? 0,
        effectiveOwner,
        effectiveOwner ? "owner" : memberRole,
      );
    }),
  );
  return;
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
  return;
});

router.get("/campaigns/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { id } = GetCampaignParams.parse(req.params);

  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(eq(campaignsTable.id, id));

  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  const isCreator = campaign.userId === userId;

  if (!isCreator) {
    const memberIds = await getMemberCampaignIds(userId);

    if (!memberIds.includes(id)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
  }

  const memberRole = isCreator ? null : await getMemberRole(userId, id);
  const effectiveOwner = isCreator || memberRole === "owner";
  const currentUserRole = effectiveOwner
    ? "owner"
    : (memberRole ?? "team_member");

  res.json(
    withCount(
      campaign,
      await getPieceCount(id),
      effectiveOwner,
      currentUserRole,
    ),
  );
  return;
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

  if (!updated) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  res.json(withCount(updated, await getPieceCount(id)));
  return;
});

router.delete("/campaigns/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { id } = DeleteCampaignParams.parse(req.params);

  try {
    const [campaign] = await db
      .select()
      .from(campaignsTable)
      .where(eq(campaignsTable.id, id));

    if (!campaign) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }

    const isCreator = campaign.userId === userId;

    if (!isCreator) {
      const role = await getMemberRole(userId, id);

      if (role !== "owner") {
        res
          .status(403)
          .json({ error: "You do not have permission to delete this campaign" });
        return;
      }
    }

    await db.delete(campaignsTable).where(eq(campaignsTable.id, id));

    res.status(204).send();
  } catch (err) {
    console.error("DELETE_CAMPAIGN_ERROR", err);
    console.error("FULL_ERROR_JSON", JSON.stringify(err, Object.getOwnPropertyNames(err as object), 2));
    res.status(500).json({ error: "Failed to delete campaign" });
  }
  return;
});

router.post("/campaigns/:id/approve", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { id } = ApproveCampaignParams.parse(req.params);

  const [existing] = await db
    .select()
    .from(campaignsTable)
    .where(eq(campaignsTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  const isCreator = existing.userId === userId;

  if (!isCreator) {
    const role = await getMemberRole(userId, id);

    if (role !== "owner") {
      res.status(403).json({ error: "Only owners can approve campaigns" });
      return;
    }
  }

  const [updated] = await db
    .update(campaignsTable)
    .set({
      status: "approved",
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(campaignsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  await db.insert(activityTable).values({
    type: "campaign_approved",
    description: `Campaign "${updated.title}" was approved`,
    entityId: updated.id,
    entityTitle: updated.title,
  });

  res.json(withCount(updated, await getPieceCount(id)));
  return;
});

router.post("/campaigns/:id/disapprove", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { id } = ApproveCampaignParams.parse(req.params);

  const [existing] = await db
    .select()
    .from(campaignsTable)
    .where(eq(campaignsTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  const isCreator = existing.userId === userId;

  if (!isCreator) {
    const role = await getMemberRole(userId, id);

    if (role !== "owner") {
      res.status(403).json({ error: "Only owners can disapprove campaigns" });
      return;
    }
  }

  const [updated] = await db
    .update(campaignsTable)
    .set({
      status: "draft",
      approvedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(campaignsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  res.json(withCount(updated, await getPieceCount(id)));
  return;
});

router.post("/campaigns/:id/share", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { id } = ShareCampaignLinkParams.parse(req.params);

  const [existing] = await db
    .select()
    .from(campaignsTable)
    .where(eq(campaignsTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  const isCreator = existing.userId === userId;

  if (!isCreator) {
    const role = await getMemberRole(userId, id);

    if (role !== "owner") {
      res.status(403).json({ error: "Only owners can share campaigns" });
      return;
    }
  }

  const token = randomBytes(16).toString("hex");

  const [updated] = await db
    .update(campaignsTable)
    .set({
      shareToken: token,
      updatedAt: new Date(),
    })
    .where(eq(campaignsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  res.json(withCount(updated, await getPieceCount(id)));
  return;
});

router.get("/shared/campaign/:token", async (req, res) => {
  const { token } = GetSharedCampaignParams.parse(req.params);

  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(eq(campaignsTable.shareToken, token));

  if (!campaign) {
    res.status(404).json({ error: "Shared campaign not found" });
    return;
  }

  const pieces = await db
    .select()
    .from(contentPiecesTable)
    .where(
      and(
        eq(contentPiecesTable.campaignId, campaign.id),
        eq(contentPiecesTable.status, "approved"),
      ),
    )
    .orderBy(contentPiecesTable.channel);

  const count = await getPieceCount(campaign.id);

  res.json({
    campaign: withCount(campaign, count, false),
    pieces,
  });
  return;
});

router.patch("/campaigns/:id/channels", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { id } = UpdateCampaignChannelsParams.parse(req.params);
  const body = UpdateCampaignChannelsBody.parse(req.body);

  const [existing] = await db
    .select()
    .from(campaignsTable)
    .where(eq(campaignsTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  const isCreator = existing.userId === userId;

  if (!isCreator) {
    const role = await getMemberRole(userId, id);

    if (role !== "owner") {
      res.status(403).json({ error: "Only owners can update channels" });
      return;
    }
  }

  const [updated] = await db
    .update(campaignsTable)
    .set({
      channels: body.channels,
      updatedAt: new Date(),
    })
    .where(eq(campaignsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  res.json(withCount(updated, await getPieceCount(id)));
  return;
});

export default router;
