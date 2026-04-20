import { Router } from "express"
import router_v1 from "./v1/index"
import router_v2 from "./v2/index"
import router_v3 from "./v3/index"
import caldavRouter from "./caldav"
import { legacyMiddleware, oidcMiddleware } from "../auth"

const router = Router()

// caldav before "/"" so as to not get intrercepted
router.all("/.well-known/caldav", (_req, res) => res.redirect(301, "/caldav/"))
router.use("/caldav", caldavRouter)

router.use("/v1", legacyMiddleware(), router_v1)
router.use("/v2", legacyMiddleware(), router_v2)
router.use("/v3", oidcMiddleware(), router_v3)

router.use("/", legacyMiddleware(), router_v1)

export default router
