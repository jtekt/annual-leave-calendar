import { Router } from "express"
import { get_entries_of_group } from "../../controllers/v3/entries"
import { get_allocations_of_group } from "../../controllers/v3/allocations"

const router = Router()

router.route("/:group_id/entries").get(get_entries_of_group)
router.route("/:group_id/allocations").get(get_allocations_of_group)

export default router
