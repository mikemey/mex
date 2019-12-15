const Joi = require('@hapi/joi')

const chains = [
  require('./btc-adapter')
]
const { Validator } = require('../../utils')

const configSchema = Joi.object({
  btcnode: Joi.object().required()
})

const data = {
  availableSymbols: chains.map(chain => chain.symbol),
  chainAdapters: null
}

const createAll = allConfigs => {
  Validator.oneTimeValidation(configSchema, allConfigs)

  const getConfigFor = chain => allConfigs[chain.symbol + 'node']
  data.chainAdapters = new Map(
    chains.map(chain => [chain.symbol, chain.create(getConfigFor(chain))])
  )
}

const getChainAdapter = symbol => {
  if (!data.chainAdapters) { throw new Error('chain adapters not created') }
  if (!data.availableSymbols.includes(symbol)) { throw new Error(`chain not supported: ${symbol}x`) }
  return data.chainAdapters.get(symbol)
}

const stopAll = () => {
  for (const adapter of data.chainAdapters.values()) {
    adapter.stopListener()
  }
  data.chainAdapters = null
}

module.exports = { createAll, stopAll, getChainAdapter }
