import { Router } from "express"
import router_v1 from "./v1/index"
import router_v2 from "./v2/index"
import router_v3 from "./v3/index"

const router = Router()

router.use("/", router_v1)
router.use("/v1", router_v1)
router.use("/v2", router_v2)
router.use("/v3", router_v3)

export default router
