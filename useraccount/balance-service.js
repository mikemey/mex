const { assetsMetadata } = require('../metadata')
const {
  dbconnection: { collection, ObjectId },
  wsmessages: { withAction, OK_STATUS },
  Logger
} = require('../utils')

const requiredConfirmations = new Map(Object
  .entries(assetsMetadata)
  .map(([symbol, entry]) => [symbol, entry.confirmations])
)

const INVOICE_TOPIC = 'invoices'
const BLOCK_TOPIC = 'blocks'

const addressMessages = withAction('address')
const invoicesMessages = withAction('invoices')

const defaultsBalances = Object.keys(assetsMetadata)
  .map(symbol => { return { symbol, amount: '0' } })

const balances = collection('balances')
const unsettledInvoices = collection('unsettled')

const dbBalanceId = (userId, symbol) => { return { userId: ObjectId(userId), symbol } }
const dbInvoiceId = (userId, symbol, invoiceId) => { return { userId: ObjectId(userId), symbol, invoiceId } }

const createBalanceUpdate = (existingBalances, newInvoices) => newInvoices
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

  const start = () => Promise.all([
    walletClient.subscribe(INVOICE_TOPIC, invoiceUpdate),
    walletClient.subscribe(BLOCK_TOPIC, blockUpdate)
  ])

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

  const invoiceUpdate = (_, message) => {
    if (invoiceListener) { invoiceListener(message.invoices) }

    const invoices = message.invoices.filter(invoice => invoice.blockheight)
    if (invoices.length > 0) {
      return requiredConfirmations.get(invoices[0].symbol) <= 1
        ? settleImmediately(invoices)
        : storeForLaterSettlement(invoices)
    }
  }

  const settleImmediately = invoices => {
    const balanceIds = invoices.map(({ userId, symbol }) => {
      return { _id: dbBalanceId(userId, symbol) }
    })
    return updateBalances(balanceIds, invoices)
      .catch(err => {
        logger.error('error storing immediate balance update', err)
      })
  }

  const storeForLaterSettlement = invoices => {
    const futureInvoices = invoices.map(({ userId, symbol, invoiceId, date, amount, blockheight }) => {
      return { _id: dbInvoiceId(userId, symbol, invoiceId), date, amount, blockheight }
    })
    if (futureInvoices.length > 0) {
      return unsettledInvoices.insertMany(futureInvoices)
        .catch(err => {
          logger.error('error storing unsettled invoices', err)
        })
    }
  }

  const blockUpdate = async (_, message) => {
    const { symbol, blockheight } = message
    const settleBlockheight = blockheight - requiredConfirmations.get(symbol) + 1
    const unsettled = await unsettledInvoices.find({ '_id.symbol': symbol, blockheight: { $lte: settleBlockheight } }).toArray()

    if (unsettled.length > 0) {
      const [balanceIds, invoices] = unsettled
        .reduce(([balanceIds, invoices], { _id: { userId, symbol }, amount }) => {
          balanceIds.push({ _id: dbBalanceId(userId, symbol) })
          invoices.push({ userId, symbol, amount })
          return [balanceIds, invoices]
        }, [[], []])

      return updateBalances(balanceIds, invoices)
        .then(() => unsettledInvoices.deleteMany({
          $or: unsettled.map(inv => { return { _id: inv._id } })
        }))
        .catch(err => {
          logger.error('error storing block balance update', err)
        })
    }
  }

  const updateBalances = (balanceIds, invoices) => balances
    .find({ $or: balanceIds }).toArray()
    .then(existingBalances => {
      const update = createBalanceUpdate(existingBalances, invoices)
      logger.debug('balance updates:', update.length)
      return balances.bulkWrite(update)
    })

  return { start, setInvoiceListener, getBalances, getInvoices }
}

module.exports = BalanceService
