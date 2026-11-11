import { Router } from "express"
import { get_entries_of_user, create_entry } from "../../controllers/v1/entries"
import {
  get_allocations_of_user,
  create_allocation,
} from "../../controllers/v1/allocations"
import { list_users, get_user } from "../../controllers/v1/users"

const router = Router()

router.route("/").get(list_users)
router.route("/:user_id/entries").get(get_entries_of_user).post(create_entry)
router
  .route("/:user_id/allocations")
  .get(get_allocations_of_user)
  .post(create_allocation)
router.route("/:user_id").get(get_user)

export default router
