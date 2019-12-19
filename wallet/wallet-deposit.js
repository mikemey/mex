const utc = require('moment').utc

const {
  Logger,
  wsmessages: { withAction },
  dbconnection: { collection, ObjectId }
} = require('../utils')
const { getChainAdapter, startAllListener } = require('./chains')

const ADDRESS_ACT = 'address'
const INVOICES_ACT = 'invoices'
const newAddressMessages = withAction(ADDRESS_ACT)
const invoicesMessages = withAction(INVOICES_ACT)

const addressesColl = collection('addresses')
const invoicesColl = collection('invoices')

const logger = Logger('deposits')

const dbAddressId = (userId, symbol) => { return { userId: ObjectId(userId), symbol } }

const getAddress = async request => {
  logger.debug('receivet getAddress request:', request)
  const { user: { id }, symbol } = request
  const userAddress = await findUserAddresses(id, symbol) || await createUserAddress(id, symbol)
  logger.info('respond with address:', userAddress.address)
  return newAddressMessages.ok({ address: userAddress.address })
}

const findUserAddresses = (userId, symbol) => addressesColl
  .findOne({ _id: dbAddressId(userId, symbol) })

const createUserAddress = async (userId, symbol) => {
  const address = await getChainAdapter(symbol).createNewAddress()
  const newEntry = { _id: dbAddressId(userId, symbol), address }
  await addressesColl.insertOne(newEntry)
  logger.info('created new address, user:', userId, 'symbol:', symbol, 'address:', address)
  return newEntry
}

const getInvoices = async request => {
  const { user: { id }, symbol } = request
  logger.debug('searching invoices for:', id, 'symbol:', symbol)
  const invoices = await invoicesColl.find({ '_id.userId': id, '_id.symbol': symbol }).toArray()
  logger.debug('found invoices:', invoices.length)
  return invoicesMessages.ok({ invoices })
}

const startListening = listenerCallback => {
  logger.info('start listening to chains')
  startAllListener(async event => {
    logger.debug('new invoices event, received:', event.invoices.length)

    const $orClause = event.invoices.map(invoice => { return { address: invoice.address } })
    const userAddresses = await addressesColl.find({ $or: $orClause }).toArray()
    logger.debug('relevant addresses:', userAddresses.length)

    const invOps = invoicesColl.initializeOrderedBulkOp()

    const invoices = userAddresses.reduce((allInvoices, userAddress) => {
      const eventInvoices = event.invoices.filter(inv => inv.address === userAddress.address)
      const dbInvoices = eventInvoices.map(invoice => addBulkOperation(invOps, invoice, userAddress))
      allInvoices.push(...dbInvoices)
      return allInvoices
    }, [])

    if (invoices.length > 0) {
      logger.debug('storing invcoices:', invoices.length)
      const result = await invOps.execute()
      logger.info('stored invoices event, created:', result.nInserted, 'updated:', result.nModified)
      listenerCallback({ blockheight: event.blockheight, invoices })
    } else {
      logger.debug('no relevant invoices in event')
    }
  })
}

const addBulkOperation = (bulkops, invoice, userAddress) => {
  const { userId, symbol } = userAddress._id
  const recordId = { userId, symbol, invoiceId: invoice.invoiceId }

  const dbInvcoice = {
    _id: recordId,
    date: utc().toISOString(),
    amount: invoice.amount,
    blockheight: invoice.blockheight
  }
  if (invoice.blockheight) {
    bulkops
      .find({ _id: recordId })
      .upsert()
      .update({ $set: { date: dbInvcoice.date, amount: dbInvcoice.amount, blockheight: dbInvcoice.blockheight } })
  } else {
    bulkops.insert(dbInvcoice)
  }
  return dbInvcoice
}

module.exports = { ADDRESS_ACT, INVOICES_ACT, getAddress, getInvoices, startListening }
