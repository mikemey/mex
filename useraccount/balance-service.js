const { assetsMetadata } = require('../metadata')
const {
  dbconnection: { collection, ObjectId },
  wsmessages: { withAction, OK_STATUS }
} = require('../utils')

const INVOICE_TOPIC = 'invoices'
// const BLOCK_TOPIC = 'block'

const addressMessages = withAction('address')
const invoicesMessages = withAction('invoices')

const balanceDefaults = Object.keys(assetsMetadata)
  .map(key => { return { symbol: key, amount: '0' } })

const BalanceService = walletClient => {
  const balances = collection('balances')
  const data = { invoiceListener: null }

  const setInvoiceListener = listener => { data.invoiceListener = listener }

  const start = () => walletClient.subscribe(INVOICE_TOPIC, invoiceUpdate)

  const invoiceUpdate = (_, message) => {
    if (data.invoiceListener) {
      data.invoiceListener(message.invoices)
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

  const getBalances = userId => balances.findOne({ _id: ObjectId(userId) })
    .then(doc => doc === null
      ? balanceDefaults
      : balanceDefaults.map(
        balDefault => doc.assets.find(asset => asset.symbol === balDefault.symbol) || balDefault
      )
    )

  return { start, setInvoiceListener, getBalances, getInvoices }
}

module.exports = BalanceService
