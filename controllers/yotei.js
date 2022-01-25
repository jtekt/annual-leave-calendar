const dotenv = require('dotenv')
const axios = require('axios')
const Yotei = require('../models/yotei.js')
const {
  get_id_of_item,
  error_handling,
 } = require('../utils.js')

dotenv.config()

function get_current_user_id(res){
  const current_user = res.locals.user
  return get_id_of_item(current_user)
}

exports.get_entries_of_user = (req, res) => {

  let {user_id} = req.params
  if(user_id === 'self') user_id = get_current_user_id(res)

  if(user_id === 'self') user_id = get_current_user_id(res)


  if(!user_id) {
    console.log(`Undefined user ID`)
    res.status(400).send(`Undefined user ID`)
    return
  }

  const queried_year = req.query.year || new Date().getYear() + 1900
  const start_of_year = new Date(`${queried_year}/01/01`)
  const end_of_year = new Date(`${queried_year}/12/31`)

  const query = { user_id, date: {$gte: start_of_year, $lte: end_of_year} }

  Yotei.find(query)
  .sort('date')
  .then(results => {
    console.log(`[Mongoose] 予定 of user ${user_id} queried`)
    res.send(results)
  })
  .catch(error => { error_handling(error, res) })

}

exports.create_entry = (req, res) => {

  let {user_id} = req.params
  if(user_id === 'self') user_id = get_current_user_id(res)

  if(!user_id) {
    console.log(`Undefined user ID`)
    return res.status(400).send(`Undefined user ID`)
  }

  const date = req.body.date

  if(!date) {
    console.log(`Undefined date`)
    return res.status(400).send(`Undefined date`)
  }

  const new_yotei = {
    user_id,
    date,
    type: req.body.type ?? "有休",
    am: req.body.am ?? true,
    pm: req.body.pm ?? true,
    taken: req.body.taken ?? false,
    refresh:req.body.refresh ?? false,
    plus_one: req.body.plus_one ?? false,
  }

  Yotei.create(new_yotei)
  .then(result => {
    console.log(`[Mongoose] 予定 ${result._id} created for user ${user_id}`)
    res.send(result)
   })
  .catch(error => {
    if(error.code === 11000) {
      res.status(400).send(`その日にはもう予定が存在してます`)
      console.log(`[Mongoose] 予定 already exists`)
    }
    else {
      error_handling(error)
    }

  })
}

exports.get_single_entry = (req, res) => {

  const {_id} = req.params

  if(!_id) {
    console.log(`Undefined ID`)
    return res.status(400).send(`Undefined ID`)
  }

  Yotei.findById(_id)
  .then(result => {
    console.log(`[Mongoose] 予定 ${_id} queried`)
    res.send(result)
   })
  .catch(error => { error_handling(error, res) })
}

exports.get_all_entries = (req, res) => {

  let query = req.query

  // Dirty
  try { query.date = JSON.parse(query.date) }
  catch (e) {}

  Yotei.find(query)
  .then(result => {
    console.log(`[Mongoose] Queried all 予定`)
    res.send(result)
   })
  .catch(error => { error_handling(error, res) })
}

exports.update_entry = (req, res) => {

  const {_id} = req.params

  if(!_id) {
    console.log(`Undefined ID`)
    return res.status(400).send(`Undefined ID`)
  }

  Yotei.updateOne({_id}, req.body)
  .then(result => {
    console.log(`[Mongoose] 予定 ${_id} updated`)
    res.send(result)
  })
  .catch(error => { error_handling(error, res) })
}

exports.delete_entry = (req, res) => {

  const {_id} = req.params

  if(!_id) {
    console.log(`Undefined ID`)
    return res.status(400).send(`Undefined ID`)
  }

  Yotei.deleteOne({_id})
  .then(result => {
    console.log(`[Mongoose] 予定 ${_id} deleted`)
    res.send(result)
  })
  .catch(error => { error_handling(error, res) })

}

exports.get_entries_of_group = async (req, res) => {

  /*
  // response format:
  [
    {
      identity: 123,
      properties: {},
      yotei: [],
    }
  ]
  */

  try {

    const {group_id} = req.params
    if(!group_id) throw `Undefined group ID`

    const url = `${process.env.GROUP_MANAGER_API_URL}/v3/groups/${group_id}/members`
    const options = {headers: {authorization: req.headers.authorization} }

    const {data} = await axios.get(url, options)
    const users = data.items

    const queried_year = req.query.year || new Date().getYear() + 1900
    const start_of_year = new Date(`${queried_year}/01/01`)
    const end_of_year = new Date(`${queried_year}/12/31`)

    const query = {
      $or: users.map( user => ({ user_id: get_id_of_item(user) }) ),
      date: {$gte: start_of_year, $lte: end_of_year}
    }

    const entries = await Yotei.find(query).sort('date')

    let entries_mapping = {}
    entries.forEach((entry) => {
      if(!entries_mapping[entry.user_id]){
        entries_mapping[entry.user_id] = []
      }
      entries_mapping[entry.user_id].push(entry)
    })

    const output = users.map( (user) => {
      const user_id = get_id_of_item(user)
      user.entries = entries_mapping[user_id] || []
      return { user, entries: entries_mapping[user_id] || []}
    })

    console.log(`[Mongoose] 予定 of group ${group_id} queried`)

    res.send(output)

  }
  catch (error) {
    console.log(error)
    res.status(500).send(error)

  }

}
