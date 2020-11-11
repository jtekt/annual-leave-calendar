const mongodb = require('mongodb')
const dotenv = require('dotenv')
const axios = require('axios')

dotenv.config()

const MongoClient = mongodb.MongoClient
const ObjectID = mongodb.ObjectID

const mongodb_url = process.env.MONGODB_URL || 'mongodb://mongo'
const mongodb_db = 'nenkyuu_calendar'
const mongodb_collection = 'yotei'

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

    let query = {
      $or: user_records.map(record => {
        return {user_id: record._fields[record._fieldLookup.user].identity.low}
      })
    }

    MongoClient.connect(mongodb_url, (err, db) => {

      if (err) {
        console.log(err)
        res.status(500).send(`MongoDB connection error`)
        return
      }

      db.db(mongodb_db)
      .collection(mongodb_collection)
      .find(query).toArray( (err, result) => {

        if (err) {
          console.log(err)
          res.status(500).send(`MongoDB transaction error`)
          return
        }

        // put the entries in the corresponding user records
        user_records.forEach((record) => {
          let user = record._fields[record._fieldLookup.user]
          let user_entries = result.filter(entry => {
            return entry.user_id === user.identity.low
          })

          user.entries = user_entries

        })

        res.send(user_records)

        db.close()
      })
    })

  })
  .catch(error => {
    console.log(error)
    res.status(500).send(`Error fetching group`)
  })


}

exports.get_entries_of_user = (req, res) => {

  let user_id = req.params.id
    || res.locals.user.identity.low

  if(user_id === 'self') user_id = res.locals.user.identity.low


  if(!user_id) {
    console.log(`Undefined user ID`)
    res.status(400).send(`Undefined user ID`)
    return
  }


  MongoClient.connect(mongodb_url, (err, db) => {

    if (err) {
      console.log(err)
      res.status(500).send(`MongoDB connection error`)
      return
    }

    let query = {user_id: user_id}

    db.db(mongodb_db)
    .collection(mongodb_collection)
    .find(query).toArray( (err, result) => {

      if (err) {
        console.log(err)
        res.status(500).send(`MongoDB transaction error`)
        return
      }

      res.send(result)

      db.close()
    })
  })
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

  MongoClient.connect(mongodb_url, (err, db) => {

    if (err) {
      console.log(err)
      res.status(500).send(`MongoDB connection error`)
      return
    }

    const new_document = {
      user_id : user_id,
      date: date,
      am: true,
      pm: true,
      taken: false,
      refresh: false,
      plus_one: false,
    }

    db.db(mongodb_db)
    .collection(mongodb_collection)
    .insertOne(new_document, (err, result) => {

      if (err) {
        console.log(err)
        res.status(500).send(`MongoDB transaction error`)
        return
      }

      res.send(result)

      db.close()
    })
  })
}

exports.get_single_entry = (req, res) => {

  let entry_id = req.params.id
    || req.params.entry_id
    || req.params.yotei_id

  MongoClient.connect(mongodb_url, (err, db) => {

    if (err) {
      console.log(err)
      res.status(500).send(`MongoDB connection error`)
      return
    }

    let query = {_id: ObjectID(entry_id)}

    db.db(mongodb_db)
    .collection(mongodb_collection)
    .findOne(query, (err, result) => {

      if (err) {
        console.log(err)
        res.status(500).send(`MongoDB transaction error`)
        return
      }

      res.send(result)

      db.close()
    })
  })
}

exports.update_entry = (req, res) => {
  let entry_id = req.params.id
    || req.params.entry_id
    || req.params.yotei_id

  if(!entry_id) {
    console.log(`Undefined ID`)
    return res.status(400).send(`Undefined ID`)
  }

  MongoClient.connect(mongodb_url, (err, db) => {

    if (err) {
      console.log(err)
      res.status(500).send(`MongoDB connection error`)
      return
    }

    const query = {_id: ObjectID(entry_id)}

    delete req.body._id
    const actions = {$set: req.body}

    db.db(mongodb_db)
    .collection(mongodb_collection)
    .updateOne(query, actions, (err, result) => {

      if (err) {
        console.log(err)
        res.status(500).send(`MongoDB transaction error`)
        return
      }

      res.send(result)

      db.close()
    })
  })
}

exports.delete_entry = (req, res) => {

  let entry_id = req.params.id
    || req.params.entry_id
    || req.params.yotei_id

  if(!entry_id) {
    console.log(`Undefined ID`)
    return res.status(400).send(`Undefined ID`)
  }

  MongoClient.connect(mongodb_url, (err, db) => {

    if (err) {
      console.log(err)
      res.status(500).send(`MongoDB connection error`)
      return
    }

    const query = {_id: ObjectID(entry_id)}

    db.db(mongodb_db)
    .collection(mongodb_collection)
    .deleteOne(query, (err, result) => {

      if (err) {
        console.log(err)
        res.status(500).send(`MongoDB transaction error`)
        return
      }

      res.send(result)

      db.close()
    })
  })

}
