import { Router } from "express"
import { get_entries_of_user } from "../../controllers/v2/entries"

const router = Router()

router.route("/:indentifier/entries").get(get_entries_of_user)

export default router
