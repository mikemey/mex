const express = require('express')
const querystring = require('querystring')
const moment = require('moment')

const { assetsMetadata } = require('../metadata')
const {
  Logger, wsmessages: { withAction, OK_STATUS }, dbconnection: { Long, mg }
} = require('../utils')

const asset = mg.Schema({
  symbol: 'string',
  amount: Long
}, { _id: false })

const BalancesSchema = mg.Schema({
  assets: [asset]
})

const Balances = mg.model('balances', BalancesSchema)

const BALANCE_VIEW = 'balance'
const INVOICE_TOPIC = 'invoices'
const unconfirmedLabel = 'unconfirmed'

const getAssetMetadata = symbol => {
  const metadata = assetsMetadata[symbol]
  if (!metadata) throw Error(`asset not supported: ${symbol}`)
  return metadata
}
const availableSymbols = Object.keys(assetsMetadata)
const balanceDefaults = Object.keys(assetsMetadata)
  .map(key => { return { symbol: key, amount: Long('0') } })

const asHRAmount = (amount, symbol) => {
  const assetFractions = getAssetMetadata(symbol).fractions
  const amt = amount.toString().padStart(assetFractions + 1, '0')
  const whole = amt.slice(0, -assetFractions)
  const fraction = amt.slice(-assetFractions, amt.length)
  return `${whole}.${fraction}`
}

const blockHrefFrom = (blockheight, symbol) =>
  getAssetMetadata(symbol).links.block.replace('<<blockheight>>', blockheight)
const invoiceHrefFrom = (invoiceId, symbol) =>
  getAssetMetadata(symbol).links.tx.replace('<<txid>>', invoiceId)

const asHRInvoice = ({ symbol, invoiceId, date, amount, blockheight }) => {
  return {
    id: invoiceId,
    href: invoiceHrefFrom(invoiceId, symbol),
    hrdate: moment.utc(date).format('LLLL'),
    hramount: asHRAmount(amount, symbol),
    block: blockheight
      ? { id: blockheight, href: blockHrefFrom(blockheight, symbol) }
      : { id: unconfirmedLabel }
  }
}

const asHRInvoices = invoices => invoices
  .sort((a, b) => getBlockOrdinal(b) - getBlockOrdinal(a) || b.date - a.date)
  .map(asHRInvoice)

const getBlockOrdinal = ({ blockheight }) => blockheight || Number.MAX_VALUE

const addressMessages = withAction('address')
const invoicesMessages = withAction('invoices')

const depositPath = slug => `balance/deposit/${slug}`
const withdrawPath = slug => `balance/withdraw/${slug}`
const depositRoot = path => '/' + depositPath(path)

class BalanceRouter {
  constructor (walletClient, config) {
    this.walletClient = walletClient
    this.config = config

    this.clients = new Map()
    this.logger = Logger(this.constructor.name)
  }

  start () {
    this.logger.debug('starting update router')
    const updateClientSockets = (_, message) => {
      this.logger.info('received invoice updates:', message.invoices.length)
      return message.invoices
        .filter(invoice => this.clients.has(invoice.userId))
        .forEach(invoice => {
          const data = JSON.stringify(asHRInvoice(invoice))
          this.clients.get(invoice.userId).send(data)
        })
    }

    return this.walletClient.subscribe(INVOICE_TOPIC, updateClientSockets)
  }

  stop () {
    for (const clientSocket of this.clients.values()) {
      clientSocket.terminate()
    }
  }

  createRoutes () {
    const router = express.Router()

    router.get('/balance', (req, res, next) => {
      return Balances.findById(req.user.id, 'assets').exec((err, doc) => {
        if (err) { return next(err) }

        const balance = doc === null
          ? balanceDefaults
          : balanceDefaults.map(balDefault =>
            doc.assets.find(asset => asset.symbol === balDefault.symbol) || balDefault
          )

        const assets = balance.map(asset => {
          asset.hrname = getAssetMetadata(asset.symbol).hrname
          asset.hramount = asHRAmount(asset.amount, asset.symbol)
          asset.hrefDeposit = depositPath(asset.symbol)
          asset.hrefWithdraw = withdrawPath(asset.symbol)
          return asset
        })

        const viewData = { assets }
        if (req.query.message) {
          viewData.message = req.query.message
        }
        res.render(BALANCE_VIEW, viewData)
      })
    })

    router.get(depositRoot(':symbol'), async (req, res) => {
      const symbol = req.params.symbol
      if (!availableSymbols.includes(symbol)) {
        return res.redirect(303, '../' + '?' + querystring.stringify({ message: `asset not supported: ${symbol}` }))
      }
      const addressReq = addressMessages.build({ symbol, jwt: req.session.jwt })
      const invoicesReq = invoicesMessages.build({ symbol, jwt: req.session.jwt })
      this.logger.info('requesting deposit data, userId:', req.user.id)
      return Promise.all([
        this.walletClient.send(addressReq), this.walletClient.send(invoicesReq)
      ]).then(([addressRes, invoicesRes]) => addressRes.status === OK_STATUS && invoicesRes.status === OK_STATUS
        ? res.render('deposit', {
          address: addressRes.address,
          symbol,
          invoices: asHRInvoices(invoicesRes.invoices)
        })
        : res.redirect(303, '../' + '?' + querystring.stringify({ message: 'wallet service error' }))
      ).catch(err => {
        this.logger.error('wallet service error:', err)
        res.render('unavailable', { error: 'wallet service unavailable, sorry!' })
      })
    })

    router.ws('/wsapi/invoices', (ws, req) => {
      this.logger.info('new ws connecting:', req.user.id)
      const clientSocket = ClientSocket(req.user.id, ws, this.config.clientTimeout, () => this.clients.delete(req.user.id))
      this.clients.set(req.user.id, clientSocket)
    })

    return router
  }
}

const ClientSocket = (userId, ws, timeout, removeClient) => {
  const logger = Logger(`user-update-${userId}`)
  const data = {
    isAlive: true,
    aliveCheck: null
  }

  ws.on('pong', () => { data.isAlive = true })
  ws.on('close', () => terminate())
  ws.on('error', err => {
    logger.info('client error:', err)
    terminate()
  })

  const send = message => {
    try {
      ws.send(message)
    } catch (err) {
      logger.error('send error:', err)
      terminate()
    }
  }

  data.aliveCheck = setInterval(() => {
    if (data.isAlive === false) {
      logger.debug('remove inactive client:', userId)
      terminate()
    } else {
      data.isAlive = false
      ws.ping(err => {
        if (err) {
          logger.info('ping failed:', err)
        }
      })
    }
  }, timeout)

  const terminate = () => {
    logger.debug('terminating')
    if (data.aliveCheck) {
      clearInterval(data.aliveCheck)
    }
    removeClient()
    ws.terminate()
  }

  return { send, terminate }
}

module.exports = BalanceRouter
