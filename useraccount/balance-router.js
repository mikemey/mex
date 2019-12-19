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

const getAssetMetadata = symbol => assetsMetadata[symbol]
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

const asHRInvoices = (invoices, symbol) => invoices.map(inv => {
  return {
    id: inv._id.invoiceId,
    href: invoiceHrefFrom(inv._id.invoiceId, symbol),
    hrdate: moment(inv.date).format('LLLL'),
    hramount: asHRAmount(inv.amount, symbol),
    block: {
      id: inv.blockheight,
      href: blockHrefFrom(inv.blockheight, symbol)
    }
  }
})

const addressMessages = withAction('address')
const invoicesMessages = withAction('invoices')

const depositPath = slug => `balance/deposit/${slug}`
const withdrawPath = slug => `balance/withdraw/${slug}`
const rootOf = path => `/${path}`

class BalanceRouter {
  constructor (walletClient) {
    this.walletClient = walletClient
    this.logger = Logger(this.constructor.name)
  }

  createRoutes () {
    const router = express.Router()

    router.get('/balance', async (req, res, next) => {
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

    router.get(rootOf(depositPath(':symbol')), async (req, res) => {
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
          invoices: asHRInvoices(invoicesRes.invoices, symbol)
        })
        : res.redirect(303, '../' + '?' + querystring.stringify({ message: 'wallet service error' }))
      ).catch(err => {
        this.logger.error('wallet service error:', err)
        res.render('unavailable', { error: 'wallet service unavailable, sorry!' })
      })
    })

    return router
  }
}

module.exports = BalanceRouter
