export const get_id_of_item = (item: any) => {
  return item._id
    || item.properties._id
    || item.identity.low
    || item.identity
}
