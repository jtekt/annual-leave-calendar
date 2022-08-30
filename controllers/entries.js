const dotenv = require('dotenv')
const axios = require('axios')
const Entry = require('../models/entry.js')
const createHttpError = require('http-errors')
const { get_id_of_item } = require('../utils.js')
const mongoose = require('mongoose');

dotenv.config()

function get_current_user_id(res){
  const {user} = res.locals
  return get_id_of_item(user)
}

exports.get_entries_of_user = async (req, res, next) => {
  try {
    let {user_id} = req.params
    if(user_id === 'self') user_id = get_current_user_id(res)


    if(!user_id) throw createHttpError(400, `User ID not provided`)

    const {
      year = new Date().getFullYear() ,
      start_date,
      end_date
    } = req.query
  
    const start_of_date = (start_date) ? new Date(start_date) : new Date(`${year}/01/01`)
    const end_of_date = (end_date) ? new Date(end_date) : new Date(`${year}/12/31`)
  
    const query = { user_id, date: {$gte: start_of_date, $lte: end_of_date} }

    const entries = await Entry
      .find(query)
      .sort('date')

    console.log(`[Mongoose] 予定 of user ${user_id} queried`)
    res.send(entries)
  }
  catch (error) {
    next(error)
  }



}

exports.create_entry = async (req, res, next) => {

  try {
    const {
      date,
      type = '有休',
      am = true,
      pm = true,
      taken = false,
      refresh = false,
      plus_one = false,
    } = req.body

    let {user_id} = req.params
    if(user_id === 'self') user_id = get_current_user_id(res)

    if(!user_id) throw createHttpError(400, `User ID not provided`)
    if(!date) throw createHttpError(400, `Date not provided`)


    const entry_properties = {
      user_id,
      date,
      type,
      am,
      pm,
      taken,
      refresh,
      plus_one,
    }

    const entry = await Entry.create(entry_properties)

    console.log(`[Mongoose] Entry ${entry._id} created for user ${user_id}`)
    res.send(entry)
  }
  catch (error) {
    next(error)
  }

}

exports.create_entries = async (req, res, next) => {

  try {
    const entries = req.body

    if(entries.some(({user_id})=>!user_id)) throw createHttpError(400, `User ID not provided`)
    if(entries.some(({date})=>!date)) throw createHttpError(400, `User ID not provided`)

    const result = await Entry.insertMany(entries)
    console.log(`[Mongoose] created entries`)
    res.send(result)
  }
  catch (error) {
    next(error)
  }

}

exports.get_single_entry = async (req, res, next) => {

  try {
    const {_id} = req.params

    if(!_id) throw createHttpError(400, `ID is not provided`)

    const entry = await Entry.findById(_id)

    console.log(`[Mongoose] 予定 ${entry._id} queried`)
    res.send(entry)
  }
  catch (error) {
    next(error)
  }


}

exports.get_all_entries = async (req, res, next) => {

  try {

    const {
      year = new Date().getFullYear(),
      start_date,
      end_date,
      user_ids,
      limit = 100,
      skip = 0

    } = req.query

    const start_of_date = (start_date) ? new Date(start_date) : new Date(`${year}/01/01`)
    const end_of_date = (end_date) ? new Date(end_date) : new Date(`${year}/12/31`)

    const query = {
      date: { $gte: start_of_date, $lte: end_of_date }
    }

    if (user_ids) query.$or = user_ids.map((user_id) => ({ user_id }))

    const entries = await Entry
      .find(query)
      .skip(Number(skip))
      .limit(Math.max(Number(limit), 0))
    
    const total = await Entry.countDocuments(query)

    const response = {
      start_of_date,
      end_of_date,
      limit,
      skip,
      total,
      entries,
    }

    console.log(`[Mongoose] Queried entries`)
    res.send(response)
  }
  catch (error) {
    next(error)
  }


}

exports.update_entry = async (req, res, next) => {

  try {
    const {_id} = req.params

    if(!_id) throw createHttpError(400, `ID is not provided`)

    const result = await Entry.updateOne({_id}, req.body)

    console.log(`[Mongoose] 予定 ${_id} updated`)
    res.send(result)
  }
  catch (error) {
    next(error)
  }

}

exports.update_entries = async (req, res, next) => {
  
  try {
    const entries = req.body
    
    if(entries.some(({_id})=>!_id)) throw createHttpError(400, `_id not provided`)
    if(entries.some(({type})=>!type)) throw createHttpError(400, `type not provided`)

    const bulkOps = entries.map((entry) => {

      const {
        type,
      } = entry

      let opts = {
        updateOne: {
          filter: {
            _id: mongoose.Types.ObjectId(entry._id),
          },
          update: { $set: {
            type: String(type),
          }},
        }
      }

      return opts
    })

    // Warning: bulkWrite does not apply validation
    // Could consider using a for loop and updateOne with upsert
    // However, this would seriously impact performance
    const result = await Entry.collection.bulkWrite(bulkOps)
    console.log(`[Mongoose] updated entries`)
    res.send(result)
  }
  catch (error) {
    next(error)
  }

}


exports.delete_entry = async (req, res, next) => {

  try {
    const {_id} = req.params

    if(!_id) throw createHttpError(400, `ID is not provided`)

    const result = await Entry.deleteOne({_id})

    console.log(`[Mongoose] 予定 ${_id} deleted`)
    res.send(result)
  }
  catch (error) {
    next(error)
  }
}


exports.delete_entries = async (req, res, next) => {

  try {
    const entries = req.query._id

    if(!entries) throw createHttpError(400, `_id not provided`)

    const bulkOps = entries.map((_id) => {
      let opts = {
        deleteOne: {
          filter: {
            _id: mongoose.Types.ObjectId(_id),
          },
        }
      }
      return opts
    })

    // Warning: bulkWrite does not apply validation
    // Could consider using a for loop and updateOne with upsert
    // However, this would seriously impact performance
    const result = await Entry.collection.bulkWrite(bulkOps)
    console.log(`[Mongoose] deleted entries`)
    res.send(result)
  }
  catch (error) {
    next(error)
  }
}

exports.get_entries_of_group = async (req, res, next) => {


  try {

    const { group_id } = req.params
    const url = `${process.env.GROUP_MANAGER_API_URL}/v3/groups/${group_id}/members`
    const headers = {authorization: req.headers.authorization}

    const {data: {items: users}} = await axios.get(url, {headers})

    const {
      year = new Date().getFullYear(),
      start_date,
      end_date
    } = req.query

    const start_of_date = (start_date) ? new Date(start_date) : new Date(`${year}/01/01`)
    const end_of_date = (end_date) ? new Date(end_date) : new Date(`${year}/12/31`)

    const user_ids = users.map(user => ({ user_id: get_id_of_item(user) }))

    if(!user_ids.length) throw createHttpError(404, `Group ${group_id} appears to be empty`)

    const query = {
      $or: user_ids,
      date: {$gte: start_of_date, $lte: end_of_date}
    }

    const entries = await Entry.find(query).sort('date')

    // TODO: Could probably be achieved using reduce
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

    console.log(`[Mongoose] Entries of group ${group_id} queried`)

    res.send(output)

  }
  catch (error) {
    next(error)
  }

}
