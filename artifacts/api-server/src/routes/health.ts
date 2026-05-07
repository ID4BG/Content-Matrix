import express from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { clerkClient } from "@clerk/express";

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

// Debug endpoint — shows which database this API is connected to (host only, no password)
router.get("/db-info", async (_req, res) => {
  const url = process.env.DATABASE_URL ?? "";
  try {
    const parsed = new URL(url);
    return res.json({ host: parsed.hostname, database: parsed.pathname.replace("/", ""), port: parsed.port || "5432" });
  } catch {
    return res.json({ host: "PARSE_ERROR", raw_length: url.length });
  }
});

export default router;
