const dotenv = require('dotenv')
const axios = require('axios')
const mongoose = require('mongoose')
const Yotei = require('../models/yotei.js')

dotenv.config()

const mongodb_url = process.env.MONGODB_URL || 'mongodb://mongo'
const mongodb_db = process.env.MONGODB_DB ||'nenkyuu_calendar'
const mongodb_options = {
   useUnifiedTopology: true,
   useNewUrlParser: true,
}

global.mongodb_connected = false

mongoose.connect(`${mongodb_url}/${mongodb_db}`, mongodb_options)

const db = mongoose.connection
db.on('error', console.error.bind(console, 'connection error:'))
db.once('open', () => { mongodb_connected = true })

const error_handling = (error, res) => {
  console.log(error)
  res.status(500).send('MongoDB error')
}

exports.mongodb_url = mongodb_url
exports.mongodb_db = mongodb_db


exports.get_entries_of_user = (req, res) => {

  let user_id = req.params.id
    || res.locals.user.identity.low

  if(user_id === 'self') user_id = res.locals.user.identity.low


  if(!user_id) {
    console.log(`Undefined user ID`)
    res.status(400).send(`Undefined user ID`)
    return
  }

  Yotei.find({ user_id: user_id })
  .sort('date')
  .then(results => {
    console.log(`[Mongoose] 予定 of user ${user_id} queried`)
    res.send(results)
  })
  .catch(error => { error_handling(error, res) })

}

exports.create_entry = (req, res) => {

  let user_id = req.params.id
    || res.locals.user.identity.low

  if(user_id === 'self') user_id = res.locals.user.identity.low

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
    am: req.body.am || true,
    pm: req.body.pm || true,
    taken: req.body.taken || false,
    refresh:req.body.refresh || false,
    plus_one: req.body.plus_one || false,
  }

  Yotei.create(new_yotei)
  .then(result => {
    console.log(`[Mongoose] 予定 ${result._id} created for user ${user_id}`)
    res.send(result)
   })
  .catch(error => { error_handling(error, res) })
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
  Yotei.find({})
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

  const group_id = req.params.id

  if(!group_id) {
    console.log(`Undefined group ID`)
    res.status(400).send(`Undefined group ID`)
    return
  }


  const url = `${process.env.GROUP_MANAGER_API_URL}/groups/${group_id}/members`
  axios.get(url, {headers: {Authorization: `Bearer ${jwt}`}})
  .then(response => {
    let user_records = response.data

    const query = {
      $or: user_records.map(record => {
        return {user_id: record._fields[record._fieldLookup.user].identity.low}
      })
    }

    Yotei.find(query)
    .sort('date')
    .then(entries => {

      // put the entries in the corresponding user records
      // NOT OPTIMAL AT ALL
      user_records.forEach((record) => {
        let user = record._fields[record._fieldLookup.user]
        let user_entries = entries.filter(entry => {
          return entry.user_id === String(user.identity.low)
        })

        user.entries = user_entries

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
