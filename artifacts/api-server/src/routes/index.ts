import { Router, type IRouter } from "express";
import healthRouter from "./health";
import campaignsRouter from "./campaigns";
import campaignMembersRouter from "./campaign-members";
import contentPiecesRouter from "./content-pieces";
import commentsRouter from "./comments";
import dashboardRouter from "./dashboard";
import foldersRouter from "./folders";
import invitesRouter from "./invites";

const router: IRouter = Router();

router.use(healthRouter);
router.use(campaignsRouter);
router.use(campaignMembersRouter);
router.use(contentPiecesRouter);
router.use(commentsRouter);
router.use(dashboardRouter);
router.use(foldersRouter);
router.use(invitesRouter);

export default router;
