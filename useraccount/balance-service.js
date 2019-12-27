const { assetsMetadata } = require('../metadata')
const {
  dbconnection: { collection, ObjectId },
  wsmessages: { withAction, OK_STATUS },
  Logger
} = require('../utils')

// const requiredConfirmations = new Map(Object
//   .entries(assetsMetadata)
//   .map(([symbol, entry]) => [symbol, entry.confirmations])
// )

const INVOICE_TOPIC = 'invoices'
// const BLOCK_TOPIC = 'block'

const addressMessages = withAction('address')
const invoicesMessages = withAction('invoices')

const defaultsBalances = Object.keys(assetsMetadata)
  .map(symbol => { return { symbol, amount: '0' } })

const balances = collection('balances')
// const openInvoices = collection('openinv')

const dbBalanceId = (userId, symbol) => { return { userId: ObjectId(userId), symbol } }

const updateBalances = (existingBalances, newInvoices) => newInvoices
  .reduce((newBalances, { userId, symbol, amount }) => {
    let userBalance = newBalances.find(prevBalance =>
      prevBalance._id.userId.equals(userId) && prevBalance._id.symbol === symbol
    )
    if (!userBalance) {
      userBalance = { _id: dbBalanceId(userId, symbol), amount: '0' }
      newBalances.push(userBalance)
    }
    userBalance.amount = (BigInt(userBalance.amount) + BigInt(amount)).toString()
    return newBalances
  }, existingBalances)
  .map(({ _id, amount }) => {
    return { updateOne: { filter: { '_id.userId': _id.userId, '_id.symbol': _id.symbol }, update: { $set: { amount } }, upsert: true } }
  })

const BalanceService = walletClient => {
  let invoiceListener = null
  const logger = Logger('balance-svc')
  const setInvoiceListener = listener => { invoiceListener = listener }

  const start = () => walletClient.subscribe(INVOICE_TOPIC, invoiceUpdate)

  const invoiceUpdate = async (_, message) => {
    if (invoiceListener) { invoiceListener(message.invoices) }

    const invoices = message.invoices.filter(invoice => invoice.blockheight)
    if (invoices.length > 0) {
      const balanceIds = invoices.map(({ userId, symbol }) => {
        return { _id: dbBalanceId(userId, symbol) }
      })
      const existingBalances = await balances.find({ $or: balanceIds }).toArray()
      const update = updateBalances(existingBalances, invoices)

      logger.debug('balance updates:', update.length)
      await balances.bulkWrite(update)
        .catch(err => { logger.error('error storing balance update', err) })
    }
  }

  const getInvoices = (symbol, jwt) => {
    const addressReq = addressMessages.build({ symbol, jwt })
    const invoicesReq = invoicesMessages.build({ symbol, jwt })
    return Promise
      .all([walletClient.send(addressReq), walletClient.send(invoicesReq)])
      .then(([addressRes, invoicesRes]) => addressRes.status === OK_STATUS && invoicesRes.status === OK_STATUS
        ? { isOK: true, data: { address: addressRes.address, invoices: invoicesRes.invoices } }
        : { isOK: false }
      )
  }

  const getBalances = async userId => {
    const storedBalances = await balances.find({ '_id.userId': ObjectId(userId) })
      .map(({ _id: { symbol }, amount }) => { return { symbol, amount } })
      .toArray()
    return defaultsBalances.map(def => storedBalances.find(store => store.symbol === def.symbol) || def)
  }

  return { start, setInvoiceListener, getBalances, getInvoices }
}

module.exports = BalanceService
