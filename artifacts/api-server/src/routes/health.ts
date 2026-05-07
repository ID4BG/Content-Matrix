import express from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { clerkClient } from "@clerk/express";
import { db } from "@workspace/db";
import { campaignsTable, foldersTable, activityTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = express.Router();

router.get("/healthz", (_req, res) => {
  return res.status(200).json({ status: "ok" });
});

// Debug endpoint — tells the caller their Clerk userId and email
router.get("/whoami", requireAuth, async (req, res) => {
  const userId = (req as any).userId;
  try {
    const user = await clerkClient.users.getUser(userId);
    const email = user.emailAddresses?.[0]?.emailAddress ?? null;
    return res.json({ userId, email });
  } catch {
    return res.json({ userId, email: null });
  }
});

// Debug endpoint — shows which database this API is connected to, plus campaign IDs/counts
router.get("/db-info", async (_req, res) => {
  const url = process.env.DATABASE_URL ?? "";
  let hostInfo: Record<string, string> = { host: "PARSE_ERROR", database: "", port: "" };
  try {
    const parsed = new URL(url);
    hostInfo = { host: parsed.hostname, database: parsed.pathname.replace("/", ""), port: parsed.port || "5432" };
  } catch { /* ignore */ }

  // Also fetch campaign summary so the user can see what's in the connected DB
  try {
    const [campaigns, folders, activityCount] = await Promise.all([
      db.select({ id: campaignsTable.id, title: campaignsTable.title, userId: campaignsTable.userId }).from(campaignsTable),
      db.select({ id: foldersTable.id, title: foldersTable.title }).from(foldersTable),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(activityTable),
    ]);

    // Check which tables exist in the DB
    const tablesResult = await db.execute(
      sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );
    const tables = (tablesResult.rows as Array<{ tablename: string }>).map(r => r.tablename);

    return res.json({
      ...hostInfo,
      tables,
      campaigns: campaigns.map(c => ({ id: c.id, title: c.title, userId: c.userId.slice(0, 20) + "..." })),
      folders: folders.map(f => ({ id: f.id, title: f.title })),
      activityCount: activityCount[0]?.count ?? 0,
    });
  } catch (err) {
    return res.json({ ...hostInfo, dbError: String(err) });
  }
});

export default router;
