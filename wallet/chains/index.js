const chains = [
  require('./btc-adapter')
]

const chainNotSupported = asset => { throw new Error(`chain not supported: ${asset}`) }

const getChain = asset =>
  chains.find(chain => chain.symbol === asset) ||
  chainNotSupported(asset)

module.exports = { getChain }
