import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { foldersTable, campaignsTable, activityTable, contentPiecesTable } from "@workspace/db";
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

const router: IRouter = Router();

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
