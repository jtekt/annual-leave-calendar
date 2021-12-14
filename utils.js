exports.get_id_of_item = (item) => {
  return item._id
    || item.properties._id
    || item.identity.low
    || item.identity
}


exports.error_handling = (error, res) => {

  console.log(error)

  let code = error.code || 500
  if(code > 600) error.code = 500

  const message = error.message || error

  res.status(code).send(message)

}
