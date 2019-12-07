const express = require('express')
const jsonwebtoken = require('jsonwebtoken')

const { LogTrait } = require('../utils')

const { dbconnection: { Long, mg } } = require('../utils')

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
const symbolData = {
  btc: { hrname: 'Bitcoin', fractions: 8 },
  eth: { hrname: 'Ethereum', fractions: 18 }
}

const balanceDefaults = Object.keys(symbolData)
  .map(key => { return { symbol: key, amount: Long('0') } })

const asHRAmount = (amount, symdata) => {
  const amt = amount.toString().padStart(symdata.fractions + 1, '0')
  const whole = amt.slice(0, -symdata.fractions)
  const fraction = amt.slice(-symdata.fractions, amt.length - symdata.fractions + uiFractions)
  return `${whole}.${fraction}`
}

class BalanceRouter extends LogTrait {
  createRoutes () {
    const router = express.Router()

    router.get('/balance', async (req, res, next) => {
      const { id } = jsonwebtoken.decode(req.session.jwt)

      return Balances.findById(id, 'assets').exec((err, doc) => {
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

    return router
  }
}

module.exports = BalanceRouter
