import express from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { clerkClient } from "@clerk/express";

const router = express.Router();

router.get("/healthz", (_req, res) => {
  return res.status(200).json({ status: "ok" });
});

// Debug endpoint — tells the caller their Clerk userId and email
// Useful for diagnosing user ID mismatches between environments
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

export default router;
