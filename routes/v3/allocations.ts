import { Router } from "express"
import {
  create_allocation,
  get_all_allocations,
} from "../../controllers/v3/allocations"

const router = Router()

router.route("/").get(get_all_allocations).post(create_allocation)

export default router
