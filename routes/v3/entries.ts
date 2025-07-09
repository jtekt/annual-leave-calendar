import { Router } from "express"
import {
  get_all_entries,
  create_entries,
} from "../../controllers/v3/entries"

const router = Router()

router
  .route("/")
  .get(get_all_entries)
  .post(create_entries)

export default router
