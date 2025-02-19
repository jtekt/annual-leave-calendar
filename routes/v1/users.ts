import { Router } from "express"
import { get_entries_of_user, create_entry } from "../../controllers/v1/entries"
import {
  get_allocations_of_user,
  create_allocation,
} from "../../controllers/v1/allocations"

const router = Router()

router.route("/:user_id/entries").get(get_entries_of_user).post(create_entry)
router
  .route("/:user_id/allocations")
  .get(get_allocations_of_user)
  .post(create_allocation)

export default router
