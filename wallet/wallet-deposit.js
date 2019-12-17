const {
  Logger,
  wsmessages: { withAction },
  dbconnection: { collection, ObjectId }
} = require('../utils')
const { getChainAdapter, startAllListener } = require('./chains')

const ADDRESS_ACT = 'address'
const newAddressMessages = withAction(ADDRESS_ACT)

const addressesColl = collection('addresses')
const invoicesColl = collection('invoices')

const logger = Logger('deposits')

const getAddress = async request => {
  logger.debug('receivet getAddress request:', request)
  const { user: { id }, symbol } = request
  const userAddress = await findUserAddresses(id, symbol) || await createUserAddress(id, symbol)
  logger.info('respond with address:', userAddress.address)
  return newAddressMessages.ok({ address: userAddress.address })
}

const findUserAddresses = (userId, symbol) => addressesColl.findOne({
  _id: ObjectId(userId), symbol
})

const createUserAddress = async (userId, symbol) => {
  const address = await getChainAdapter(symbol).createNewAddress()
  const newEntry = { _id: ObjectId(userId), symbol, address }
  await addressesColl.insertOne(newEntry)
  logger.info('created new address, user:', userId, 'symbol:', symbol, 'address:', address)
  return newEntry
}

const startListening = listenerCallback => {
  logger.info('start listening to chains')
  startAllListener(async event => {
    logger.debug('new invoices event, received:', event.invoices.length)
    const $orClause = event.invoices.map(invoice => { return { address: invoice.address } })
    const userAddresses = await addressesColl.find({ $or: $orClause }).toArray()

    const invOps = invoicesColl.initializeOrderedBulkOp()
    const invoices = userAddresses.map(userAddress => {
      const eventInvoice = event.invoices.find(inv => inv.address === userAddress.address)
      const dbInvcoice = {
        _id: ObjectId(userAddress._id),
        symbol: userAddress.symbol,
        invoiceId: eventInvoice.invoiceId,
        amount: eventInvoice.amount,
        blockheight: eventInvoice.blockheight
      }
      if (eventInvoice.blockheight) {
        invOps
          .find({ _id: dbInvcoice._id, symbol: dbInvcoice.symbol, invoiceId: dbInvcoice.invoiceId })
          .upsert()
          .update({ $set: { amount: dbInvcoice.amount, blockheight: dbInvcoice.blockheight } })
      } else {
        invOps.insert(dbInvcoice)
      }
      return dbInvcoice
    })
    if (invoices.length > 0) {
      logger.debug('trying to store invcoices, count:', invoices.length)
      const result = await invOps.execute()
      logger.info('stored invoices event, created:', result.nInserted, 'updated:', result.nModified)
      listenerCallback({ blockheight: event.blockheight, invoices })
    } else {
      logger.debug('no relevant invoices in event')
    }
  })
}

module.exports = { ADDRESS_ACT, getAddress, startListening }
