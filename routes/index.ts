import { Router } from "express"
import router_v1 from "./v1/index"
import router_v2 from "./v2/index"
import router_v3 from "./v3/index"
import { legacyMiddleware, oidcMiddleware } from "../auth";

const router = Router();

router.use("/", legacyMiddleware(), router_v1)
router.use("/v1", legacyMiddleware(), router_v1)
router.use("/v2", legacyMiddleware(), router_v2)
router.use("/v3", oidcMiddleware(), router_v3)

export default router
