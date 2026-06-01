import { Router } from "express"
import router_v1 from "./v1/index"
import router_v2 from "./v2/index"
import caldavRouter from "./caldav"
import { identificationMiddleware } from "../auth"

const router = Router()

// caldav before "/"" so as to not get intrercepted
router.all("/.well-known/caldav", (_req, res) => res.redirect(301, "/caldav/"))
router.use("/caldav", caldavRouter)

router.use("/v1", identificationMiddleware(), router_v1)
router.use("/v2", identificationMiddleware(), router_v2)

router.use("/", identificationMiddleware(), router_v1)

export default router
