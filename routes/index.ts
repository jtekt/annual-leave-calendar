import { Router } from "express"
import router_v1 from "./v1/index"
import router_v2 from "./v2/index"
import router_v3 from "./v3/index"
import caldavRouter from "./caldav/index"
import { legacyMiddleware, oidcMiddleware } from "../auth";

const router = Router();

router.use("/", legacyMiddleware(), router_v1)
router.use("/v1", legacyMiddleware(), router_v1)
router.use("/v2", legacyMiddleware(), router_v2)
router.use("/v3", oidcMiddleware(), router_v3)
router.all("/.well-known/caldav", (_req, res) => res.redirect(301, "/caldav/"))
router.use("/caldav", caldavRouter)

export default router
