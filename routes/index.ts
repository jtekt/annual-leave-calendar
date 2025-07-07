import { Router } from "express"
import router_v1 from "./v1/index"
import router_v2 from "./v2/index"
import { getMiddlewareChain } from "../auth";

const router = Router();

router.use(getMiddlewareChain());

router.use("/", router_v1)
router.use("/v1", router_v1)
router.use("/v2", router_v2)

export default router
