const { assetsMetadata } = require('../metadata')
const { dbconnection: { Long, mg } } = require('../utils')

const asset = mg.Schema({
  symbol: 'string',
  amount: Long
}, { _id: false })

const BalancesSchema = mg.Schema({
  assets: [asset]
})

const Balances = mg.model('balances', BalancesSchema)

const balanceDefaults = Object.keys(assetsMetadata)
  .map(key => { return { symbol: key, amount: Long('0') } })

const BalanceService = walletClient => {
  const getBalances = userId => Balances.findById(userId, 'assets').exec()
    .then(doc => doc === null
      ? balanceDefaults
      : balanceDefaults.map(
        balDefault => doc.assets.find(asset => asset.symbol === balDefault.symbol) || balDefault
      )
    )

  return { getBalances }
}

module.exports = BalanceService
