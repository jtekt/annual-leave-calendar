import { Router } from "express"
import { get_entries_of_group } from "../../controllers/v1/entries"
import { get_allocations_of_group } from "../../controllers/v1/allocations"
import { list_groups } from "../../controllers/v1/groups"

const router = Router()

router.route("/").get(list_groups)
router.route("/:group_id/entries").get(get_entries_of_group)
router.route("/:group_id/allocations").get(get_allocations_of_group)

export default router
