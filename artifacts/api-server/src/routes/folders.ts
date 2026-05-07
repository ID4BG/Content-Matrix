import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  foldersTable, campaignsTable, activityTable, contentPiecesTable,
  campaignMembersTable,
} from "@workspace/db";
import { eq, sql, and, inArray } from "drizzle-orm";
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
import { clerkClient } from "@clerk/express";

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

const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  owner: ["view", "comment", "edit", "create", "approve", "invite"],
  marketer: ["view", "comment", "edit", "create"],
  team_member: ["view", "comment"],
};

async function getUserRoleInFolder(userId: string, folderCampaignIds: number[]): Promise<string | null> {
  if (folderCampaignIds.length === 0) return null;
  try {
    const email = await getUserEmail(userId);
    if (!email) return null;
    const [row] = await db
      .select({ role: campaignMembersTable.role })
      .from(campaignMembersTable)
      .where(and(
        inArray(campaignMembersTable.campaignId, folderCampaignIds),
        eq(campaignMembersTable.email, email),
        eq(campaignMembersTable.accepted, true),
      ))
      .limit(1);
    return row?.role ?? null;
  } catch {
    return null;
  }
}

async function getFolderWithCount(folder: typeof foldersTable.$inferSelect) {
  const [row] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(campaignsTable)
    .where(eq(campaignsTable.folderId, folder.id));
  return { ...folder, campaignCount: row?.count ?? 0 };
}

router.get("/folders", requireAuth, async (req, res) => {
  const userId = (req as any).userId;

  let ownedFolders: typeof foldersTable.$inferSelect[];
  try {
    ownedFolders = await db
      .select()
      .from(foldersTable)
      .where(eq(foldersTable.userId, userId))
      .orderBy(sql`${foldersTable.createdAt} desc`);
  } catch (err) {
    console.error("GET_FOLDERS_ERROR", err);
    console.error("FULL_ERROR_JSON", JSON.stringify(err, Object.getOwnPropertyNames(err as object), 2));
    throw err;
  }

  const ownedIds = new Set(ownedFolders.map(f => f.id));

  // Also fetch folders the user was invited to (via accepted campaign membership)
  let memberFolders: typeof foldersTable.$inferSelect[] = [];
  try {
    const email = await getUserEmail(userId);
    if (email) {
      const memberRows = await db
        .select({ campaignId: campaignMembersTable.campaignId })
        .from(campaignMembersTable)
        .where(
          and(
            eq(campaignMembersTable.email, email),
            eq(campaignMembersTable.accepted, true),
          )
        );

      if (memberRows.length > 0) {
        const campaignIds = memberRows.map(r => r.campaignId);
        const campaignRows = await db
          .select({ folderId: campaignsTable.folderId })
          .from(campaignsTable)
          .where(inArray(campaignsTable.id, campaignIds));

        const folderIds = [
          ...new Set(
            campaignRows
              .map(c => c.folderId)
              .filter((fid): fid is number => fid !== null && !ownedIds.has(fid))
          ),
        ];

        if (folderIds.length > 0) {
          memberFolders = await db
            .select()
            .from(foldersTable)
            .where(inArray(foldersTable.id, folderIds))
            .orderBy(sql`${foldersTable.createdAt} desc`);
        }
      }
    }
  } catch {
    // non-fatal: just return owned folders if Clerk lookup fails
  }

  const ownedWithCounts = await Promise.all(
    ownedFolders.map(async f => ({ ...await getFolderWithCount(f), isOwner: true }))
  );
  const memberWithCounts = await Promise.all(
    memberFolders.map(async f => {
      const folderCampaignIds = await db
        .select({ id: campaignsTable.id })
        .from(campaignsTable)
        .where(eq(campaignsTable.folderId, f.id))
        .then(rows => rows.map(r => r.id));
      const role = await getUserRoleInFolder(userId, folderCampaignIds);
      return { ...await getFolderWithCount(f), isOwner: role === "owner" };
    })
  );

  res.json([...ownedWithCounts, ...memberWithCounts]);
});

router.post("/folders", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const body = CreateFolderBody.parse(req.body);

  let folder: typeof foldersTable.$inferSelect;
  try {
    const [inserted] = await db
      .insert(foldersTable)
      .values({ ...body, userId })
      .returning();
    folder = inserted;
  } catch (err) {
    console.error("CREATE_FOLDER_ERROR", err);
    console.error("FULL_ERROR_JSON", JSON.stringify(err, Object.getOwnPropertyNames(err as object), 2));
    throw err;
  }

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

  if (!updated) return void res.status(404).json({ error: "Folder not found" });
  res.json(await getFolderWithCount(updated));
});

router.delete("/folders/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const { id } = DeleteFolderParams.parse(req.params);

  const [folder] = await db.select().from(foldersTable).where(eq(foldersTable.id, id));
  if (!folder) return void res.status(404).json({ error: "Folder not found" });

  const isCreator = folder.userId === userId;
  if (!isCreator) {
    const folderCampaignIds = await db
      .select({ id: campaignsTable.id })
      .from(campaignsTable)
      .where(eq(campaignsTable.folderId, id))
      .then(rows => rows.map(r => r.id));
    const role = await getUserRoleInFolder(userId, folderCampaignIds);
    if (role !== "owner") return void res.status(403).json({ error: "You do not have permission to delete this folder" });
  }

  await db.delete(foldersTable).where(eq(foldersTable.id, id));
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

  if (!updated) return void res.status(404).json({ error: "Folder not found" });
  res.json(await getFolderWithCount(updated));
});

router.post("/folders/:id/invite", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const folderId = parseInt(req.params['id'] as string, 10);
  if (isNaN(folderId)) return void res.status(400).json({ error: "Invalid folder id" });

  const [folder] = await db
    .select()
    .from(foldersTable)
    .where(and(eq(foldersTable.id, folderId), eq(foldersTable.userId, userId)));

  if (!folder) return void res.status(404).json({ error: "Folder not found" });

  const { email, firstName = "", lastName = "", role = "team_member" } = req.body as {
    email?: string; firstName?: string; lastName?: string; role?: string;
  };

  if (!email) return void res.status(400).json({ error: "email is required" });

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

// ── PATCH /folders/:id/members/:email ───────────────────────────────────────
// Update a member's role across all campaigns in the folder
router.patch("/folders/:id/members/:email", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const folderId = parseInt(req.params['id'] as string, 10);
  const email = decodeURIComponent(req.params['email'] as string);
  const { role } = req.body as { role?: string };

  if (!role) return void res.status(400).json({ error: "role is required" });

  const [folder] = await db
    .select()
    .from(foldersTable)
    .where(and(eq(foldersTable.id, folderId), eq(foldersTable.userId, userId)));

  if (!folder) return void res.status(404).json({ error: "Folder not found" });

  const permissions = DEFAULT_PERMISSIONS[role] ?? ["view"];
  const folderCampaigns = await db
    .select()
    .from(campaignsTable)
    .where(eq(campaignsTable.folderId, folderId));

  for (const campaign of folderCampaigns) {
    await db
      .update(campaignMembersTable)
      .set({ role, permissions })
      .where(
        and(
          eq(campaignMembersTable.campaignId, campaign.id),
          eq(campaignMembersTable.email, email),
        )
      );
  }

  res.json({ ok: true });
});

// ── DELETE /folders/:id/members/:email ──────────────────────────────────────
// Remove a member from all campaigns in the folder
router.delete("/folders/:id/members/:email", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  const folderId = parseInt(req.params['id'] as string, 10);
  const email = decodeURIComponent(req.params['email'] as string);

  const [folder] = await db
    .select()
    .from(foldersTable)
    .where(and(eq(foldersTable.id, folderId), eq(foldersTable.userId, userId)));

  if (!folder) return void res.status(404).json({ error: "Folder not found" });

  const folderCampaigns = await db
    .select()
    .from(campaignsTable)
    .where(eq(campaignsTable.folderId, folderId));

  for (const campaign of folderCampaigns) {
    await db
      .delete(campaignMembersTable)
      .where(
        and(
          eq(campaignMembersTable.campaignId, campaign.id),
          eq(campaignMembersTable.email, email),
        )
      );
  }

  res.status(204).send();
});

router.get("/folders/:id/info", requireAuth, async (req, res) => {
  const folderId = parseInt(req.params['id'] as string, 10);
  if (isNaN(folderId)) return void res.status(400).json({ error: "Invalid folder id" });

  const [folder] = await db
    .select({ id: foldersTable.id, title: foldersTable.title })
    .from(foldersTable)
    .where(eq(foldersTable.id, folderId));

  if (!folder) return void res.status(404).json({ error: "Folder not found" });
  res.json(folder);
});

router.get("/shared/folder/:token", async (req, res) => {
  const { token } = GetSharedFolderParams.parse(req.params);

  const [folder] = await db
    .select()
    .from(foldersTable)
    .where(eq(foldersTable.shareToken, token));

  if (!folder) return void res.status(404).json({ error: "Shared folder not found" });

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
