import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  foldersTable, campaignsTable, activityTable, contentPiecesTable,
  campaignMembersTable,
} from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import {
  CreateFolderBody,
  UpdateFolderBody,
  UpdateFolderParams,
  DeleteFolderParams,
  ShareFolderLinkParams,
  GetSharedFolderParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { sendInviteEmail } from "../email";

const router: IRouter = Router();

const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  owner: ["view", "comment", "edit", "create", "approve", "invite"],
  marketer: ["view", "comment", "edit", "create"],
  team_member: ["view", "comment"],
};

async function getFolderWithCount(folder: typeof foldersTable.$inferSelect) {
  const [row] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(campaignsTable)
    .where(eq(campaignsTable.folderId, folder.id));
  return { ...folder, campaignCount: row?.count ?? 0 };
}

router.get("/folders", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const folders = await db
    .select()
    .from(foldersTable)
    .where(eq(foldersTable.userId, userId))
    .orderBy(sql`${foldersTable.createdAt} desc`);

  const withCounts = await Promise.all(folders.map(getFolderWithCount));
  res.json(withCounts);
});

router.post("/folders", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const body = CreateFolderBody.parse(req.body);

  const [folder] = await db
    .insert(foldersTable)
    .values({ ...body, userId })
    .returning();

  res.status(201).json({ ...folder, campaignCount: 0 });
});

router.patch("/folders/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { id } = UpdateFolderParams.parse(req.params);
  const body = UpdateFolderBody.parse(req.body);

  const [updated] = await db
    .update(foldersTable)
    .set({ ...body, updatedAt: new Date() })
    .where(and(eq(foldersTable.id, id), eq(foldersTable.userId, userId)))
    .returning();

  if (!updated) return res.status(404).json({ error: "Folder not found" });
  res.json(await getFolderWithCount(updated));
});

router.delete("/folders/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { id } = DeleteFolderParams.parse(req.params);

  await db
    .delete(foldersTable)
    .where(and(eq(foldersTable.id, id), eq(foldersTable.userId, userId)));

  res.status(204).send();
});

router.post("/folders/:id/share", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { id } = ShareFolderLinkParams.parse(req.params);

  const token = randomBytes(16).toString("hex");

  const [updated] = await db
    .update(foldersTable)
    .set({ shareToken: token, updatedAt: new Date() })
    .where(and(eq(foldersTable.id, id), eq(foldersTable.userId, userId)))
    .returning();

  if (!updated) return res.status(404).json({ error: "Folder not found" });
  res.json(await getFolderWithCount(updated));
});

router.post("/folders/:id/invite", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const folderId = parseInt(req.params.id, 10);
  if (isNaN(folderId)) return res.status(400).json({ error: "Invalid folder id" });

  const [folder] = await db
    .select()
    .from(foldersTable)
    .where(and(eq(foldersTable.id, folderId), eq(foldersTable.userId, userId)));

  if (!folder) return res.status(404).json({ error: "Folder not found" });

  const { email, firstName = "", lastName = "", role = "team_member" } = req.body as {
    email?: string; firstName?: string; lastName?: string; role?: string;
  };

  if (!email) return res.status(400).json({ error: "email is required" });

  const permissions = DEFAULT_PERMISSIONS[role] ?? ["view"];

  const folderCampaigns = await db
    .select()
    .from(campaignsTable)
    .where(eq(campaignsTable.folderId, folderId));

  let invitedCount = 0;
  for (const campaign of folderCampaigns) {
    const [existing] = await db
      .select({ id: campaignMembersTable.id })
      .from(campaignMembersTable)
      .where(
        and(
          eq(campaignMembersTable.campaignId, campaign.id),
          eq(campaignMembersTable.email, email),
        )
      );

    if (!existing) {
      await db.insert(campaignMembersTable).values({
        campaignId: campaign.id,
        email,
        firstName,
        lastName,
        role,
        permissions,
      });
      invitedCount++;
    }
  }

  const domain = process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost";
  const appUrl = `https://${domain}/sign-in`;

  sendInviteEmail({
    to: email,
    inviteeName: firstName || undefined,
    folderName: folder.title,
    appUrl,
    role,
  }).catch(() => {});

  res.status(201).json({
    invited: invitedCount,
    total: folderCampaigns.length,
    alreadyMember: folderCampaigns.length - invitedCount,
  });
});

router.get("/folders/:id/info", requireAuth, async (req, res) => {
  const folderId = parseInt(req.params.id, 10);
  if (isNaN(folderId)) return res.status(400).json({ error: "Invalid folder id" });

  const [folder] = await db
    .select({ id: foldersTable.id, title: foldersTable.title })
    .from(foldersTable)
    .where(eq(foldersTable.id, folderId));

  if (!folder) return res.status(404).json({ error: "Folder not found" });
  res.json(folder);
});

router.get("/shared/folder/:token", async (req, res) => {
  const { token } = GetSharedFolderParams.parse(req.params);

  const [folder] = await db
    .select()
    .from(foldersTable)
    .where(eq(foldersTable.shareToken, token));

  if (!folder) return res.status(404).json({ error: "Shared folder not found" });

  const campaigns = await db
    .select()
    .from(campaignsTable)
    .where(eq(campaignsTable.folderId, folder.id))
    .orderBy(sql`${campaignsTable.createdAt} desc`);

  const counts = await db
    .select({ campaignId: contentPiecesTable.campaignId, count: sql<number>`count(*)`.mapWith(Number) })
    .from(contentPiecesTable)
    .groupBy(contentPiecesTable.campaignId);

  const countMap = new Map(counts.map((c) => [c.campaignId, c.count]));

  const folderWithCount = await getFolderWithCount(folder);
  const campaignsWithCount = campaigns.map((c) => ({ ...c, contentPieceCount: countMap.get(c.id) ?? 0 }));

  res.json({ folder: folderWithCount, campaigns: campaignsWithCount });
});

export default router;
