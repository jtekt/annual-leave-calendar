const {Router} = require('express')
const {
  get_all_entries,
  get_single_entry,
  update_entry,
  delete_entry,
} = require('../controllers/yotei.js')

const router = Router()

router.route('/')
  .get(get_all_entries)

router.route('/:_id')
  .get(get_single_entry)
  .put(update_entry)
  .patch(update_entry)
  .delete(delete_entry)

module.exports = router
