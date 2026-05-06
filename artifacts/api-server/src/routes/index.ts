import { Router, type IRouter } from "express";
import healthRouter from "./health";
import botRouter from "./bot/index";
import guildRouter from "./bot/guild";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/bot", botRouter);
router.use("/bot/guild", guildRouter);

export default router;
