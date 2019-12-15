const {
  Logger,
  wsmessages: { withAction },
  dbconnection: { collection, ObjectId }
} = require('../utils')
const { getChainAdapter } = require('./chains')

const ADDRESS_ACT = 'address'
const newAddressMessages = withAction(ADDRESS_ACT)

const addressesColl = collection('addresses')
const invoicesColl = collection('invoices')

const logger = Logger('deposits')

const _idFilter = id => { return { _id: ObjectId(id) } }

const findUserAddresses = userId => addressesColl.findOne(_idFilter(userId))

const createUserAddress = async userId => {
  const newEntry = { _id: ObjectId(userId), assets: [] }
  await addressesColl.insertOne(newEntry)
  logger.info('created new addresses entry for user:', userId)
  return newEntry
}

const findSymbolAddress = (userAddresses, symbol) => userAddresses.assets
  .find(symAddress => symAddress.symbol === symbol)

const createSymbolAddress = async (userAddresses, symbol) => {
  const address = await getChainAdapter(symbol).createNewAddress()
  const newSymbolAddress = { symbol, address }

  userAddresses.assets.push(newSymbolAddress)
  await addressesColl.updateOne(_idFilter(userAddresses._id), {
    $addToSet: { assets: newSymbolAddress }
  })
  logger.info('created new asset address, user:', userAddresses._id, 'symbol:', symbol, 'address:', address)
  return newSymbolAddress
}

const getAddress = async request => {
  const { user: { id }, symbol } = request
  const userAddresses = await findUserAddresses(id) || await createUserAddress(id)
  const symbolAddress = findSymbolAddress(userAddresses, symbol) ||
    await createSymbolAddress(userAddresses, symbol)

  return newAddressMessages.ok({ address: symbolAddress.address })
}

module.exports = { getAddress, ADDRESS_ACT }
