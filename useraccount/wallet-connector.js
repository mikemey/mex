const { wsmessages: { withAction, OK_STATUS } } = require('../utils')

const INVOICE_TOPIC = 'invoices'

const addressMessages = withAction('address')
const invoicesMessages = withAction('invoices')

const WalletConnector = (walletClient) => {
  const registerInvoiceCallback = cb => walletClient.subscribe(INVOICE_TOPIC, cb)

  const requestDepositData = (symbol, jwt) => {
    const addressReq = addressMessages.build({ symbol, jwt })
    const invoicesReq = invoicesMessages.build({ symbol, jwt })
    return Promise
      .all([walletClient.send(addressReq), walletClient.send(invoicesReq)])
      .then(([addressRes, invoicesRes]) => addressRes.status === OK_STATUS && invoicesRes.status === OK_STATUS
        ? { isOK: true, data: { address: addressRes.address, invoices: invoicesRes.invoices } }
        : { isOK: false }
      )
  }

  return { registerInvoiceCallback, requestDepositData }
}

module.exports = WalletConnector
