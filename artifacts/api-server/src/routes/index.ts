import { Router, type IRouter } from "express";
import healthRouter from "./health";
import campaignsRouter from "./campaigns";
import campaignMembersRouter from "./campaign-members";
import contentPiecesRouter from "./content-pieces";
import importDocumentRouter from "./import-document";
import commentsRouter from "./comments";
import dashboardRouter from "./dashboard";
import foldersRouter from "./folders";
import invitesRouter from "./invites";
import adminFixRouter from "./admin-fix";

const router: IRouter = Router();

router.use(healthRouter);
router.use(campaignsRouter);
router.use(campaignMembersRouter);
router.use(contentPiecesRouter);
router.use(importDocumentRouter);
router.use(commentsRouter);
router.use(dashboardRouter);
router.use(foldersRouter);
router.use(invitesRouter);
router.use(adminFixRouter);

export default router;
