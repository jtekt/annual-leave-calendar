const dotenv = require('dotenv')
const axios = require('axios')
const Yotei = require('../models/yotei.js')

dotenv.config()

function get_current_user_id(res){
  return res.locals.user.identity.low
    ?? res.locals.user.identity
}

exports.get_entries_of_user = (req, res) => {

  let user_id = req.params.id
    ?? get_current_user_id(res)

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

  let user_id = req.params.id
    || get_current_user_id(res)

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
    user_id : user_id,
    date: date,
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

  let entry_id = req.params.id
    || req.params.entry_id
    || req.params.yotei_id

  Yotei.findById(entry_id)
  .then(result => {
    console.log(`[Mongoose] 予定 ${entry_id} queried`)
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
  let entry_id = req.params.id
    || req.params.entry_id
    || req.params.yotei_id

  if(!entry_id) {
    console.log(`Undefined ID`)
    return res.status(400).send(`Undefined ID`)
  }

  Yotei.updateOne({_id: entry_id}, req.body)
  .then(result => {
    console.log(`[Mongoose] 予定 ${entry_id} updated`)
    res.send(result)
  })
  .catch(error => { error_handling(error, res) })
}

exports.delete_entry = (req, res) => {

  let entry_id = req.params.id
    || req.params.entry_id
    || req.params.yotei_id

  if(!entry_id) {
    console.log(`Undefined ID`)
    return res.status(400).send(`Undefined ID`)
  }

  Yotei.deleteOne({_id: entry_id})
  .then(result => {
    console.log(`[Mongoose] 予定 ${entry_id} deleted`)
    res.send(result)
  })
  .catch(error => { error_handling(error, res) })

}

exports.get_entries_of_group = (req, res) => {

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

  // Why is there auth here?
  // Maybe because token needed for group manager request
  // Idea: have token in middleware
  if(!('authorization' in req.headers)) {
    console.log(`Authorization header not set`)
    res.status(403).send(`Authorization header not set`)
    return
  }

  const jwt = req.headers.authorization.split(" ")[1]

  if(!jwt){
    console.log(`JWT not found`)
    res.status(403).send(`JWT not found`)
    return
  }

  const group_id = req.params.id ?? req.params.group_id

  if(!group_id) {
    console.log(`Undefined group ID`)
    res.status(400).send(`Undefined group ID`)
    return
  }

  // Get group members using API call to group manager microservice
  const url = `${process.env.GROUP_MANAGER_API_URL}/groups/${group_id}/members`
  const options = {headers: {Authorization: `Bearer ${jwt}`}}

  axios.get(url, options)
  .then(response => {

    let user_records = response.data

    const queried_year = req.query.year || new Date().getYear() + 1900
    const start_of_year = new Date(`${queried_year}/01/01`)
    const end_of_year = new Date(`${queried_year}/12/31`)

    // Build a query so as to get yoteis of all members using their ID
    const query = {
      $or: user_records.map( record => {

        const user = record._fields[record._fieldLookup.user]
        const user_id = user.identity.low ?? user.identity

        return { user_id }
      }),
      date: {$gte: start_of_year, $lte: end_of_year}
    }


    Yotei.find(query)
    .sort('date')
    .then(entries => {

      /*
      // Entries format:
      [
        {
          _id: "1234dsfs",
          user_id: 1223,
          date: ...

        },
        {...}
      ]

      */

      // Create a mapping for entries
      let entries_mapping = {}
      entries.forEach((entry) => {
        if(!entries_mapping[entry.user_id]){
          entries_mapping[entry.user_id] = []
        }
        entries_mapping[entry.user_id].push(entry)
      })

      /*
      {
        21313213: [entry, entry],
        123535: [entry, entry],
      }
      */

      // put the entries in the corresponding user records
      user_records.forEach( (record) => {
        const user = record._fields[record._fieldLookup.user]
        const user_id = user.identity.low ?? user.identity

        /*
        user.entries = entries.filter(entry => {
          return entry.user_id === String(user_id)
        })
        */

        user.entries = entries_mapping[user_id] || []

      })

      console.log(`[Mongoose] 予定 of group ${group_id} queried`)

      res.send(user_records)
    })
    .catch(error => { error_handling(error, res) })

  })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error fetching group`)
  })

}
