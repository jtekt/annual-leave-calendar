import { Router } from "express"
import router_v1 from "./v1/index"
import router_v2 from "./v2/index"
import caldavRouter from "./caldav"
import mcpRouter from "./mcp"
import { identificationMiddleware } from "../auth"

const router = Router()

// caldav before "/"" so as to not get intrercepted
router.all("/.well-known/caldav", (_req, res) => res.redirect(301, "/caldav/"))
router.use("/caldav", caldavRouter)
router.use("/mcp", mcpRouter)

router.use(identificationMiddleware())
router.use("/", router_v1)
router.use("/v1", router_v1)
router.use("/v2", router_v2)

export default router
