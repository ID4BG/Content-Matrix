import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { campaignMembersTable, campaignsTable, foldersTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { clerkClient } from "@clerk/express";

const router: IRouter = Router();

const ALLOWED_EMAILS = ["arnela.ayvazyan@gmail.com"];

const OWNER_PERMISSIONS = ["view", "comment", "edit", "create", "approve", "invite"];

router.post("/admin/fix-ownership", requireAuth, async (req, res) => {
  const userId = (req as any).userId;

  let email: string | undefined;
  try {
    const clerkUser = await clerkClient.users.getUser(userId);
    email = clerkUser.emailAddresses?.[0]?.emailAddress;
  } catch {
    return res.status(500).json({ error: "Could not verify identity" });
  }

  if (!email || !ALLOWED_EMAILS.includes(email)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Find all campaigns where this user is NOT already the creator
  // and upsert them as owner in campaign_members
  const allCampaigns = await db.select({ id: campaignsTable.id, userId: campaignsTable.userId })
    .from(campaignsTable);

  // Only fix campaigns where the user is currently a non-owner member or has no membership
  const existingMemberships = await db
    .select({ campaignId: campaignMembersTable.campaignId, role: campaignMembersTable.role })
    .from(campaignMembersTable)
    .where(eq(campaignMembersTable.email, email));

  const membershipMap = new Map(existingMemberships.map(m => [m.campaignId, m.role]));

  // Campaigns where the user is a non-owner accepted member — promote to owner
  const toPromote = allCampaigns.filter(c =>
    c.userId !== userId && membershipMap.has(c.id) && membershipMap.get(c.id) !== "owner"
  );

  const promoted: number[] = [];
  for (const c of toPromote) {
    await db
      .update(campaignMembersTable)
      .set({ role: "owner", permissions: OWNER_PERMISSIONS, accepted: true })
      .where(and(
        eq(campaignMembersTable.campaignId, c.id),
        eq(campaignMembersTable.email, email),
      ));
    promoted.push(c.id);
  }

  return res.json({
    ok: true,
    promoted,
    message: promoted.length > 0
      ? `Promoted to owner on campaign(s): ${promoted.join(", ")}`
      : "No campaigns needed fixing",
  });
});

export default router;
