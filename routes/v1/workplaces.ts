import { Router } from "express"
import { get_entries_of_workplace } from "../../controllers/v1/entries"

const router = Router()

router.route("/:workplace_id/entries").get(get_entries_of_workplace)

export default router
