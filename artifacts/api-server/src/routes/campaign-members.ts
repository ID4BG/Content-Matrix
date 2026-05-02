import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { campaignMembersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  InviteCampaignMemberBody,
  UpdateCampaignMemberBody,
  InviteCampaignMemberParams,
  UpdateCampaignMemberParams,
  DeleteCampaignMemberParams,
  ListCampaignMembersParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/campaigns/:id/members", requireAuth, async (req, res) => {
  const { id } = ListCampaignMembersParams.parse(req.params);
  const members = await db
    .select()
    .from(campaignMembersTable)
    .where(eq(campaignMembersTable.campaignId, id));
  res.json(members);
});

router.post("/campaigns/:id/members", requireAuth, async (req, res) => {
  const { id } = InviteCampaignMemberParams.parse(req.params);
  const body = InviteCampaignMemberBody.parse(req.body);
  const [member] = await db
    .insert(campaignMembersTable)
    .values({ campaignId: id, email: body.email, role: body.role })
    .returning();
  res.status(201).json(member);
});

router.patch("/campaigns/:id/members/:memberId", requireAuth, async (req, res) => {
  const { memberId } = UpdateCampaignMemberParams.parse(req.params);
  const body = UpdateCampaignMemberBody.parse(req.body);
  const [updated] = await db
    .update(campaignMembersTable)
    .set({ role: body.role })
    .where(eq(campaignMembersTable.id, memberId))
    .returning();
  if (!updated) return res.status(404).json({ error: "Member not found" });
  res.json(updated);
});

router.delete("/campaigns/:id/members/:memberId", requireAuth, async (req, res) => {
  const { memberId } = DeleteCampaignMemberParams.parse(req.params);
  await db.delete(campaignMembersTable).where(eq(campaignMembersTable.id, memberId));
  res.status(204).send();
});

export default router;
