import { Router } from "express";
import {
  create_allocation,
  get_single_allocation,
  get_all_allocations,
  update_allocation,
  delete_allocation,
} from "../controllers/allocations";

const router = Router();

router.route("/").post(create_allocation).get(get_all_allocations);

router
  .route("/:_id")
  .get(get_single_allocation)
  .put(update_allocation)
  .patch(update_allocation)
  .delete(delete_allocation);

export default router;
