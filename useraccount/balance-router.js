const express = require('express')

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

const uiFractions = 8

const availableSymbols = Object.keys(assetsMetadata)
const balanceDefaults = Object.keys(assetsMetadata)
  .map(key => { return { symbol: key, amount: Long('0') } })

const asHRAmount = (amount, symdata) => {
  const amt = amount.toString().padStart(symdata.fractions + 1, '0')
  const whole = amt.slice(0, -symdata.fractions)
  const fraction = amt.slice(-symdata.fractions, amt.length - symdata.fractions + uiFractions)
  return `${whole}.${fraction}`
}

const addressMessages = withAction('address')

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
          const symdata = assetsMetadata[asset.symbol]
          asset.hrname = symdata.hrname
          asset.hramount = asHRAmount(asset.amount, symdata)
          return asset
        })
        res.render(BALANCE_VIEW, { assets })
      })
    })

    router.get('/balance/deposit/:symbol', async (req, res) => {
      const symbol = req.params.symbol
      if (!availableSymbols.includes(symbol)) {
        return res.redirect(303, '../')
      }
      const addReq = addressMessages.build({ symbol, jwt: req.session.jwt })
      return this.walletClient.send(addReq)
        .then(addressRes => addressRes.status === OK_STATUS
          ? res.render('deposit', { address: addressRes.address, symbol })
          : res.redirect(303, '../')
        )
        .catch(err => {
          this.logger.error('wallet service error:', err.message)
          res.render('unavailable', { error: 'wallet service unavailable, sorry!' })
        })
    })

    return router
  }
}

module.exports = BalanceRouter
