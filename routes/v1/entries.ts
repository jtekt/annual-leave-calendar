import { Router } from "express"
import {
  get_all_entries,
  get_single_entry,
  update_entry,
  update_entries,
  delete_entry,
  delete_entries,
  create_entries,
} from "../../controllers/v1/entries"

const router = Router()

router
  .route("/")
  .get(get_all_entries)
  .post(create_entries)
  .put(update_entries)
  .patch(update_entries)
  .delete(delete_entries)

router
  .route("/:_id")
  .get(get_single_entry)
  .put(update_entry)
  .patch(update_entry)
  .delete(delete_entry)

export default router
