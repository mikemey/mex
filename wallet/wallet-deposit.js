const { wsmessages: { withAction }, dbconnection } = require('../utils')

const ADDRESS_ACT = 'address'
const newAddressMessages = withAction(ADDRESS_ACT)

const addressesColl = dbconnection.collection('addresses')

const idFilter = id => { return { _id: dbconnection.ObjectId(id) } }

const findUserAddresses = userId => addressesColl.findOne({ _id: dbconnection.ObjectId(userId) })
const createUserAddress = async userId => {
  const newEntry = { _id: dbconnection.ObjectId(userId), reserved: [] }
  await addressesColl.insertOne(newEntry)
  return newEntry
}

const findSymbolAddress = (userAddresses, symbol) => userAddresses.reserved
  .find(symAddress => symAddress.symbol === symbol)
const createSymbolAddress = async (userAddresses, symbol, address) => {
  const newSymbolAddress = { symbol, address }
  userAddresses.reserved.push(newSymbolAddress)
  await addressesColl.updateOne(idFilter(userAddresses._id), {
    $push: { reserved: newSymbolAddress }
  })
  return newSymbolAddress
}

const createDepositer = wallet => {
  const getAddress = async request => {
    const { user: { id }, symbol } = request
    const userAddresses = await findUserAddresses(id) || await createUserAddress(id)
    const symbolAddress = findSymbolAddress(userAddresses, symbol) ||
      await createSymbolAddress(userAddresses, symbol, await wallet.getNewAddress())

    return newAddressMessages.ok({ address: symbolAddress.address })
  }

  return { getAddress }
}

module.exports = { createDepositer, ADDRESS_ACT }
