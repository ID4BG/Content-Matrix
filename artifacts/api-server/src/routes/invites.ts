import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { campaignMembersTable, campaignsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.post("/invites/accept-pending", requireAuth, async (req, res) => {
  const userId = (req as any).userId;

  let email: string | undefined;
  try {
    const clerkUser = await clerkClient.users.getUser(userId);
    email = clerkUser.emailAddresses?.[0]?.emailAddress;
  } catch {
    return res.status(500).json({ error: "Could not resolve user email" });
  }

  if (!email) return res.json([]);

  const pending = await db
    .select({
      memberId: campaignMembersTable.id,
      campaignId: campaignMembersTable.campaignId,
      campaignTitle: campaignsTable.title,
      role: campaignMembersTable.role,
    })
    .from(campaignMembersTable)
    .innerJoin(campaignsTable, eq(campaignMembersTable.campaignId, campaignsTable.id))
    .where(
      and(
        eq(campaignMembersTable.email, email),
        eq(campaignMembersTable.accepted, false)
      )
    );

  if (!pending.length) return res.json([]);

  const memberIds = pending.map(p => p.memberId);

  await Promise.all(
    memberIds.map(id =>
      db
        .update(campaignMembersTable)
        .set({ accepted: true })
        .where(eq(campaignMembersTable.id, id))
    )
  );

  const accepted = pending.map(p => ({
    campaignId: p.campaignId,
    campaignTitle: p.campaignTitle,
    role: p.role,
  }));

  res.json(accepted);
});

export default router;
