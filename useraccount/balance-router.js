const express = require('express')
const querystring = require('querystring')
const moment = require('moment')

const { assetsMetadata } = require('../metadata')
const { Logger, units: { fromBaseAmount } } = require('../utils')

const BALANCE_VIEW = 'balance'
const unconfirmedLabel = 'unconfirmed'

const getAssetMetadata = symbol => {
  const metadata = assetsMetadata[symbol]
  if (!metadata) throw Error(`asset not supported: ${symbol}`)
  return metadata
}
const availableSymbols = Object.keys(assetsMetadata)

const asHRAmount = (amount, symbol) => fromBaseAmount(amount, symbol).toDefaultUnit()

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
  .map(invoice => {
    invoice.date = moment.utc(invoice.date)
    return invoice
  })
  .sort((a, b) => getBlockOrdinal(b) - getBlockOrdinal(a) || b.date - a.date)
  .map(asHRInvoice)

const getBlockOrdinal = ({ blockheight }) => blockheight || Number.MAX_VALUE

const depositPath = slug => `balance/deposit/${slug}`
const withdrawPath = slug => `balance/withdraw/${slug}`
const depositRoot = path => '/' + depositPath(path)

class BalanceRouter {
  constructor (balanceService, config) {
    this.config = config
    this.balanceService = balanceService
    this.balanceService.setInvoiceListener(this._invoiceUpdate.bind(this))

    this.clients = new Map()
    this.logger = Logger(this.constructor.name)
  }

  stop () {
    for (const [userId, clientSocket] of this.clients) {
      clientSocket.terminate()
      this.clients.delete(userId)
    }
  }

  _invoiceUpdate (invoices) {
    this.logger.info('received invoice updates:', invoices.length)
    invoices.filter(invoice => this.clients.has(invoice.userId))
      .forEach(invoice => {
        const data = JSON.stringify(asHRInvoice(invoice))
        this.clients.get(invoice.userId).send(data)
      })
  }

  createRoutes () {
    const router = express.Router()

    router.get('/balance', (req, res, next) => this.balanceService
      .getBalances(req.user.id)
      .then(balances => {
        const assets = balances.map(asset => {
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
      .catch(err => { next(err) })
    )

    router.get(depositRoot(':symbol'), async (req, res) => {
      const symbol = req.params.symbol
      if (!availableSymbols.includes(symbol)) {
        return res.redirect(303, '../' + '?' + querystring.stringify({ message: `asset not supported: ${symbol}` }))
      }

      this.logger.info('requesting deposit data, userId:', req.user.id)
      return this.balanceService.getInvoices(symbol, req.session.jwt)
        .then(deposit => deposit.isOK
          ? res.render('deposit', { address: deposit.data.address, symbol, invoices: asHRInvoices(deposit.data.invoices) })
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
