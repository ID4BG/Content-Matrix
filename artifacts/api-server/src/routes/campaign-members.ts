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

const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  owner: ["view", "comment", "edit", "create", "approve", "invite"],
  marketer: ["view", "comment", "edit", "create"],
  team_member: ["view", "comment"],
};

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
  const permissions = body.permissions?.length
    ? body.permissions
    : DEFAULT_PERMISSIONS[body.role] ?? ["view"];

  const [member] = await db
    .insert(campaignMembersTable)
    .values({
      campaignId: id,
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
      role: body.role,
      permissions,
    })
    .returning();
  res.status(201).json(member);
});

router.patch("/campaigns/:id/members/:memberId", requireAuth, async (req, res) => {
  const { memberId } = UpdateCampaignMemberParams.parse(req.params);
  const body = UpdateCampaignMemberBody.parse(req.body);

  const updateData: Record<string, unknown> = {};
  if (body.firstName !== undefined) updateData.firstName = body.firstName;
  if (body.lastName !== undefined) updateData.lastName = body.lastName;
  if (body.role !== undefined) updateData.role = body.role;
  if (body.permissions !== undefined) updateData.permissions = body.permissions;

  const [updated] = await db
    .update(campaignMembersTable)
    .set(updateData)
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
