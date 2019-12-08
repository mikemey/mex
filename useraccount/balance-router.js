const express = require('express')

const symbolData = require('../metadata/assets.json')
const {
  LogTrait, wsmessages: { withAction }, dbconnection: { Long, mg }
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

const balanceDefaults = Object.keys(symbolData)
  .map(key => { return { symbol: key, amount: Long('0') } })

const asHRAmount = (amount, symdata) => {
  const amt = amount.toString().padStart(symdata.fractions + 1, '0')
  const whole = amt.slice(0, -symdata.fractions)
  const fraction = amt.slice(-symdata.fractions, amt.length - symdata.fractions + uiFractions)
  return `${whole}.${fraction}`
}

const addressMessages = withAction('newaddress')

class BalanceRouter extends LogTrait {
  constructor (walletClient) {
    super()
    this.walletClient = walletClient
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
          const symdata = symbolData[asset.symbol]
          asset.hrname = symdata.hrname
          asset.hramount = asHRAmount(asset.amount, symdata)
          return asset
        })
        res.render(BALANCE_VIEW, { assets })
      })
    })

    router.get('/balance/address/:symbol', async (req, res) => {
      const addReq = addressMessages.build({
        id: req.user.id, symbol: req.params.symbol
      })
      const addressRes = await this.walletClient.send(addReq)
      res.json({ address: addressRes.address }).end()
    })

    return router
  }
}

module.exports = BalanceRouter
