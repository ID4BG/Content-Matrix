import { Router, type IRouter } from "express";
import healthRouter from "./health";
import campaignsRouter from "./campaigns";
import contentPiecesRouter from "./content-pieces";
import commentsRouter from "./comments";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(campaignsRouter);
router.use(contentPiecesRouter);
router.use(commentsRouter);
router.use(dashboardRouter);

export default router;
