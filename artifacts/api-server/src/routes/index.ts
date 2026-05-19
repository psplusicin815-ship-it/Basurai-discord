import { Router, type IRouter } from "express";
import healthRouter from "./health";
import botRouter from "./bot/index";
import guildRouter from "./bot/guild";
import dashboardRouter from "./dashboard";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/bot", botRouter);
router.use("/bot/guild", guildRouter);
router.use("/dashboard", dashboardRouter);

export default router;
