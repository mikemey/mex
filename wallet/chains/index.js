const chains = [
  require('./btc-adapter')
]

const chainNotSupported = asset => { throw new Error(`chain not supported: ${asset}`) }

const getAdapter = asset =>
  chains.find(chain => chain.symbol === asset) ||
  chainNotSupported(asset)

const getChainAdapter = () => { }
const createAll = allConfigs => { }
const stopAll = () => { }

module.exports = { createAll, stopAll, getChainAdapter }
