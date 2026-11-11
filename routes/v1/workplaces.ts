import { Router } from "express"
import { get_entries_of_workplace } from "../../controllers/v1/entries"
import { list_workplaces } from "../../controllers/v1/workplaces"

const router = Router()

router.route("/").get(list_workplaces)
router.route("/:workplace_id/entries").get(get_entries_of_workplace)

export default router
