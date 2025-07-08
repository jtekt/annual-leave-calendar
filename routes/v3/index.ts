import { Router } from "express"
import allocationsRouter from "./allocations"
import entriesRouter from "./entries"
import groupsRouter from "./groups"
import usersRouter from "./users"
import workplacesRouter from "./workplaces"

const router = Router()

router.use("/users", usersRouter)
router.use("/groups", groupsRouter)
router.use("/workplaces", workplacesRouter)
router.use("/entries", entriesRouter)
router.use("/allocations", allocationsRouter)

export default router
